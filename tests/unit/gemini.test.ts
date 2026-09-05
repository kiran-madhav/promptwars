/**
 * Unit tests for lib/gemini.ts
 *
 * Covers:
 *   enforceConfidenceLimits()
 *     - All verdict × confidence combinations
 *     - Summary is patched when clamped
 *     - Correct verdicts pass through unchanged
 *
 *   analyzeImageWithGemini() — fallback routing (mocked fetch, no Gemini calls)
 *     - Primary success: exactly 1 fetch, no fallback
 *     - Primary 429 → fallback to gemini-3.6-flash (exactly 2 fetches)
 *     - Primary 500 → fallback to gemini-3.6-flash
 *     - Primary 503 → fallback to gemini-3.6-flash
 *     - Auth error (401) → NO fallback, throws immediately
 *     - Bad request (400) → NO fallback, throws immediately
 *     - No fallback key configured → NO second attempt
 *     - Both models fail → throws after exactly 2 attempts
 *     - Maximum 2 Gemini requests per user analysis
 *
 * No real Gemini API calls are made. No API key required.
 */

import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enforceConfidenceLimits, analyzeImageWithGemini } from "../../lib/gemini.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReport(overallAssessment: string, confidence: string) {
  return {
    overallAssessment: overallAssessment as "likely_authentic" | "likely_synthetic" | "potentially_manipulated" | "inconclusive",
    confidence: confidence as "low" | "medium" | "high",
    summary: "Test summary.",
    signals: [],
    sourceSignals: [],
    metadataObservations: [],
    limitations: ["limitation one", "limitation two"],
    recommendedActions: ["action one", "action two"],
  };
}

function okGeminiResponse(overallAssessment = "inconclusive", confidence = "low") {
  const report = makeReport(overallAssessment, confidence);
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(report) }] } }],
    }),
  } as unknown as Response;
}

function errorGeminiResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message } }),
  } as unknown as Response;
}

// ─── enforceConfidenceLimits ──────────────────────────────────────────────────

describe("enforceConfidenceLimits — confidence guardrail", () => {
  test("likely_authentic + high is clamped to medium", () => {
    const result = enforceConfidenceLimits(makeReport("likely_authentic", "high"));
    assert.equal(result.confidence, "medium");
    assert.equal(result.overallAssessment, "likely_authentic");
  });

  test("summary is patched with capped-confidence notice when clamped", () => {
    const result = enforceConfidenceLimits(makeReport("likely_authentic", "high"));
    assert.ok(result.summary.includes("Confidence has been capped"));
  });

  test("likely_authentic + medium passes through unchanged", () => {
    const input = makeReport("likely_authentic", "medium");
    const result = enforceConfidenceLimits(input);
    assert.equal(result.confidence, "medium");
    assert.equal(result.summary, input.summary); // summary NOT patched
  });

  test("likely_authentic + low passes through unchanged", () => {
    const result = enforceConfidenceLimits(makeReport("likely_authentic", "low"));
    assert.equal(result.confidence, "low");
  });

  test("likely_synthetic + high is NOT clamped", () => {
    const result = enforceConfidenceLimits(makeReport("likely_synthetic", "high"));
    assert.equal(result.confidence, "high");
    assert.equal(result.overallAssessment, "likely_synthetic");
  });

  test("potentially_manipulated + high is NOT clamped", () => {
    const result = enforceConfidenceLimits(makeReport("potentially_manipulated", "high"));
    assert.equal(result.confidence, "high");
  });

  test("inconclusive + high is NOT clamped", () => {
    const result = enforceConfidenceLimits(makeReport("inconclusive", "high"));
    assert.equal(result.confidence, "high");
  });
});

// ─── analyzeImageWithGemini — fallback routing (mocked fetch) ─────────────────

describe("analyzeImageWithGemini — fallback routing", () => {
  // Capture originals so each test starts clean
  const savedFetch = global.fetch;
  const savedFallbackKey = process.env.GEMINI_FALLBACK_API_KEY;

  afterEach(() => {
    // Restore global fetch and fallback key after every test
    global.fetch = savedFetch;
    if (savedFallbackKey === undefined) {
      delete process.env.GEMINI_FALLBACK_API_KEY;
    } else {
      process.env.GEMINI_FALLBACK_API_KEY = savedFallbackKey;
    }
  });

  test("primary success: exactly 1 fetch call to gemini-3.7-flash", async () => {
    const calls: string[] = [];
    global.fetch = async (url: string | URL | Request) => {
      calls.push(String(url));
      return okGeminiResponse();
    };

    await analyzeImageWithGemini("base64data", "image/jpeg", "primary-key");

    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("gemini-3.7-flash"), `Expected 3.7-flash in first call URL, got: ${calls[0]}`);
  });

  test("primary 429 → fallback to gemini-3.6-flash (2 total calls)", async () => {
    process.env.GEMINI_FALLBACK_API_KEY = "fallback-test-key";
    const calls: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      return u.includes("gemini-3.7-flash")
        ? errorGeminiResponse(429, "Quota exceeded")
        : okGeminiResponse();
    };

    const result = await analyzeImageWithGemini("base64data", "image/jpeg", "primary-key");

    assert.equal(calls.length, 2);
    assert.ok(calls[0].includes("gemini-3.7-flash"), "First call must be to primary (3.7)");
    assert.ok(calls[1].includes("gemini-3.6-flash"), "Second call must be to fallback (3.6)");
    // Result should come from fallback and be valid
    assert.ok(["likely_authentic", "likely_synthetic", "potentially_manipulated", "inconclusive"]
      .includes(result.overallAssessment));
  });

  test("primary 500 → fallback triggered (2 total calls)", async () => {
    process.env.GEMINI_FALLBACK_API_KEY = "fallback-test-key";
    const calls: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      return u.includes("gemini-3.7-flash")
        ? errorGeminiResponse(500, "Internal server error")
        : okGeminiResponse();
    };

    await analyzeImageWithGemini("base64data", "image/jpeg", "primary-key");

    assert.equal(calls.length, 2);
    assert.ok(calls[1].includes("gemini-3.6-flash"));
  });

  test("primary 503 → fallback triggered (2 total calls)", async () => {
    process.env.GEMINI_FALLBACK_API_KEY = "fallback-test-key";
    const calls: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      return u.includes("gemini-3.7-flash")
        ? errorGeminiResponse(503, "Service unavailable")
        : okGeminiResponse();
    };

    await analyzeImageWithGemini("base64data", "image/jpeg", "primary-key");
    assert.equal(calls.length, 2);
  });

  test("auth error (401) does NOT trigger fallback — throws after 1 call", async () => {
    process.env.GEMINI_FALLBACK_API_KEY = "fallback-test-key";
    const calls: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      calls.push(String(url));
      return errorGeminiResponse(401, "API key not valid");
    };

    await assert.rejects(
      () => analyzeImageWithGemini("base64data", "image/jpeg", "bad-key"),
      /API key not valid/,
    );
    assert.equal(calls.length, 1, "Auth error must not trigger fallback");
  });

  test("bad request (400) does NOT trigger fallback — throws after 1 call", async () => {
    process.env.GEMINI_FALLBACK_API_KEY = "fallback-test-key";
    const calls: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      calls.push(String(url));
      return errorGeminiResponse(400, "Invalid request");
    };

    await assert.rejects(
      () => analyzeImageWithGemini("base64data", "image/jpeg", "primary-key"),
    );
    assert.equal(calls.length, 1, "Client error must not trigger fallback");
  });

  test("no fallback key configured → no second attempt, throws after 1 call", async () => {
    delete process.env.GEMINI_FALLBACK_API_KEY;
    const calls: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      calls.push(String(url));
      return errorGeminiResponse(429, "Quota exceeded");
    };

    await assert.rejects(
      () => analyzeImageWithGemini("base64data", "image/jpeg", "primary-key"),
    );
    assert.equal(calls.length, 1, "Without fallback key, must not make a second request");
  });

  test("both models failing: error thrown after exactly 2 total attempts", async () => {
    process.env.GEMINI_FALLBACK_API_KEY = "fallback-test-key";
    const calls: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      calls.push(String(url));
      return errorGeminiResponse(429, "Quota exceeded on all endpoints");
    };

    await assert.rejects(
      () => analyzeImageWithGemini("base64data", "image/jpeg", "primary-key"),
      /Quota exceeded/,
    );
    assert.equal(calls.length, 2, "Must attempt primary + fallback, no more");
  });

  test("maximum 2 Gemini requests per user analysis regardless of failures", async () => {
    process.env.GEMINI_FALLBACK_API_KEY = "fallback-test-key";
    const calls: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      calls.push(String(url));
      return errorGeminiResponse(500, "Keeps failing");
    };

    await assert.rejects(() => analyzeImageWithGemini("base64data", "image/jpeg", "primary-key"));
    assert.ok(calls.length <= 2, `Must never exceed 2 requests. Made: ${calls.length}`);
  });
});
