import { NextRequest, NextResponse } from "next/server";
import { analyzeImageWithGemini } from "@/lib/gemini";
import { fetchImageFromUrl, validateImageUrl } from "@/lib/urlFetch";
import { AnalysisResult } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResult>> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your-gemini-api-key-here") {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY is not configured on the server." },
        { status: 503 }
      );
    }

    // Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body. Expected JSON with a 'url' field." },
        { status: 400 }
      );
    }

    const rawUrl =
      typeof (body as Record<string, unknown>)?.url === "string"
        ? ((body as Record<string, unknown>).url as string).trim()
        : "";

    // Server-side URL validation (never trust client)
    const validation = validateImageUrl(rawUrl);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.reason },
        { status: 400 }
      );
    }

    // Fetch the image safely
    const fetched = await fetchImageFromUrl(rawUrl);

    // Run through the existing Gemini pipeline (prompt, schema, confidence enforcement)
    const report = await analyzeImageWithGemini(fetched.base64, fetched.mimeType, apiKey);

    return NextResponse.json({
      success: true,
      report,
      mediaType: "image",
      filename: fetched.filename,
      fileSize: fetched.fileSize,
      mimeType: fetched.mimeType,
      analyzedAt: new Date().toISOString(),
      sourceType: "url",
      sourceUrl: rawUrl,
    });
  } catch (err) {
    console.error("[/api/analyze-url]", err);
    // Surface user-facing errors from urlFetch; hide internals for others
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    const status = message.includes("timed out") || message.includes("reach")
      ? 502
      : message.includes("too large") || message.includes("not point to")
      ? 400
      : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
