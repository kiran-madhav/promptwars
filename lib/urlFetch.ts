/**
 * Safe server-side image fetch for URL-based analysis.
 *
 * Security measures:
 *  - Protocol allowlist: http and https only
 *  - Hostname blocklist: localhost, 127.x, ::1, private/link-local ranges
 *  - Fetch timeout: 10 seconds via AbortController
 *  - Content-Type guard: must be image/*
 *  - Size guard: enforces MAX_FETCH_BYTES before buffering
 *
 * NOT protected against:
 *  - DNS rebinding (would require post-resolution IP check; overkill for MVP)
 *  - Slow-loris attacks (mitigated by timeout)
 */

const MAX_FETCH_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface FetchedImage {
  base64: string;
  mimeType: string;
  fileSize: number;
  /** Best-effort filename derived from the URL path */
  filename: string;
}

export interface UrlValidationError {
  valid: false;
  reason: string;
}

export interface UrlValidationOk {
  valid: true;
  parsed: URL;
}

// ─── URL validation ───────────────────────────────────────────────────────────

export function validateImageUrl(rawUrl: string): UrlValidationError | UrlValidationOk {
  if (!rawUrl || !rawUrl.trim()) {
    return { valid: false, reason: "URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: "Invalid URL. Please enter a complete URL including https://." };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      valid: false,
      reason: `Unsupported protocol "${parsed.protocol}". Only http:// and https:// URLs are accepted.`,
    };
  }

  if (isBlockedHostname(parsed.hostname)) {
    return {
      valid: false,
      reason: "This URL points to a private or reserved address and cannot be fetched.",
    };
  }

  return { valid: true, parsed };
}

/**
 * Block private network ranges and localhost to prevent SSRF.
 * Uses hostname-level checks (no DNS resolution — suitable for MVP).
 */
function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Localhost variants
  if (h === "localhost" || h === "::1" || h === "[::1]") return true;

  // IPv4 loopback / private / link-local / CGNAT
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 127) return true;                          // 127.0.0.0/8 loopback
    if (a === 10) return true;                           // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local
    if (a === 100 && b >= 64 && b <= 127) return true;  // 100.64.0.0/10 CGNAT
    if (a === 0) return true;                            // 0.0.0.0/8
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    if (a === 203 && b === 0 && Number(ipv4Match[3]) === 113) return true; // 203.0.113.0/24 documentation
  }

  // Block IPv6 private ranges.
  // URL.hostname wraps bare IPv6 in brackets: "[fd00::1]" — strip them first.
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (bare.startsWith("fc") || bare.startsWith("fd") || bare.startsWith("fe80")) return true;

  return false;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchImageFromUrl(rawUrl: string): Promise<FetchedImage> {
  const validation = validateImageUrl(rawUrl);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const { parsed } = validation;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(parsed.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify ourselves politely
        "User-Agent": "VERIFAI-MediaVerifier/1.0",
        Accept: "image/*",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out after 10 seconds. The URL may be slow or unreachable.");
    }
    throw new Error("Failed to reach the URL. Please check the address and try again.");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      `The server at that URL returned an error (HTTP ${response.status}). ` +
        "Please verify the URL is publicly accessible."
    );
  }

  // Validate Content-Type before buffering
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    if (contentType.startsWith("text/html")) {
      throw new Error(
        "This URL points to a webpage, not directly to an image. " +
          "VERIFAI accepts direct image URLs that return JPEG, PNG, WebP, or GIF content. " +
          "Tip: open the image itself in your browser and copy its address."
      );
    }
    throw new Error(
      `This URL does not point to a supported image format. ` +
        "VERIFAI accepts direct image URLs returning JPEG, PNG, WebP, or GIF."
    );
  }

  // Enforce size limit — check Content-Length header first to fail fast
  const declaredLength = parseInt(response.headers.get("content-length") ?? "0", 10);
  if (declaredLength > MAX_FETCH_BYTES) {
    throw new Error(
      `The image at that URL is too large (${(declaredLength / 1024 / 1024).toFixed(1)} MB). ` +
        "Maximum allowed size is 10 MB."
    );
  }

  // Buffer with streaming size check
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Could not read the response body.");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_FETCH_BYTES) {
        reader.cancel();
        throw new Error("The image exceeds the 10 MB limit and was not downloaded.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new Error("The URL returned an empty response.");
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const base64 = buffer.toString("base64");

  // Best-effort filename from URL path
  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] ?? "image";
  const filename = lastSegment.length > 0 ? lastSegment : "image";

  return { base64, mimeType: contentType, fileSize: totalBytes, filename };
}
