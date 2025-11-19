// lib/openai.ts
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in the environment");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const STORY_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
