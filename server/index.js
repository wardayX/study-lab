import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

// Read local environment variables without adding a runtime dependency.
try {
  const envText = readFileSync(join(ROOT, '.env'), 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
} catch { /* .env is optional in deployment environments */ }

const PORT = Number(process.env.PORT || 8787)
const MAX_BODY = 30_000


const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    subject: { type: 'string' },
    summary: { type: 'string' },
    flashcards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
          explanation: { type: 'string' },
          difficulty: {
            type: 'string',
            enum: ['Easy', 'Medium', 'Hard']
          }
        },
        required: [
          'question', 'answer', 'explanation', 'difficulty'
        ]
      }
    },
    quiz: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' }
          },
          correctAnswer: { type: 'integer' },
          explanation: { type: 'string' },
          difficulty: {
            type: 'string',
            enum: ['Easy', 'Medium', 'Hard']
          }
        },
        required: [
          'question', 'options', 'correctAnswer',
          'explanation', 'difficulty'
        ]
      }
    }
  },
  required: ['title', 'subject', 'summary', 'flashcards', 'quiz']
}


function validateStudySet(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'The model returned an invalid object.'
  if (typeof value.title !== 'string' || typeof value.subject !== 'string' || typeof value.summary !== 'string') return 'The model response is missing its title, subject or summary.'
  if (!Array.isArray(value.flashcards) || value.flashcards.length < 4 || value.flashcards.length > 12) return 'The model returned an invalid flashcard list.'
  if (!Array.isArray(value.quiz) || value.quiz.length < 4 || value.quiz.length > 8) return 'The model returned an invalid quiz list.'
  for (const card of value.flashcards) {
    if (!card || typeof card.question !== 'string' || card.question.length < 8 || typeof card.answer !== 'string' || !card.answer.length || typeof card.explanation !== 'string' || !card.explanation.length || !['Easy', 'Medium', 'Hard'].includes(card.difficulty)) return 'A flashcard is missing required text fields.'
  }
  for (const item of value.quiz) {
    if (!item || typeof item.question !== 'string' || item.question.length < 8 || !Array.isArray(item.options) || item.options.length !== 4 || !item.options.every(option => typeof option === 'string' && option.length > 0) || !Number.isInteger(item.correctAnswer) || item.correctAnswer < 0 || item.correctAnswer > 3 || typeof item.explanation !== 'string' || !item.explanation.length || !['Easy', 'Medium', 'Hard'].includes(item.difficulty)) return 'A quiz question has an invalid structure.'
  }
  return null
}

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > MAX_BODY) throw new Error('Request is too large. Keep your notes under 30 KB.')
  }
  try { return JSON.parse(raw) } catch { throw new Error('The request body was not valid JSON.') }
}


async function generate(req, res) {
  const body = await readJson(req)
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  if (notes.length < 20) {
    return send(res, 400, {
      error: 'Add at least 20 characters.'
    })
  }

  if (notes.length > 20000) {
    return send(res, 400, {
      error: 'Your notes are too long. Keep them under 20,000 characters.'
    })
  }

  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    return send(res, 503, {
      error: 'Groq API key is missing. Configure GROQ_API_KEY on the server.'
    })
  }

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  const startedAt = Date.now()

  try {
    const upstream = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are STUDY//LAB, a precise educational learning assistant.

Create a structured study set from the user's input.

If detailed notes are provided, prioritize their information.
If only a topic is provided, explain it using your general knowledge.
Do not invent facts or claim that outside information came from the notes.

Generate exactly:
- 6 flashcards
- 4 multiple-choice questions
- 4 options per question

Each flashcard needs a question, answer, explanation and difficulty.
Each quiz needs a question, four options, a zero-based correctAnswer,
an explanation and difficulty.

Keep explanations concise and educational.
Avoid duplicate questions.
Return only the requested structured data.`
            },
            {
              role: 'user',
              content: `Create a study set from this material:\n\n${notes}`
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'study_set',
              strict: true,
              schema: responseSchema
            }
          },
          temperature: 0.3,
          max_completion_tokens: 4096
        })
      }
    )

    const payload = await upstream.json().catch(() => ({}))

    console.log(
      `Groq request: model=${model}, status=${upstream.status}, duration=${Date.now() - startedAt}ms`
    )

    if (!upstream.ok) {
      const providerMessage = payload?.error?.message || ''

      console.error('Groq API error:', upstream.status, providerMessage)

      if (upstream.status === 429) {
        return send(res, 429, {
          error: 'Groq rate limit reached. Please wait before trying again.'
        })
      }

      if (upstream.status === 503 || upstream.status >= 500) {
        return send(res, 503, {
          error: 'Groq is temporarily unavailable. Please try again shortly.'
        })
      }

      return send(res, 502, {
        error: `Groq returned an error (${upstream.status}). Check the server logs.`
      })
    }

    const rawText = payload?.choices?.[0]?.message?.content

    if (!rawText) {
      return send(res, 502, {
        error: 'Groq returned an empty response. Please retry.'
      })
    }

    let studySet

    try {
      studySet = JSON.parse(rawText)
    } catch {
      return send(res, 502, {
        error: 'The AI returned malformed JSON. Please retry.'
      })
    }

    const validationError = validateStudySet(studySet)

    if (validationError) {
      console.error('Study set validation failed:', validationError)

      return send(res, 502, {
        error: `${validationError} Please retry.`
      })
    }

    return send(res, 200, { data: studySet })

  } catch (error) {
    console.error('Groq request failed:', error)

    if (error.name === 'AbortError') {
      return send(res, 504, {
        error: 'Groq took longer than 60 seconds to respond. Please retry.'
      })
    }

    return send(res, 502, {
      error: 'Could not connect to Groq. Check your connection and retry.'
    })

  } finally {
    clearTimeout(timeout)
  }
}


function send(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(value))
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf' }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  if (req.url === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, configured: Boolean(process.env.GROQ_API_KEY) })
  if (req.url === '/api/generate' && req.method === 'POST') {
    try { return await generate(req, res) } catch (error) { return send(res, 400, { error: error.message || 'Invalid request.' }) }
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' })

  // Production mode serves the Vite build. During development, Vite serves the frontend.
  const pathname = decodeURIComponent((req.url || '/').split('?')[0])
  const safePath = normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/, '')
  let filePath = join(ROOT, 'dist', safePath || 'index.html')
  try {
    const content = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': `${mime[extname(filePath)] || 'application/octet-stream'}; charset=utf-8` })
    return res.end(content)
  } catch {
    try {
      filePath = join(ROOT, 'dist', 'index.html')
      const content = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(content)
    } catch {
      return send(res, 503, { error: 'Production build not found. Run npm run build first.' })
    }
  }
})

server.listen(PORT, () => console.log(`STUDY//LAB server listening on http://localhost:${PORT}`))
