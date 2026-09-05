import { VerificationReport } from "./types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

const SYSTEM_PROMPT = `You are a media forensics AI assistant integrated into VERIFAI, a media verification platform for journalists, researchers, and citizens.

Your task is to analyze the provided image and return a structured JSON assessment of whether it shows signs of AI generation or digital manipulation.

IMPORTANT GUIDELINES:
- Do NOT make definitive claims. Use probabilistic, evidence-based language.
- Only report signals you can genuinely observe in the image.
- If you cannot determine something, explicitly say so in limitations.
- Distinguish clearly between observations and conclusions.
- Do not invent evidence. If no signal is present, report no signal.
- Avoid fear-based language. Be calm, analytical, and credible.

You MUST respond with ONLY a valid JSON object matching this exact schema (no markdown, no explanation outside the JSON):

{
  "overallAssessment": "likely_authentic" | "potentially_manipulated" | "likely_synthetic" | "inconclusive",
  "confidence": "low" | "medium" | "high",
  "summary": "2-4 sentence human-readable summary of findings",
  "signals": [
    {
      "severity": "low" | "medium" | "high",
      "title": "Short signal title",
      "observation": "What was specifically observed",
      "explanation": "Why this could indicate manipulation or generation",
      "evidence": "Specific location or detail in the image supporting this observation"
    }
  ],
  "sourceSignals": [
    {
      "type": "e.g. metadata_gap | style_match | watermark_absent | compression_artifact",
      "observation": "Observation about source or provenance"
    }
  ],
  "metadataObservations": [
    {
      "field": "e.g. EXIF Camera Model / File Format / Color Profile",
      "value": "Observed or inferred value",
      "significance": "Why this matters for authenticity"
    }
  ],
  "limitations": [
    "String describing a limitation of this analysis"
  ],
  "recommendedActions": [
    "Actionable step the user can take to further verify"
  ]
}

Always include at least one entry in limitations and at least two recommendedActions.
Keep signals array between 0 and 8 items — only include genuine observations.`;

export async function analyzeImageWithGemini(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<VerificationReport> {
  const body = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: "Analyze this image for signs of AI generation or digital manipulation. Return only the JSON assessment.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 4096,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      (errorData as { error?: { message?: string } })?.error?.message ||
      `Gemini API error: ${response.status}`;
    throw new Error(message);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Empty response from Gemini API.");
  }

  // Strip markdown code fences if present
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: VerificationReport;
  try {
    parsed = JSON.parse(cleaned) as VerificationReport;
  } catch {
    throw new Error("Failed to parse structured response from AI. Raw: " + cleaned.slice(0, 200));
  }

  // Basic validation
  if (!parsed.overallAssessment || !parsed.confidence || !parsed.summary) {
    throw new Error("AI response missing required fields.");
  }

  return parsed;
}
