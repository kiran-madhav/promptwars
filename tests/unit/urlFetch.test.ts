/**
 * Unit tests for lib/urlFetch.ts — validateImageUrl()
 *
 * Covers:
 *   - Empty / malformed URL rejection
 *   - Protocol allowlist (http, https only)
 *   - SSRF / private IP blocklist (loopback, RFC-1918, link-local, CGNAT,
 *     benchmarking, documentation, IPv6 ULA/link-local)
 *   - Valid public URLs accepted
 *   - Return shape on success
 *
 * No network calls are made. No API key required.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateImageUrl } from "../../lib/urlFetch.ts";

// ─── Empty / malformed input ──────────────────────────────────────────────────

describe("validateImageUrl — empty and malformed input", () => {
  test("rejects empty string", () => {
    const r = validateImageUrl("");
    assert.equal(r.valid, false);
  });

  test("rejects whitespace-only string", () => {
    const r = validateImageUrl("   ");
    assert.equal(r.valid, false);
  });

  test("rejects plain domain with no protocol", () => {
    const r = validateImageUrl("example.com/photo.jpg");
    assert.equal(r.valid, false);
  });

  test("rejects obviously malformed string", () => {
    const r = validateImageUrl("not a url at all");
    assert.equal(r.valid, false);
  });

  test("rejects bare path", () => {
    const r = validateImageUrl("/etc/passwd");
    assert.equal(r.valid, false);
  });
});

// ─── Protocol allowlist ───────────────────────────────────────────────────────

describe("validateImageUrl — protocol allowlist", () => {
  test("accepts https:// URLs", () => {
    const r = validateImageUrl("https://example.com/photo.jpg");
    assert.equal(r.valid, true);
  });

  test("accepts http:// URLs", () => {
    const r = validateImageUrl("http://example.com/photo.jpg");
    assert.equal(r.valid, true);
  });

  test("rejects file:// — error includes 'protocol'", () => {
    const r = validateImageUrl("file:///etc/passwd");
    assert.equal(r.valid, false);
    assert.ok(!r.valid && r.reason.toLowerCase().includes("protocol"));
  });

  test("rejects javascript://", () => {
    const r = validateImageUrl("javascript://alert(1)");
    assert.equal(r.valid, false);
  });

  test("rejects ftp://", () => {
    const r = validateImageUrl("ftp://example.com/image.jpg");
    assert.equal(r.valid, false);
  });

  test("rejects data: URLs", () => {
    const r = validateImageUrl("data:image/png;base64,abc123");
    assert.equal(r.valid, false);
  });

  test("rejects blob: URLs", () => {
    const r = validateImageUrl("blob:https://example.com/abc");
    assert.equal(r.valid, false);
  });
});

// ─── SSRF / private IP protection ─────────────────────────────────────────────

describe("validateImageUrl — SSRF: localhost", () => {
  test("rejects 'localhost' — error includes 'private'", () => {
    const r = validateImageUrl("http://localhost/image.jpg");
    assert.equal(r.valid, false);
    assert.ok(!r.valid && r.reason.toLowerCase().includes("private"));
  });

  test("rejects '::1' IPv6 loopback", () => {
    const r = validateImageUrl("http://[::1]/image.jpg");
    assert.equal(r.valid, false);
  });
});

describe("validateImageUrl — SSRF: IPv4 loopback (127.x.x.x/8)", () => {
  test("rejects 127.0.0.1", () => {
    assert.equal(validateImageUrl("http://127.0.0.1/img.jpg").valid, false);
  });

  test("rejects 127.0.0.2 (full range)", () => {
    assert.equal(validateImageUrl("http://127.0.0.2/img.jpg").valid, false);
  });

  test("rejects 127.255.255.255 (loopback boundary)", () => {
    assert.equal(validateImageUrl("http://127.255.255.255/img.jpg").valid, false);
  });
});

describe("validateImageUrl — SSRF: private RFC-1918 ranges", () => {
  test("rejects 10.0.0.1 (Class A private)", () => {
    assert.equal(validateImageUrl("http://10.0.0.1/img.jpg").valid, false);
  });

  test("rejects 10.255.255.255 (Class A boundary)", () => {
    assert.equal(validateImageUrl("http://10.255.255.255/img.jpg").valid, false);
  });

  test("rejects 172.16.0.1 (Class B private start)", () => {
    assert.equal(validateImageUrl("http://172.16.0.1/img.jpg").valid, false);
  });

  test("rejects 172.31.255.255 (Class B private end)", () => {
    assert.equal(validateImageUrl("http://172.31.255.255/img.jpg").valid, false);
  });

  test("accepts 172.15.0.1 (just below private Class B range)", () => {
    assert.equal(validateImageUrl("http://172.15.0.1/img.jpg").valid, true);
  });

  test("accepts 172.32.0.1 (just above private Class B range)", () => {
    assert.equal(validateImageUrl("http://172.32.0.1/img.jpg").valid, true);
  });

  test("rejects 192.168.1.1 (Class C private)", () => {
    assert.equal(validateImageUrl("http://192.168.1.1/img.jpg").valid, false);
  });

  test("rejects 192.168.0.0 (Class C private start)", () => {
    assert.equal(validateImageUrl("http://192.168.0.0/img.jpg").valid, false);
  });
});

describe("validateImageUrl — SSRF: special ranges", () => {
  test("rejects 169.254.1.1 (link-local)", () => {
    assert.equal(validateImageUrl("http://169.254.1.1/img.jpg").valid, false);
  });

  test("rejects 100.64.0.1 (CGNAT)", () => {
    assert.equal(validateImageUrl("http://100.64.0.1/img.jpg").valid, false);
  });

  test("rejects 198.18.0.1 (benchmarking)", () => {
    assert.equal(validateImageUrl("http://198.18.0.1/img.jpg").valid, false);
  });

  test("rejects 0.0.0.0", () => {
    assert.equal(validateImageUrl("http://0.0.0.0/img.jpg").valid, false);
  });
});

describe("validateImageUrl — SSRF: IPv6 private ranges", () => {
  test("rejects fd00::1 (IPv6 unique local)", () => {
    assert.equal(validateImageUrl("http://[fd00::1]/img.jpg").valid, false);
  });

  test("rejects fc00::1 (IPv6 unique local fc)", () => {
    assert.equal(validateImageUrl("http://[fc00::1]/img.jpg").valid, false);
  });
});

// ─── Public IPs / domains accepted ───────────────────────────────────────────

describe("validateImageUrl — public addresses accepted", () => {
  test("accepts 8.8.8.8 (Google DNS)", () => {
    assert.equal(validateImageUrl("http://8.8.8.8/img.jpg").valid, true);
  });

  test("accepts 1.1.1.1 (Cloudflare)", () => {
    assert.equal(validateImageUrl("http://1.1.1.1/img.jpg").valid, true);
  });

  test("accepts public domain with path", () => {
    const r = validateImageUrl("https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg");
    assert.equal(r.valid, true);
  });
});

// ─── Return shape ─────────────────────────────────────────────────────────────

describe("validateImageUrl — return shape", () => {
  test("valid result has parsed URL object with correct hostname", () => {
    const r = validateImageUrl("https://example.com/photo.jpg");
    assert.equal(r.valid, true);
    if (r.valid) {
      assert.ok(r.parsed instanceof URL);
      assert.equal(r.parsed.hostname, "example.com");
      assert.equal(r.parsed.protocol, "https:");
    }
  });

  test("invalid result has a non-empty reason string", () => {
    const r = validateImageUrl("file:///etc/passwd");
    assert.equal(r.valid, false);
    if (!r.valid) {
      assert.ok(typeof r.reason === "string" && r.reason.length > 0);
    }
  });
});
