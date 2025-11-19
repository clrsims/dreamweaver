import type { NextApiRequest, NextApiResponse } from "next";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // or your chosen default

if (!ELEVENLABS_API_KEY) {
  console.warn("ELEVENLABS_API_KEY is not set. /api/tts will not work.");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ELEVENLABS_API_KEY) {
    return res
      .status(500)
      .json({ error: "ELEVENLABS_API_KEY is not configured" });
  }

  const { text, voiceId } = req.body as {
    text?: string;
    voiceId?: string;
  };

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'text' field" });
  }

  try {
    const selectedVoiceId = voiceId || ELEVENLABS_VOICE_ID;
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`;

    const elevenRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("ElevenLabs error:", errText);
      return res
        .status(500)
        .json({ error: "TTS provider error", details: errText });
    }

    // Get raw audio bytes and stream them out as audio/mpeg
    const arrayBuffer = await elevenRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (err: any) {
    console.error("TTS error:", err);
    return res
      .status(500)
      .json({ error: "Failed to generate TTS", details: err.message });
  }
}
