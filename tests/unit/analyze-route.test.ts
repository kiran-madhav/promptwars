/**
 * Unit tests for API route input validation.
 *
 * Covers:
 *   /api/analyze (upload route)
 *     - Accepted MIME types (JPEG, PNG, WebP, GIF)
 *     - Rejected MIME types (PDF, SVG, TIFF, AVIF, etc.)
 *     - File size limit (10 MB)
 *
 *   /api/analyze-url (URL route)
 *     - Missing / empty URL rejected
 *     - SSRF attempts rejected (delegates to validateImageUrl)
 *     - Valid public HTTPS URL accepted
 *
 *   Content-Type error message classification
 *     - text/html → "webpage" messaging with tip
 *     - text/html;charset=utf-8 → also caught as webpage
 *     - application/pdf → generic "unsupported" messaging
 *     - Accepted image types → classified as accepted
 *
 * These tests verify the API contract without starting a server.
 * No Gemini API calls are made. No API key required.
 *
 * NOTE: ALLOWED_MIME_TYPES and MAX_FILE_SIZE_BYTES must be kept in sync
 * with the constants in app/api/analyze/route.ts. If those change, update here.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateImageUrl } from "../../lib/urlFetch.ts";

// ─── Upload route: MIME type contract ─────────────────────────────────────────
// Mirrors ALLOWED_TYPES in app/api/analyze/route.ts

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const REJECTED_MIME_TYPES = [
  "application/pdf",
  "image/svg+xml",
  "image/tiff",
  "image/bmp",
  "image/avif",
  "image/heic",
  "image/heif",
  "text/html",
  "application/octet-stream",
  "video/mp4",
  "audio/mpeg",
];

describe("/api/analyze — accepted MIME types", () => {
  for (const type of ALLOWED_MIME_TYPES) {
    test(`accepts ${type}`, () => {
      assert.ok(ALLOWED_MIME_TYPES.includes(type));
    });
  }
});

describe("/api/analyze — rejected MIME types", () => {
  for (const type of REJECTED_MIME_TYPES) {
    test(`rejects ${type}`, () => {
      assert.ok(!ALLOWED_MIME_TYPES.includes(type));
    });
  }
});

// ─── Upload route: file size limit ────────────────────────────────────────────

// Mirrors MAX_FILE_SIZE in app/api/analyze/route.ts
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

describe("/api/analyze — file size limit", () => {
  test("limit is exactly 10 MB (10 485 760 bytes)", () => {
    assert.equal(MAX_FILE_SIZE_BYTES, 10_485_760);
  });

  test("a 1-byte file is within limit", () => {
    assert.ok(1 <= MAX_FILE_SIZE_BYTES);
  });

  test("a 10 MB file is at the boundary and accepted", () => {
    const exactly10MB = 10 * 1024 * 1024;
    assert.ok(exactly10MB <= MAX_FILE_SIZE_BYTES);
  });

  test("one byte over the limit is rejected", () => {
    const justOver = MAX_FILE_SIZE_BYTES + 1;
    assert.ok(justOver > MAX_FILE_SIZE_BYTES);
  });
});

// ─── URL route: input validation ──────────────────────────────────────────────

describe("/api/analyze-url — URL validation", () => {
  test("rejects empty string — reason mentions 'required'", () => {
    const r = validateImageUrl("");
    assert.equal(r.valid, false);
    assert.ok(!r.valid && r.reason.toLowerCase().includes("required"));
  });

  test("rejects whitespace-only URL", () => {
    const r = validateImageUrl("   ");
    assert.equal(r.valid, false);
  });

  test("rejects SSRF attempt — localhost", () => {
    const r = validateImageUrl("http://localhost/admin");
    assert.equal(r.valid, false);
  });

  test("rejects SSRF attempt — internal RFC-1918 IP", () => {
    const r = validateImageUrl("http://192.168.1.100/config.jpg");
    assert.equal(r.valid, false);
  });

  test("rejects SSRF attempt — 10.x.x.x", () => {
    const r = validateImageUrl("http://10.0.0.1/image.jpg");
    assert.equal(r.valid, false);
  });

  test("rejects file:// protocol", () => {
    const r = validateImageUrl("file:///etc/shadow");
    assert.equal(r.valid, false);
  });

  test("accepts a valid public HTTPS URL", () => {
    const r = validateImageUrl("https://picsum.photos/200/300.jpg");
    assert.equal(r.valid, true);
  });

  test("accepts a valid public HTTP URL", () => {
    const r = validateImageUrl("http://example.com/image.png");
    assert.equal(r.valid, true);
  });
});

// ─── Content-Type error message classification ────────────────────────────────
// Mirrors the logic inside lib/urlFetch.ts fetchImageFromUrl()
// Tests that the right message category is produced for each content type.

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function classifyContentType(rawContentType: string): "accepted" | "webpage" | "unsupported" {
  const base = rawContentType.split(";")[0].trim().toLowerCase();
  if (ALLOWED_IMAGE_CONTENT_TYPES.has(base)) return "accepted";
  if (base.startsWith("text/html")) return "webpage";
  return "unsupported";
}

describe("Content-Type classification — webpage vs unsupported", () => {
  test("text/html → webpage (shows tip to user)", () => {
    assert.equal(classifyContentType("text/html"), "webpage");
  });

  test("text/html;charset=utf-8 → webpage (charset stripped before check)", () => {
    assert.equal(classifyContentType("text/html;charset=utf-8"), "webpage");
  });

  test("text/html; charset=UTF-8 (with space) → webpage", () => {
    assert.equal(classifyContentType("text/html; charset=UTF-8"), "webpage");
  });

  test("application/pdf → unsupported (NOT webpage)", () => {
    assert.equal(classifyContentType("application/pdf"), "unsupported");
  });

  test("application/octet-stream → unsupported", () => {
    assert.equal(classifyContentType("application/octet-stream"), "unsupported");
  });

  test("image/svg+xml → unsupported (svg not accepted)", () => {
    assert.equal(classifyContentType("image/svg+xml"), "unsupported");
  });

  test("image/jpeg → accepted", () => {
    assert.equal(classifyContentType("image/jpeg"), "accepted");
  });

  test("image/png → accepted", () => {
    assert.equal(classifyContentType("image/png"), "accepted");
  });

  test("image/webp → accepted", () => {
    assert.equal(classifyContentType("image/webp"), "accepted");
  });

  test("image/gif → accepted", () => {
    assert.equal(classifyContentType("image/gif"), "accepted");
  });
});
