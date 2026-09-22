/**
 * CupidX Optional AI Gender Estimation Service
 * 
 * CORE PRINCIPLES:
 * 1. USER-SELECTED GENDER REMAINS THE 100% PERMANENT SOURCE OF TRUTH.
 * 2. AI estimate is an optional assistive signal only — NEVER treated as verified gender.
 * 3. Never exposed publicly; low confidence (<0.60) strictly returns "unknown".
 * 4. Image processing is ephemeral and held strictly in-memory (Buffer).
 *    No photo is permanently saved to disk solely for gender estimation.
 * 5. Robust fallback: If unconfigured or service fails, gracefully returns "unknown".
 */

export interface GenderEstimateResult {
  estimate: 'male' | 'female' | 'non-binary' | 'unknown';
  confidence: number;
  reason?: string;
}

/**
 * Validates binary buffer format against JPEG, PNG, WebP signatures.
 * Rejects non-images (PDF, ZIP, EXE, JS, HTML, SVG) and buffers > 5 MB.
 */
export function validateImageBuffer(buffer: Buffer): {
  valid: boolean;
  mimeType?: string;
  error?: string;
} {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty image buffer.' };
  }

  // Strict 5 MB file size limit
  if (buffer.length > 5 * 1024 * 1024) {
    return { valid: false, error: 'Image must be 5 MB or smaller.' };
  }

  // Binary Magic Bytes Validation
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  const isJpg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (!isPng && !isJpg && !isWebp) {
    return {
      valid: false,
      error: 'Invalid image file format. Only JPG, PNG, and WebP images are allowed.',
    };
  }

  const mimeType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
  return { valid: true, mimeType };
}

/**
 * Analyzes photo strictly in-memory using Google Gemini Vision API.
 * Never stores image binary or writes to filesystem.
 */
export async function estimateGenderFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<GenderEstimateResult> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  // Graceful fallback if no external AI API key is configured
  if (!apiKey) {
    return {
      estimate: 'unknown',
      confidence: 0,
      reason: 'AI service unconfigured; fallback to unknown.',
    };
  }

  try {
    const base64Data = buffer.toString('base64');

    const promptText = `
You are an assistive vision model for optional profile gender estimation.
Analyze the person in the provided photo and estimate whether they appear male, female, or non-binary.

CRITICAL RULES:
1. Return ONLY valid JSON in the exact schema below.
2. If the photo does not clearly show a human face, face is obscured, multiple conflicting people are visible, or confidence is below 0.60, you MUST return "unknown".
3. Never guess wildly. If ambiguous or unclear, return "unknown" with confidence 0.0.
4. This is an optional assistive signal only and is never used as proof of gender.

JSON SCHEMA:
{
  "estimate": "male" | "female" | "non-binary" | "unknown",
  "confidence": number between 0.0 and 1.0,
  "reason": "short explanation"
}
`.trim();

    const requestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    // Use Gemini 1.5 Flash or Gemini 2.5 Flash
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      console.warn('Gemini vision API response status:', response.status);
      return { estimate: 'unknown', confidence: 0, reason: 'AI service error' };
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return { estimate: 'unknown', confidence: 0, reason: 'Empty AI response' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      // Clean possible markdown code fences
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    const rawEstimate = (parsed?.estimate || '').toLowerCase().trim();
    const rawConfidence = typeof parsed?.confidence === 'number' ? parsed.confidence : 0;

    // Rule 4: If AI confidence is low (<0.60), return "unknown"
    if (rawConfidence < 0.60) {
      return {
        estimate: 'unknown',
        confidence: rawConfidence,
        reason: 'Confidence below threshold (0.60); returned unknown.',
      };
    }

    if (rawEstimate === 'male' || rawEstimate === 'female' || rawEstimate === 'non-binary') {
      return {
        estimate: rawEstimate,
        confidence: Math.min(1.0, Math.max(0.0, rawConfidence)),
        reason: parsed?.reason || 'Estimated from photo analysis',
      };
    }

    return { estimate: 'unknown', confidence: 0, reason: 'Ambiguous or unrecognized classification' };
  } catch (err: any) {
    console.warn('Error in AI gender estimation service (falling back to unknown):', err?.message || err);
    // Fallback: application must continue working normally
    return {
      estimate: 'unknown',
      confidence: 0,
      reason: 'AI processing failed; graceful fallback to unknown.',
    };
  }
}
