import { NextRequest, NextResponse } from "next/server";
import { analyzeImageWithGemini } from "@/lib/gemini";
import { AnalysisResult } from "@/lib/types";

// Max 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResult>> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your-gemini-api-key-here") {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY is not configured on the server." },
        { status: 503 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request format. Please upload a file using multipart/form-data." },
        { status: 400 }
      );
    }
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded. Please select an image." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}. Supported: JPEG, PNG, WebP, GIF.`,
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: "The uploaded file is empty. Please select a valid image." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 10 MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const report = await analyzeImageWithGemini(base64, file.type, apiKey);

    return NextResponse.json({
      success: true,
      report,
      mediaType: "image",
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/analyze]", err);
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
