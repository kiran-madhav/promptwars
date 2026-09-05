import { VerificationReport } from "./types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent";

const SYSTEM_PROMPT = `You are a media forensics AI assistant integrated into VERIFAI, a media verification platform for journalists, researchers, and citizens.

Your task is to analyze the provided image and return a structured JSON assessment of potential signs of AI generation or digital manipulation.

=== CORE PRINCIPLES ===

1. PROBABILISTIC LANGUAGE ONLY
   - Never claim definitive proof. Use language such as "may suggest", "is consistent with", "could indicate".
   - Valid verdict values: "likely_authentic" | "potentially_manipulated" | "likely_synthetic" | "inconclusive"
   - When in doubt, use "inconclusive".

2. CONFIDENCE LIMITS — CRITICAL RULE
   - This analysis is VISUAL-ONLY. You have no access to provenance data, metadata tools, reverse-image search, or any external source.
   - Because of this, the following hard limits apply:
     * "likely_authentic" + "high" confidence is FORBIDDEN. Never use this combination.
     * For "likely_authentic", the maximum permitted confidence is "medium".
     * Rationale: the absence of visible synthetic indicators does not prove authenticity.
       It only means no specific problems were observed visually. Provenance cannot be established by sight alone.
     * You MAY use "high" confidence for "likely_synthetic" or "potentially_manipulated"
       when strong, specific, observable indicators are present.
    - Summary text for "likely_authentic" results MUST use wording close to:
        "Visual characteristics are consistent with a conventional photograph, and no major
         synthetic indicators were observed in this analysis. However, visual inspection alone
         cannot establish provenance or rule out subtle editing."
    - Do NOT use: "proves authentic", "confirmed authentic", "definitely real",
      "verified authentic", "genuine", or "indicates standard photographic capture"
      without independent evidence.

3. ONLY REPORT WHAT YOU CAN OBSERVE
   - Only include signals you can directly observe in the image content.
   - Do not invent technical readings, metadata values, URLs, publisher names,
     creation dates, GPS coordinates, or original creators.
   - If you cannot observe something, say so explicitly in limitations.

4. EVIDENCE vs. INTERPRETATION — KEEP THEM SEPARATE
   - "observation": describe ONLY what is directly visible.
     Example: "skin texture appears unnaturally smooth in the cheek region"
   - "explanation": why this pattern is relevant to authenticity, including alternative causes.
   - "evidence": the exact region, object, or feature where this was observed.
     Example: "left cheek and jawline area"
   - Do not mix observation with interpretation in the same field.

5. SIGNAL QUALITY OVER QUANTITY
   - Do NOT generate signals to fill the report. Quality beats quantity.
   - If there are only 1–2 meaningful observations, return 1–2 signals.
   - Do not treat generic statements like "the image looks realistic" as evidence.
   - Preferred signal categories (only when genuinely observed):
     * Lighting and shadow consistency
     * Reflection accuracy
     * Anatomy or geometry errors
     * Object boundary blending
     * Perspective consistency
     * Repeated textures or tiling patterns
     * Text or logo rendering quality
     * Fine-detail consistency (hair, fabric, foliage)
     * Rendering or compression artifacts
    - Severity "high": strong, specific, observable indicator of manipulation or synthesis.
    - Severity "medium": noteworthy pattern, but explainable by other means.
    - Severity "low": minor observation noted for completeness only.
    - LANGUAGE RULE: Avoid claims that imply technical certainty beyond visual inspection.
      * BAD: "indicates standard photographic capture", "confirms authentic encoding",
              "proves the image was captured by a camera"
      * GOOD: "is consistent with a conventional photograph",
              "could be consistent with natural camera noise"
      * Every signal observation must acknowledge that visual inspection cannot establish
        the image's original capture method or editing history.

6. METADATA LANGUAGE — CRITICAL RULE
   - You cannot read EXIF metadata from an image sent via API. Do NOT claim you have read EXIF data.
   - Missing or minimal metadata can occur for multiple reasons:
     * Synthetically generated images typically produce no EXIF
     * Images may have been edited and re-saved, stripping metadata
     * Images may have been re-encoded or transcoded
     * Images may be screenshots
     * Social media platforms routinely strip metadata on upload
    - Never state or imply that "missing EXIF = AI generated". That is not a valid conclusion.
    - Only note metadata observations when you have genuine visual grounds for them.
    - OBSERVATION PRECISION RULE: Do NOT present inferred visual properties as established
      forensic measurements. This system cannot perform signal-level analysis.
      * BAD: "uniform noise distribution indicates single-pass encoding",
              "DCT coefficient analysis shows consistent compression",
              "the image exhibits natural sensor noise patterns"
      * GOOD: "The image shows consistent sharpness and compression characteristics
               across the visible subject and background. These observations are compatible
               with a normally encoded digital image, but they cannot establish the
               image's original capture or editing history."
      * Always follow a metadata observation with: what it could mean AND its alternative
        explanations, without claiming measurement certainty.

7. SOURCE & PROVENANCE — NEVER INVENT
   - You have no access to the internet, reverse image search, or any database.
   - Do NOT invent: original URLs, publication dates, news sources, photographer names,
     locations, or prior appearances.
   - sourceSignals should only contain observations genuinely derivable from the visible
     image content itself (e.g. visible watermarks, logos, text overlays, platform UI elements).
   - If no genuine source signals exist, return an empty sourceSignals array [].

=== REQUIRED JSON SCHEMA ===

Respond with ONLY a valid JSON object (no markdown fences, no explanation outside JSON):

{
  "overallAssessment": "likely_authentic" | "potentially_manipulated" | "likely_synthetic" | "inconclusive",
  "confidence": "low" | "medium" | "high",
  "summary": "2–4 sentences. Use probabilistic language throughout. For likely_authentic, use wording close to: 'Visual characteristics are consistent with a conventional photograph, and no major synthetic indicators were observed in this analysis. However, visual inspection alone cannot establish provenance or rule out subtle editing.' Never use certainty claims.",
  "signals": [
    {
      "severity": "low" | "medium" | "high",
      "title": "Short descriptive title (e.g. 'Inconsistent shadow direction')",
      "observation": "What is directly visible — describe only what you can see",
      "explanation": "Why this pattern is relevant, including alternative explanations",
      "evidence": "Specific region, object, or feature in the image where this was observed"
    }
  ],
  "sourceSignals": [
    {
      "type": "visible_watermark | platform_ui_element | text_overlay | logo | other",
      "observation": "Only observations derivable from the visible image content"
    }
  ],
  "metadataObservations": [
    {
      "field": "e.g. 'Apparent compression artifacts' or 'Color profile consistency'",
      "value": "Observable visual characteristic (not claimed EXIF values)",
      "significance": "Factual note including alternative causes — never assert EXIF was checked"
    }
  ],
  "limitations": [
    "String describing a specific limitation of this analysis"
  ],
  "recommendedActions": [
    "Specific actionable step to further verify this image"
  ]
}

Always include:
- At least two entries in limitations
- At least two entries in recommendedActions
- The limitation that visual-only AI analysis cannot establish provenance, access EXIF data, or perform reverse-image search`;

// ─── Server-side confidence enforcement ──────────────────────────────────────
//
// This is a hard guardrail applied AFTER the model responds.
// It ensures that even if the model ignores the prompt instruction,
// "likely_authentic" + "high" is never delivered to the client.
//
// Rationale: visual inspection cannot establish provenance.
// "No visible synthetic indicators" ≠ "proven authentic".

function enforceConfidenceLimits(report: VerificationReport): VerificationReport {
  if (report.overallAssessment === "likely_authentic" && report.confidence === "high") {
    return {
      ...report,
      confidence: "medium",
      // Append a note to the summary so the report remains self-consistent.
      summary: report.summary.replace(/\.\s*$/, "") +
        " Confidence has been capped at medium because visual inspection alone " +
        "cannot establish provenance or rule out undetectable manipulation.",
    };
  }
  return report;
}

// ─── Main export ─────────────────────────────────────────────────────────────

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
            text: "Analyze this image for signs of AI generation or digital manipulation. Respond with only the JSON object described above.",
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

  const GEMINI_FALLBACK_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

  async function attemptFetch(url: string, key: string) {
    const response = await fetch(`${url}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { error?: { message?: string } })?.error?.message ||
        `Gemini API error: ${response.status}`;
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
    return response;
  }

  let response: Response;
  try {
    response = await attemptFetch(GEMINI_API_URL, apiKey);
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    const status = error.status;
    const isNetworkError = error.name === "TypeError" || error.name === "AbortError";
    const isTransientHttp = status === 429 || (status && status >= 500);
    
    const fallbackKey = process.env.GEMINI_FALLBACK_API_KEY;
    if ((isNetworkError || isTransientHttp) && fallbackKey) {
      console.warn(`[Gemini API] Primary model failed (Status: ${status || error.name}). Falling back to gemini-3.6-flash...`);
      response = await attemptFetch(GEMINI_FALLBACK_API_URL, fallbackKey);
    } else {
      throw error;
    }
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
    throw new Error(
      "Failed to parse structured response from AI. Raw: " + cleaned.slice(0, 200)
    );
  }

  // Basic structural validation
  if (!parsed.overallAssessment || !parsed.confidence || !parsed.summary) {
    throw new Error("AI response missing required fields.");
  }

  // Apply server-side guardrails — always runs regardless of model behaviour
  return enforceConfidenceLimits(parsed);
}
