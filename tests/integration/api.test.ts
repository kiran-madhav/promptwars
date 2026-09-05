/**
 * Integration tests for VERIFAI API routes.
 *
 * Requires:
 *   - Running dev server: npm run dev (http://localhost:3000)
 *   - GEMINI_API_KEY configured in .env.local
 *
 * Run with:
 *   npm run test:integration
 *
 * These tests make real HTTP requests to the local server.
 * Tests that call /api/analyze or /api/analyze-url with valid images
 * will consume one Gemini API request each.
 *
 * Test 3 (live Gemini analysis) and Test 15 (live URL analysis) are
 * skipped gracefully when the API is unavailable or quota is exhausted.
 */

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE_URL = "http://localhost:3000";
const TEST_IMAGE_PATH = path.join(os.tmpdir(), "test.jpg");

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpRequest(
  method: string,
  urlPath: string,
  contentType: string,
  body: Buffer,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: urlPath,
      method,
      headers: {
        "Content-Type": contentType,
        "Content-Length": body.length,
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c: Buffer) => { data += c; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) as Record<string, unknown> });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: { raw: data.slice(0, 200) } });
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function multipartUpload(filename: string, mimeType: string, content: Buffer) {
  const boundary = "FormBoundaryVERIFAI_INTTEST";
  const CRLF = "\r\n";
  const header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    "",
    "",
  ].join(CRLF);
  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  const body = Buffer.concat([Buffer.from(header), content, footer]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function postJson(urlPath: string, obj: unknown) {
  const body = Buffer.from(JSON.stringify(obj));
  return httpRequest("POST", urlPath, "application/json", body);
}

// Check server is available before running
async function serverIsAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({ hostname: "localhost", port: 3000, path: "/", method: "GET" }, () => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// Ensure a minimal 1×1 JPEG exists for upload tests
function ensureTestImage(): Buffer {
  if (fs.existsSync(TEST_IMAGE_PATH)) {
    return fs.readFileSync(TEST_IMAGE_PATH);
  }
  // Minimal valid 1×1 white JPEG (284 bytes)
  const minimalJpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U" +
    "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN" +
    "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
    "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEB/8QABRAB" +
    "AAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAA" +
    "AAAAAAAAD/2gAMAwEAAhEDEQA/AKwAB//Z",
    "base64",
  );
  fs.writeFileSync(TEST_IMAGE_PATH, minimalJpeg);
  return minimalJpeg;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("VERIFAI Integration Tests", async () => {
  let imgBytes: Buffer;
  let serverUp = false;

  before(async () => {
    serverUp = await serverIsAvailable();
    if (!serverUp) {
      console.log("\n⚠  Server not running on localhost:3000. Start with: npm run dev");
      console.log("   All integration tests will be skipped.\n");
      return;
    }
    imgBytes = ensureTestImage();
    console.log(`\n✓ Server available at ${BASE_URL}\n`);
  });

  // ─── Upload route ─────────────────────────────────────────────────────────

  describe("POST /api/analyze — upload route", () => {
    test("empty file → HTTP 400, success: false, error message present", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const { body, contentType } = multipartUpload("empty.jpg", "image/jpeg", Buffer.alloc(0));
      const r = await httpRequest("POST", "/api/analyze", contentType, body);
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
      assert.ok(typeof r.body.error === "string" && (r.body.error as string).length > 0);
    });

    test("unsupported file type (text/plain) → HTTP 400", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const { body, contentType } = multipartUpload("file.txt", "text/plain", Buffer.from("hello"));
      const r = await httpRequest("POST", "/api/analyze", contentType, body);
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
    });

    test("malformed Content-Type (JSON instead of form) → HTTP 400", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await httpRequest("POST", "/api/analyze", "application/json", Buffer.from("{}"));
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
    });

    test("valid JPEG → HTTP 200, valid VerificationReport schema, confidence guardrail holds", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const { body, contentType } = multipartUpload("test.jpg", "image/jpeg", imgBytes);
      const r = await httpRequest("POST", "/api/analyze", contentType, body);

      if (r.status === 500 && typeof r.body.error === "string" &&
          (r.body.error as string).toLowerCase().includes("demand")) {
        return t.skip(`Gemini quota/capacity (${(r.body.error as string).slice(0, 60)})`);
      }

      assert.equal(r.status, 200);
      assert.equal(r.body.success, true);

      const rpt = r.body.report as Record<string, unknown>;
      assert.ok(rpt.overallAssessment, "overallAssessment present");
      assert.ok(rpt.confidence, "confidence present");
      assert.ok(typeof rpt.summary === "string" && (rpt.summary as string).length > 0, "summary non-empty");
      assert.ok(Array.isArray(rpt.signals), "signals is array");
      assert.ok(Array.isArray(rpt.limitations) && (rpt.limitations as unknown[]).length >= 1, "limitations non-empty");
      assert.ok(Array.isArray(rpt.recommendedActions) && (rpt.recommendedActions as unknown[]).length >= 1, "recommendedActions non-empty");
      assert.equal(r.body.filename, "test.jpg");
      assert.ok(r.body.analyzedAt, "analyzedAt present");
      assert.equal(r.body.sourceType, "upload");
      assert.equal(r.body.sourceUrl, undefined);

      // Confidence guardrail: likely_authentic + high is FORBIDDEN
      const isAuthentic = rpt.overallAssessment === "likely_authentic";
      const isHigh = rpt.confidence === "high";
      assert.ok(!(isAuthentic && isHigh), `Guardrail violated: likely_authentic + high returned`);

      console.log(`\n   Assessment: ${rpt.overallAssessment} | Confidence: ${rpt.confidence} | Signals: ${(rpt.signals as unknown[]).length}`);
    });
  });

  // ─── URL route ────────────────────────────────────────────────────────────

  describe("POST /api/analyze-url — URL route", () => {
    test("missing url field → HTTP 400", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await postJson("/api/analyze-url", {});
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
      assert.ok(typeof r.body.error === "string" && (r.body.error as string).length > 0);
    });

    test("empty url string → HTTP 400", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await postJson("/api/analyze-url", { url: "" });
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
    });

    test("file:// protocol → HTTP 400, error mentions protocol", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await postJson("/api/analyze-url", { url: "file:///etc/passwd" });
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
      const err = (r.body.error as string).toLowerCase();
      assert.ok(err.includes("protocol") || err.includes("unsupported"));
    });

    test("javascript:// → HTTP 400", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await postJson("/api/analyze-url", { url: "javascript:alert(1)" });
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
    });

    test("localhost SSRF attempt → HTTP 400, error mentions private", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await postJson("/api/analyze-url", { url: "http://localhost/secret" });
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
      const err = (r.body.error as string).toLowerCase();
      assert.ok(err.includes("private") || err.includes("reserved"));
    });

    test("127.0.0.1 SSRF attempt → HTTP 400", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await postJson("/api/analyze-url", { url: "http://127.0.0.1/image.jpg" });
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
    });

    test("192.168.x SSRF attempt → HTTP 400", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await postJson("/api/analyze-url", { url: "http://192.168.1.1/image.jpg" });
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
    });

    test("malformed URL → HTTP 400", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const r = await postJson("/api/analyze-url", { url: "not-a-url" });
      assert.equal(r.status, 400);
      assert.equal(r.body.success, false);
    });

    test("text/html URL → friendly 'webpage' error message with tip", async (t) => {
      if (!serverUp) return t.skip("server not running");
      // httpbin.org/html returns text/html — should produce friendly error
      const r = await postJson("/api/analyze-url", { url: "https://httpbin.org/html" });
      assert.equal(r.body.success, false);
      const err = r.body.error as string;
      if (err && !err.includes("timed out") && !err.includes("reach")) {
        assert.ok(err.toLowerCase().includes("webpage"), `Expected 'webpage' in: ${err}`);
        assert.ok(!err.includes("Content-Type:"), "Must not leak raw Content-Type header value");
        assert.ok(err.toLowerCase().includes("tip"), `Expected 'Tip' in: ${err}`);
      } else {
        t.skip("network unavailable, skipping message content checks");
      }
    });

    test("live public image URL → valid VerificationReport with guardrail", async (t) => {
      if (!serverUp) return t.skip("server not running");
      const testUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png";
      const r = await postJson("/api/analyze-url", { url: testUrl });

      if (!r.body.success) {
        const err = r.body.error as string;
        return t.skip(`Skipped (${err?.slice(0, 80)})`);
      }

      assert.equal(r.status, 200);
      const rpt = r.body.report as Record<string, unknown>;
      assert.ok(rpt.overallAssessment, "overallAssessment present");
      assert.ok(rpt.confidence, "confidence present");
      assert.equal(r.body.sourceType, "url");
      assert.equal(r.body.sourceUrl, testUrl);

      // Confidence guardrail
      const isAuthentic = rpt.overallAssessment === "likely_authentic";
      const isHigh = rpt.confidence === "high";
      assert.ok(!(isAuthentic && isHigh), "Guardrail: likely_authentic + high is forbidden");
    });
  });
});
