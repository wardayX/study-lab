# STUDY//LAB

**An experiment in structured learning.**

STUDY//LAB transforms study notes or a topic into interactive flashcards, a multiple-choice assessment, and a targeted revision list.

## Product experience

1. **Source** — Paste study notes or enter a topic.
2. **Cards** — Flip flashcards, mark concepts as known or needing practice, and track progress.
3. **Assess** — Answer multiple-choice questions, receive immediate feedback and explanations, and see your score.
4. **Revisit** — Review missed flashcards and quiz questions, then retest only the incorrect quiz questions.

The sample MOSFET study set makes the application usable without an API key.

## Design direction

The visual system extends the black and off-white typographic identity of my portfolio into a spatial-editorial learning workspace. It reuses selected portfolio typography (New Title, Clash Grotesk, Nippo and Boska), with an ivory and charcoal palette, signal-green accents, technical labels and an orbital knowledge graphic.

Motion is restrained and respects `prefers-reduced-motion`. The interface uses CSS-based visual elements rather than a full WebGL scene to keep the learning workflow lightweight.

## Stack

- React 19, TypeScript and Vite
- GSAP for restrained entrance motion
- CSS for responsive layouts and interactive card states
- Node.js built-in HTTP server for the API
- Groq API with GPT-OSS 120B for structured AI generation
- Runtime response validation on both server and client
- AbortController and request sequencing for request cancellation and stale-response protection

The API key is stored on the server and is never exposed to the browser.

## Run locally

**Requirements:** Node.js 20+ and npm.

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Add your Groq API credentials to `.env`:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
PORT=8787
```

Start both the API and frontend:

```bash
npm start
```

Open [http://localhost:5173](http://localhost:5173).

Vite proxies `/api` requests to the Node API running on port 8787.

Additional development commands:

```bash
npm run dev
npm run server
```

- `npm run dev` starts the API and Vite development server.
- `npm run server` starts only the API server.

### Production build

```bash
npm run build
npm run start:production
```

Open [http://localhost:8787](http://localhost:8787) after the build completes.

## API behaviour and failure handling

- `GET /api/health` reports whether the server has an AI API key configured. It never returns the key.
- `POST /api/generate` accepts `{ "notes": "..." }`.
- The API rejects malformed requests, inputs below the minimum length and oversized inputs.
- Groq is instructed to return structured JSON containing a title, subject, summary, flashcards and quiz questions.
- The server validates the generated data before returning it.
- The frontend validates the response again before updating React state.
- Empty, malformed or structurally invalid AI output is rejected rather than rendered.
- Request timeouts are handled with an error response.
- The browser can abort an older request when a new generation starts. A request-sequence guard prevents stale responses from replacing newer results.
- Provider errors and rate limits are presented as readable error messages.
- The sample study set remains available through demo mode when live generation is unavailable.

API keys are read from server-side environment variables and must never be committed to the repository.

## AI usage note

Groq's GPT-OSS 120B model generates draft flashcards, quiz questions, answer keys and explanations from the supplied material.

The application requests structured JSON, validates the response on the server and again in the browser, and renders the resulting data as interactive React components.

The sample MOSFET study set is static demo content, not an AI response.

AI-generated educational content can contain errors. Users should verify important facts against their original study material.

AI assistance was used for planning, implementation scaffolding, code review and debugging. The implementation has been reviewed and adapted for this project. I should be able to explain the component structure, state transitions, API flow and validation decisions during the interview.

## Known limitations

- No authentication or cloud persistence; study sessions reset on refresh.
- Live generation requires a valid Groq API key and is subject to provider rate limits and availability.
- Only flashcards and four-option multiple-choice questions are currently supported.
- The interface uses a lightweight CSS orbital graphic rather than a full WebGL scene.
- AI-generated content should be checked against the original course material.
- The application depends on the availability of the configured AI provider for live generation. Demo mode is available independently.

## Time spent

Record the actual implementation, debugging and testing time before submission.

The assignment recommends approximately eight hours of work. If the work exceeds that target, report the actual time honestly.

## Attribution

Selected font assets and the visual starting point are reused from my personal portfolio.

The STUDY//LAB application logic and learning workflow were developed for this assignment.

Retain the accompanying font license files when redistributing the font assets.

## Live deployment (Render)

A single Node web service can host both the built Vite frontend and the API.

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm run start:production`

Configure the following environment variables in the Render service dashboard:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
```

Render supplies the `PORT` environment variable automatically. The server reads it at startup.

The repository includes `render.yaml` as a starting point for a Render Blueprint deployment.

After deployment:

1. Open the deployed application URL.
2. Visit `/api/health` and verify that `configured` is `true`.
3. Test a real AI generation.
4. Verify demo mode and the interactive learning workflow.
5. Test the deployed application on mobile.

Never commit `.env` or expose the Groq API key in frontend code.
