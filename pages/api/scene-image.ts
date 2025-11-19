// pages/api/scene-image.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { openai } from "../../lib/openai";

type SceneImageRequest = {
  summary?: string;
  style?: string;
};

type SceneImageResponse =
  | { imageUrl: string }
  | { error: string; details?: string };

// 1) Aggressive sanitization: strip medical/violence/fear terms
function sanitizeSummary(raw: string): string {
    return raw
      .replace(
        /\b(blood|bloody|gore|gory|weapon|gun|knife|sword|kill|killed|death|die|dead|corpse|injury|injured|wound|hospital|clinic|surgery|operation|vaccine|shot|needle|injection|cancer|tumor|disease|illness|sick|hurt|scared|afraid|terrified|horrified|anxious|anxiousness|worried|nervous|panic|panic\s+attack)\b/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();
  }
  

// 2) Build a *positive* prompt that gently references the scene
function buildScenePrompt(summary: string, style?: string) {
  const clean = sanitizeSummary(summary).slice(0, 220); // keep it compact

  const visualStyle =
    style ||
    "soft watercolor, pastel colors, gentle lighting, cute, cozy bedtime picture book illustration";

  const safeCore =
    clean.length > 0
      ? clean
      : "a friendly character and their animal friend enjoying a peaceful evening in a cozy bedroom";

  return `
Children's bedtime illustration inspired by this scene:

"${safeCore}"

Style: ${visualStyle}

Focus on:
- a peaceful, cozy atmosphere
- warm, comforting colors
- friendly, expressive characters
- simple, gentle shapes that feel calming for a child
`;
}

// 3) Very safe generic fallback if scene prompt gets blocked
function buildFallbackPrompt(style?: string) {
  const visualStyle =
    style ||
    "soft watercolor, pastel colors, gentle lighting, cute, cozy bedtime picture book illustration";

  return `
Children's bedtime illustration:

A crescent moon and twinkling stars in a calm purple night sky above a small cozy house
with warm light in the window and soft clouds drifting by. Very peaceful and comforting.

Style: ${visualStyle}

Focus on:
- calm, dreamy mood
- soft, rounded shapes
- warm light and gentle colors
`;
}

async function generateImage(prompt: string): Promise<string> {
  const result = await openai.images.generate({
    model: "dall-e-2",
    prompt,
    size: "512x512",
    n: 1,
  });

  const url = (result as any).data?.[0]?.url as string | undefined;
  return url || "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SceneImageResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { summary, style } = req.body as SceneImageRequest;

  if (!summary || typeof summary !== "string") {
    return res
      .status(400)
      .json({ error: "Missing or invalid 'summary' field" });
  }

  const scenePrompt = buildScenePrompt(summary, style);

  try {
    // 1) Try story-specific prompt
    try {
      const imageUrl = await generateImage(scenePrompt);
      if (imageUrl) {
        return res.status(200).json({ imageUrl });
      }
    } catch (err: any) {
      const code = err?.code || err?.error?.code;
      if (
        code !== "content_policy_violation" &&
        code !== "image_generation_user_error"
      ) {
        // non-safety error → bubble up to outer catch
        throw err;
      }
      console.warn(
        "Scene-based image blocked by safety, falling back to generic prompt..."
      );
    }

    // 2) Fallback: ultra-safe generic bedtime art
    try {
      const fallbackPrompt = buildFallbackPrompt(style);
      const fallbackUrl = await generateImage(fallbackPrompt);
      if (fallbackUrl) {
        return res.status(200).json({ imageUrl: fallbackUrl });
      }
    } catch (err: any) {
      console.error("Fallback image generation error:", err);
    }

    // 3) If everything fails, surface an error
    return res.status(500).json({
      error: "Unable to generate illustration (safety or model issue)",
    });
  } catch (err: any) {
    console.error("Scene image generation error:", err);
    return res.status(500).json({
      error: "Failed to generate scene image",
      details: err.message,
    });
  }
}
