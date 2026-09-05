# VERIFAI

> **Before you trust it. Before you share it.**

An AI-assisted media verification platform that helps detect, understand, and verify potentially AI-generated or manipulated images.

## What it does

Upload an image to receive a structured verification report including:

- **Overall assessment** — likely authentic / potentially manipulated / likely synthetic / inconclusive
- **Observable signals** — specific evidence with explanations
- **Source context** — provenance and metadata observations
- **Limitations** — what this analysis cannot determine
- **Recommended next steps** — concrete actions to verify further

## Important

This tool provides **probabilistic AI-assisted analysis**, not definitive forensic proof. Results should be used as one input in a broader verification process.

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy the environment template: `cp .env.local.example .env.local`
4. Add your Gemini API key to `.env.local`
5. Run the development server: `npm run dev`
6. Open [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) |

**Never commit `.env.local` or any real API keys.**

## Tech stack

- [Next.js](https://nextjs.org/) (App Router)
- TypeScript
- Tailwind CSS
- [Google Gemini API](https://ai.google.dev/) (gemini-3.7-flash primary, gemini-3.6-flash fallback)

## Architecture

```
app/
  page.tsx                  # Main page (upload → analyze → report)
  layout.tsx                # Root layout
  globals.css               # Global styles
  api/
    analyze/route.ts        # POST /api/analyze — file upload pipeline
    analyze-url/route.ts    # POST /api/analyze-url — URL fetch pipeline

components/
  Header.tsx                # Navigation header
  Hero.tsx                  # Landing hero + media-type tabs
  UploadZone.tsx            # Drag-and-drop image upload
  UrlInput.tsx              # Direct image URL input
  ComingSoon.tsx            # Placeholder for audio/video modes
  LoadingState.tsx          # Analysis progress indicator
  VerificationReport.tsx    # Structured result display

lib/
  types.ts                  # Shared TypeScript types
  gemini.ts                 # Gemini API client with fallback (server-side only)
  urlFetch.ts               # Safe URL fetch with SSRF protection

tests/
  unit/                     # Deterministic tests — no API key, no server required
    urlFetch.test.ts        # URL validation and SSRF protection (30+ cases)
    gemini.test.ts          # Confidence guardrails and fallback routing (15+ cases)
    analyze-route.test.ts   # API input validation contract (20+ cases)
  integration/
    api.test.ts             # Live HTTP tests — requires running server + API key
```

## Testing

### Unit tests (no API key required)

```bash
npm test
```

Runs entirely deterministic tests using Node.js built-in `node:test`. No external
test framework, no network calls, no API key needed. Safe to run in CI or offline.

**What the unit tests cover:**

| Test file | What it verifies |
|---|---|
| `tests/unit/urlFetch.test.ts` | URL validation: protocol allowlist, SSRF/private-IP blocklist (RFC-1918, loopback, link-local, CGNAT, IPv6 ULA), public addresses accepted |
| `tests/unit/gemini.test.ts` | Confidence guardrail (`likely_authentic + high` always clamped to `medium`), Gemini fallback routing (429/500/503 → fallback, 401/400 → no fallback, max 2 attempts) |
| `tests/unit/analyze-route.test.ts` | Accepted/rejected MIME types, 10 MB file-size limit, Content-Type error message classification (text/html → friendly webpage message) |

### Integration tests (requires running server + API key)

```bash
npm run dev          # in one terminal
npm run test:integration   # in another
```

Makes real HTTP requests to `localhost:3000`. Tests that call Gemini with a live image
consume one API request each. Tests gracefully skip when the server is unavailable or
Gemini quota is exhausted.
