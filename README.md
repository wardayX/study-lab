# STUDY//LAB

**An experiment in structured learning.**

STUDY//LAB is a lightweight AI-powered study assistant that transforms study notes or a topic into interactive flashcards, a multiple-choice assessment and a targeted revision list.

Instead of displaying raw AI-generated text, it converts structured model output into an interactive learning experience built around active recall and revision.

## Product experience

The application follows a four-stage learning workflow:

1. **Source** — Paste lecture notes, textbook excerpts or enter a topic you want to understand.
2. **Cards** — Review generated flashcards, reveal answers, mark concepts as known or needing practice, and track progress through the deck.
3. **Assess** — Take a multiple-choice quiz with immediate feedback, answer explanations and a final score.
4. **Revisit** — Review concepts that need attention, revisit incorrect quiz questions and retest only the questions answered incorrectly.

A sample MOSFET fundamentals study set is included so the application can be explored without making an AI API request.

## Design direction

The visual identity extends the black and off-white typographic language of my personal portfolio into a spatial-editorial learning workspace.

Selected portfolio typography is reused:
- New Title
- Clash Grotesk
- Nippo
- Boska

The interface uses an ivory and charcoal palette, signal-green accents, technical labels, restrained motion and a CSS-based orbital knowledge graphic.

The design prioritizes readable content, clear learning states and a responsive layout. Motion respects `prefers-reduced-motion`.

## Technology stack

**Frontend**
- React 19
- TypeScript
- Vite
- CSS for responsive layouts and interactive states
- GSAP for restrained entrance animations

**Backend**
- Node.js built-in HTTP server
- Server-side API integration
- Environment-based API key management

**AI**
- Groq API
- GPT-OSS 120B (`openai/gpt-oss-120b`)
- Structured JSON output

**Deployment**
- Render free web service
- GitHub repository

No API key is exposed in the browser.

## How the application works

The generation workflow is separated into frontend, backend and AI responsibilities.

1. The user enters study material in the React interface.
2. The frontend sends the input to `POST /api/generate`.
3. The Node.js backend validates the request and communicates with the Groq API.
4. The model is instructed to return structured study data.
5. The backend parses and validates the generated response.
6. The validated data is returned to the frontend.
7. The frontend performs an additional validation check before updating React state.
8. React renders the result as interactive flashcards, quiz questions and revision items.

The generated study set contains:
- A title and subject
- A short summary
- Flashcards with questions, answers, explanations and difficulty levels
- Multiple-choice questions with four options, a correct-answer index and explanations

The application uses structured data rather than rendering the model's raw response.

## API behaviour and failure handling

Handling unpredictable AI output is an important part of the implementation.

The application includes the following safeguards:

- **Input validation:** Rejects requests that are too short, empty or exceed the supported input length.
- **Request validation:** Handles malformed request bodies and invalid input.
- **Structured response validation:** Checks required fields, array sizes, difficulty values, quiz options and answer indices.
- **Client-side validation:** Validates the returned study set again before updating the UI.
- **Empty and malformed output:** Rejects unusable AI responses instead of attempting to render them.
- **Request timeout:** Aborts requests that exceed the configured time limit.
- **Provider errors:** Handles API failures and rate-limit responses with readable error messages.
- **Stale response protection:** Uses request cancellation and a request-sequence guard so an older response cannot overwrite a newer generation.
- **Loading and error states:** Provides feedback while generation is in progress or when a request fails.
- **Demo fallback:** Keeps the sample MOSFET study set available independently of live AI generation.

The API exposes two main endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Checks API availability and whether an AI key is configured |
| POST | `/api/generate` | Generates a structured study set from user input |

The health endpoint reports configuration status without returning the API key.

## Run locally

### Requirements

- Node.js 20 or later
- npm
- A Groq API key for live AI generation

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd STUDY-LAB
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file using the supplied example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Add your Groq credentials:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
PORT=8787
```

Obtain an API key from the [Groq Console](https://console.groq.com/).

Never commit `.env` or expose the API key in frontend code.

### 4. Start the application

```bash
npm start
```

Open:

```text
http://localhost:5173
```

The development setup starts the Node.js API and Vite frontend. Vite proxies `/api` requests to the backend on port 8787.

### Additional commands

```bash
npm run dev
```

Starts the API and Vite development server.

```bash
npm run server
```

Starts only the API server.

### Production build

```bash
npm run build
npm run start:production
```

Open:

```text
http://localhost:8787
```

## AI provider and free-tier usage

STUDY//LAB currently uses Groq's free API tier with the GPT-OSS 120B model.

The free tier was selected to keep the project usable without requiring a paid AI subscription.

Free-tier usage is subject to provider rate limits, availability and usage policies. Live generation may temporarily fail if the provider is unavailable or the account reaches its limits.

The application retains its sample study set so its core interactive workflow can still be demonstrated without a successful AI request.

## Deployment

The application is deployed using a single Node.js web service on Render.

The same service hosts:
- The production-built React frontend
- The Node.js API
- The server-side Groq integration

**Hosting:** Render free tier  
**AI provider:** Groq free tier

### Render configuration

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm run start:production
```

Configure these environment variables in the Render service dashboard:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
```

Render supplies the `PORT` environment variable automatically.

The repository includes `render.yaml` as a starting point for a Render Blueprint deployment.

After deployment, check:

```text
https://YOUR-RENDER-URL.onrender.com/api/health
```

Verify that the response reports:

```json
{
  "ok": true,
  "configured": true
}
```

Then test an actual AI generation through the public application.

**Free-tier considerations:** Render's free service may spin down after inactivity, so the first request after a period of inactivity can take longer. Groq's free API tier is also subject to usage limits and provider availability.

## AI usage and acknowledgement

AI tools were used during the development process for planning, implementation assistance, code review, debugging and refining parts of the application.

Groq's GPT-OSS 120B model is used at runtime to generate draft flashcards, quiz questions, answer keys and explanations.

The application does not blindly trust the generated response. It parses and validates the structured output on the backend and checks it again on the frontend before rendering it.

The sample MOSFET study set is static demonstration data and is not generated by the AI model.

AI-generated educational content can contain inaccuracies. Users should verify important information against their original study material.

The implementation has been reviewed and adapted for this project. I should be able to explain the component structure, React state transitions, API integration, validation and error-handling decisions during the technical interview.

## Known limitations

- There is no user authentication or cloud-based session persistence. Study sessions reset when the page is refreshed.
- Live generation requires a valid Groq API key configured on the server.
- AI generation is subject to free-tier rate limits and provider availability.
- The application currently supports flashcards and four-option multiple-choice questions rather than multiple arbitrary content block types.
- AI-generated answers and explanations may contain errors and should be verified.
- The application uses a lightweight CSS-based orbital graphic rather than a full WebGL scene.
- Streaming generation and follow-up refinement of existing study sets are not currently implemented.
- Demo content is limited to the included MOSFET fundamentals example.

## Development time

**Actual development time: approximately 3 hours.**

This includes the implementation of the core learning workflow, frontend styling, AI integration, response validation and initial testing.

The project was developed within the assignment's recommended eight-hour time limit.

## Attribution

Selected font assets and the visual starting point are reused from my personal portfolio.

The STUDY//LAB application logic, learning workflow and project-specific implementation were developed for this assignment.

The accompanying font license files should be retained when redistributing the font assets.

