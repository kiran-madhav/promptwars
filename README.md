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
- [Google Gemini API](https://ai.google.dev/) (gemini-2.0-flash)

## Architecture

```
app/
  page.tsx              # Main page (upload → analyze → report)
  layout.tsx            # Root layout
  globals.css           # Global styles
  api/
    analyze/route.ts    # POST /api/analyze — server-side Gemini call

components/
  Header.tsx            # Navigation header
  Hero.tsx              # Landing hero section
  UploadZone.tsx        # Drag-and-drop image upload
  LoadingState.tsx      # Analysis progress indicator
  VerificationReport.tsx # Full structured result display

lib/
  types.ts              # Shared TypeScript types
  gemini.ts             # Gemini API client (server-side only)
```
