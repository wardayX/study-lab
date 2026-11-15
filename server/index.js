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
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    subject: { type: 'STRING' },
    summary: { type: 'STRING' },
    flashcards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          answer: { type: 'STRING' },
          explanation: { type: 'STRING' },
          difficulty: { type: 'STRING', enum: ['Easy', 'Medium', 'Hard'] },
        },
        required: ['question', 'answer', 'explanation', 'difficulty'],
      },
    },
    quiz: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          correctAnswer: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
          difficulty: { type: 'STRING', enum: ['Easy', 'Medium', 'Hard'] },
        },
        required: ['question', 'options', 'correctAnswer', 'explanation', 'difficulty'],
      },
    },
  },
  required: ['title', 'subject', 'summary', 'flashcards', 'quiz'],
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
  if (notes.length < 20) return send(res, 400, { error: 'Add at least 20 characters so the AI has enough material to work with.' })
  if (notes.length > 20_000) return send(res, 400, { error: 'Your notes are too long. Keep them under 20,000 characters.' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return send(res, 503, { error: 'The AI service is not configured yet. Add GEMINI_API_KEY to your .env file and restart the server.' })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are STUDY//LAB, a precise learning-material generator. Use only the supplied source material. Do not invent facts. If the material is too thin, make fewer questions rather than adding unsupported facts. Return valid JSON matching the schema. Generate 6 to 10 flashcards and 5 to 8 multiple-choice questions. Each quiz must have exactly four options and correctAnswer must be a zero-based index. Keep explanations concise and useful.' }] },
        contents: [{ role: 'user', parts: [{ text: `Turn the following material into a compact study set. Preserve the source terminology and do not add unsupported claims.\n\nSOURCE MATERIAL:\n${notes}` }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.35 },
      }),
    })
    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      const message = payload?.error?.message || `AI provider returned HTTP ${upstream.status}.`
      return send(res, upstream.status === 429 ? 429 : 502, { error: message })
    }
    const rawText = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''
    let studySet
    try { studySet = JSON.parse(rawText) } catch { return send(res, 502, { error: 'The AI returned malformed JSON. Try generating again.' }) }
    const validationError = validateStudySet(studySet)
    if (validationError) return send(res, 502, { error: `${validationError} Try generating again.` })
    return send(res, 200, { data: studySet })
  } catch (error) {
    const message = error.name === 'AbortError' ? 'The AI request took too long. Please retry.' : 'Could not reach the AI service. Check your connection and retry.'
    return send(res, 502, { error: message })
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
  if (req.url === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, configured: Boolean(process.env.GEMINI_API_KEY) })
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
