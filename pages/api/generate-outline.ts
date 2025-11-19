// pages/api/generate-outline.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { openai, STORY_MODEL } from "../../lib/openai";

// Option 1: copy the types & generateOutline from generate-scenes.ts
// Option 2 (cleaner): move generateOutline + types to a shared file in /lib
// For simplicity, here we just return a stub or you can copy generateOutline here.

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // For now you can just forward to /api/generate-scenes or
  // later copy the generateOutline logic here if you want to inspect it.
  return res
    .status(400)
    .json({ error: "Use /api/generate-scenes for full pipeline" });
}
