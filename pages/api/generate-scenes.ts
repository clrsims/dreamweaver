// pages/api/generate-scenes.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { openai, STORY_MODEL } from "../../lib/openai";

type StoryConfig = {
  age: number;
  lengthMinutes: number;
  themes: string;
  moral: string;
  healthTheme: string;
};

type ScenePlan = {
  id: number;
  summary: string;
  goal: string;
  target_word_count: number;
};

type StoryOutline = {
  title: string;
  setting: string;
  main_characters: {
    name: string;
    description: string;
  }[];
  scenes: ScenePlan[];
};

type SafetyReport = {
  violence: "none" | "mild" | "moderate" | "severe";
  fear_level: "calm" | "slightly_spooky" | "scary";
  medical_misinformation: "none" | "possible" | "present";
  sexual_content: "none" | "present";
  overall_safe_for_age: boolean;
  reasons: string[];
};

type ResponseData = {
  story: string;
  outline: StoryOutline;
  scenes: string[];
  moral: string;
  moralOverridden: boolean;
  moralDisclaimer?: string;
};

  

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const config = req.body as StoryConfig;

  try {
    // 1) Generate outline (now returns outline + moral info)
    const { outline, moral, moralOverridden, moralDisclaimer } = await generateOutline(config);

    // 2) Generate each scene with safety checks
    const scenesText: string[] = [];
    for (const scene of outline.scenes) {
      const text = await generateSceneWithSafety(outline, scene, config);
      scenesText.push(text);
    }

    // 3) Combine into full story
    const fullStory = outline.title + "\n\n" + scenesText.join("\n\n");

    return res.status(200).json({
      story: fullStory,
      outline,
      scenes: scenesText,
      moral,
      moralOverridden,
      moralDisclaimer,
    });
  } catch (err: any) {
    console.error("Error in story pipeline:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to generate story" });
  }
}

/**
 * outline
 */

const SAFE_MORALS = [
  "Kindness to others is important.",
  "Sharing and generosity make everyone happier.",
  "Being honest and telling the truth matters.",
  "It is okay to be afraid; courage means trying anyway.",
  "Friends help each other and work together.",
  "Taking care of the world and nature is important.",
  "Everyone makes mistakes, and we can learn from them.",
  "Being patient and not giving up helps you grow.",
  "It is important to be yourself and accept who you are.",
  "Helping others when they need it is a good thing.",
];

// Ask the LLM if the requested moral is ethical/safe for ages 5–10
async function classifyMoralSafety(moral: string, age: number): Promise<"SAFE" | "UNSAFE"> {
  const systemPrompt = `
You are a safety and ethics classifier for children's bedtime story morals.

A parent has requested a moral/lesson for a story intended for a child of age ${age} (5–10 years).

Your task:
- Decide if this moral is SAFE and ETHICAL for a 5–10 year old child.
- A safe moral should emphasize positive traits such as kindness, empathy,
  cooperation, honesty, curiosity, patience, courage, self-acceptance,
  responsibility, or gentle resilience.
- A moral is UNSAFE if it encourages harm, hatred, exclusion, bullying, cruelty,
  risky or illegal behavior, unhealthy relationships, self-blame, extreme
  self-sacrifice, or anything that could be psychologically harmful or confusing
  to a young child.

Return EXACTLY ONE WORD, no explanation:
Either:
SAFE
or
UNSAFE
`;

  const userPrompt = `Requested moral:\n"""${moral}"""`;

  const completion = await openai.chat.completions.create({
    model: STORY_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 4,
  });

  const raw = completion.choices[0]?.message?.content?.trim().toUpperCase() || "";
  if (raw.startsWith("SAFE")) return "SAFE";
  if (raw.startsWith("UNSAFE")) return "UNSAFE";
  // If the model is weird, be conservative
  return "UNSAFE";
}

// Decide which moral we actually use
async function selectMoral(
  maybeMoral: string | undefined,
  age: number
): Promise<{ moral: string; overridden: boolean; originalMoral?: string }> {
  // If no moral provided, just pick a safe one at random
  if (!maybeMoral || !maybeMoral.trim()) {
    const safe = SAFE_MORALS[Math.floor(Math.random() * SAFE_MORALS.length)];
    return { moral: safe, overridden: false };
  }

  const classification = await classifyMoralSafety(maybeMoral, age);
  if (classification === "SAFE") {
    return { moral: maybeMoral, overridden: false };
  }

  // Unsafe → choose safe moral at random
  const safe = SAFE_MORALS[Math.floor(Math.random() * SAFE_MORALS.length)];
  return { moral: safe, overridden: true, originalMoral: maybeMoral };
}


async function generateOutline(
  config: StoryConfig
): Promise<{ outline: StoryOutline; moral: string; moralOverridden: boolean; moralDisclaimer?: string }> {
  const {
    age,
    lengthMinutes,
    themes,
    moral,      // new
    // request,
    // category,
  } = config;

  const themesText = themes || "bedtime";

  // Prefer explicit moral, fallback to old `mood` if you still use it, then final default
  const userMoral = moral || "";
  const { moral: selectedMoral, overridden, originalMoral } = await selectMoral(userMoral, age);

  const moralDisclaimer = overridden
    ? "The requested moral/lesson was deemed unsafe or unethical for ages 5–10, so a standard ethical moral was chosen at random."
    : undefined;

  const moralText =
    selectedMoral ||
    "a lesson about kindness, sharing, honesty, patience, or courage.";

  const categoryText = "generic"; // or from config if you add it
  const requestText =
    "a imaginative bedtime adventure.";

  const targetScenes = lengthMinutes <= 7 ? 3 : lengthMinutes <= 12 ? 4 : 5;
  const targetWords = Math.round(lengthMinutes * 150);

  const systemPrompt = `
You are an expert children's bedtime fiction writer and story planner.

Your job is to design an AGE-APPROPRIATE, SAFE, and CALMING bedtime story outline
for a child between 5 and 10 years old. The outline will later be used to write
a full story, so it must reflect a clear, gentle emotional arc and embody the
desired moral.

You MUST respond with STRICT JSON ONLY, no extra text.
The JSON must match this TypeScript type:

type ScenePlan = {
  id: number;
  summary: string;           // brief description of what happens in the scene
  goal: string;              // what this scene is doing for the story emotionally or structurally
  target_word_count: number; // how many words this scene should roughly take
};

type StoryOutline = {
  title: string;
  setting: string;
  main_characters: {
    name: string;
    description: string;     // include age-appropriate traits like kind, curious, or brave
  }[];
  scenes: ScenePlan[];
};

Safety requirements (MUST follow):
- Story must be safe for a child of age ${age} (5–10 years).
- No violence, no scary imagery, no gore, no injuries, no blood.
- No abuse, no self-harm, no sexual content.
- No bullying, humiliation, or hateful behavior.
- No unsafe real-world behaviors (no running away alone at night, no dangerous stunts).
- No medical advice, diagnoses, or descriptions of illness or treatment.
- The overall emotional tone must be calm, gentle, and reassuring.

Character & content requirements:
- The main character should be a child who is kind, curious, or brave – but not perfect.
  Trying, learning, and growing are more important than success.
- The story is about the character's INNER JOURNEY (feelings, choices, growth),
  not just external events.
- Use imaginative but soothing settings (forests, cozy rooms, gentle magic, friendly animals, stars, etc.).
- The outline should clearly support the desired moral through the character's actions and decisions,
  without turning into a lecture (show the moral through the story).

Story structure requirements (map across the scenes you create):
- The story should be written in 6 acts conceptually, even if you compress them into fewer scenes:

  Act 1 — Setup:
    - Introduce the main character (who they are, what they care about),
      where they are (setting), and what they want (desire).

  Act 2 — Inciting Incident:
    - Something small changes. Something unexpected that sparks curiosity
      or tension and gives the story momentum.

  Act 3 — Rising Action:
    - The character explores, learns something new, and maybe meets someone helpful.
      A challenge appears that requires THE MORAL OF THE STORY to solve.

  Act 4 — Turning Point / Climax:
    - A moment of insight, connection, or emotional discovery.

  Act 5 — Resolution:
    - The challenge is resolved. Show how the character has grown.
      This is where the MORAL of the story becomes clear through what happens.

  Act 6 — Denouement (Sleepy Landing):
    - A peaceful landing where the world becomes quiet, the tone slows down,
      and the atmosphere becomes cozy. This primes the child for sleep.

Scene planning rules:
- Distribute these 6 acts across ${targetScenes} scenes.
- Each scene should clearly indicate which part(s) of the arc it covers.
- The final scene MUST contribute to a calm, sleepy ending.
- The total target_word_count across scenes should roughly add up to ~${targetWords} words.
`;

  const userPrompt = `
Plan a bedtime story outline using the rules above.

Child age: ${age}
Length: about ${lengthMinutes} minutes (~${targetWords} words).
Number of scenes: ${targetScenes}

Story request from the child or parent:
"${requestText}"

Category (for tone/setting hints): ${categoryText}
Themes: ${themesText}

Desired moral / lesson:
"${moralText}"

NOTE:
- If the originally requested moral was deemed unsafe or unethical, a standard
  ethical moral was chosen at random instead. The outline should only reflect
  the safe moral provided above.

Return ONLY a valid JSON object that matches StoryOutline exactly.
Do NOT include any explanation or markdown fences.
`;

  const completion = await openai.chat.completions.create({
    model: STORY_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 800,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No outline content returned from model");
  }

  const content = raw
    .trim()
    .replace(/^\s*```json\s*/i, "")
    .replace(/^\s*```\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  let outline: StoryOutline;
  try {
    outline = JSON.parse(content) as StoryOutline;
  } catch (e) {
    console.error("Failed to parse outline JSON after cleaning:", raw);
    throw new Error("Model returned invalid JSON for outline");
  }

  if (!outline.scenes || outline.scenes.length === 0) {
    throw new Error("Outline has no scenes");
  }

  return { outline, moral: moralText, moralOverridden: overridden, moralDisclaimer };
}


/**
 * Generate ONE scene of prose
 */
async function generateSceneText(
  outline: StoryOutline,
  scene: ScenePlan,
  config: StoryConfig,
  isRetry: boolean = false
): Promise<string> {
  const { age, healthTheme } = config;

  const systemPrompt = `
You are a bedtime storyteller for young children.

You are writing ONE SCENE of a longer story.

The SCENE should connect naturally and chronologically to the previous scene (if applicable).

Rules:
- Age-appropriate for a child of age ${age}.
- No violence, gore, abuse, self-harm, or sexual content.
- No graphic medical details, drug names, or instructions.

${
  isRetry
    ? "- This is a retry because the previous attempt was too intense. Make this version gentle and comforting.\n"
    : ""
}
`;

  const userPrompt = `
You are writing scene ${scene.id} of a story titled "${outline.title}".

Story setting: ${outline.setting}
Main characters:
${outline.main_characters
  .map((c) => `- ${c.name}: ${c.description}`)
  .join("\n")}

Scene summary: ${scene.summary}
Scene goal: ${scene.goal}
Target word count: around ${scene.target_word_count} words.

Requirements:
- Keep the language simple and concrete for a child of age ${age}.
- Emphasize emotions like curiosity, empathy, bravery, and intelligence.
- End on a complete sentence at a natural stopping point (do NOT trail off).
- Do NOT mention that this is a scene or refer to outlines, JSON, or instructions.
- Write continuous narrative prose (no bullet points).
`;

  const completion = await openai.chat.completions.create({
    model: STORY_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 800,
  });

  const choice = completion.choices?.[0];

  if (!choice) {
    console.error("Scene generation: no choices returned", completion);
    return `In this part of the story, everything stays calm and gentle. The characters feel safe and cared for as they get ready for a peaceful night's sleep.`;
  }

  const msg: any = choice.message;
  let content: string | undefined;

  // Case 1: classic string content
  if (typeof msg?.content === "string") {
    content = msg.content.trim();
  }
  // Case 2: array of parts (newer models)
  else if (Array.isArray(msg?.content)) {
    const pieces: string[] = [];

    for (const part of msg.content) {
      if (!part) continue;

      // If it's already a string
      if (typeof part === "string") {
        pieces.push(part);
        continue;
      }

      // If it has a `text` field directly
      if (typeof part.text === "string") {
        pieces.push(part.text);
        continue;
      }

      // If it has `text.value`
      if (part.text && typeof part.text.value === "string") {
        pieces.push(part.text.value);
        continue;
      }

      // Fallback: if there's any 'value' field
      if (typeof part.value === "string") {
        pieces.push(part.value);
        continue;
      }
    }

    content = pieces.join(" ").trim();
  }

  if (!content) {
    console.error("Scene generation: empty or missing content", completion);
    return `In this part of the story, everything stays calm and gentle. The characters feel safe and cared for as they get ready for a peaceful night's sleep.`;
  }

  return content;
}

async function generateSceneWithSafety(
  outline: StoryOutline,
  scene: ScenePlan,
  config: StoryConfig
): Promise<string> {
  const { age } = config;

  // 1) Generate scene text
  let text = await generateSceneText(outline, scene, config);

  // 2) Safety check
  let report = await safetyCheckScene(text, age);

  // 3) If unsafe → retry once with "gentle" instruction
  if (!isSceneSafe(report)) {
    console.warn(`Scene ${scene.id} unsafe, retrying with softer mode`);
    text = await generateSceneText(outline, scene, config, true); // note: isRetry = true
    report = await safetyCheckScene(text, age);
  }

  // 4) If STILL unsafe → fallback to super gentle generic paragraph
  if (!isSceneSafe(report)) {
    console.warn(`Scene ${scene.id} still unsafe. Using fallback safe text.`);
    return `In this part of the story, everything stays calm and gentle. The characters feel safe, cozy, and cared for as they continue their peaceful adventure.`;
  }

  return text;
}


/**
 * safety classifier
 */
async function safetyCheckScene(
  sceneText: string,
  age: number
): Promise<SafetyReport> {
  const systemPrompt = `
You are a safety classifier for children's bedtime stories.

Your job is to evaluate whether a piece of story text is safe and age-appropriate.
You MUST respond with STRICT JSON ONLY, matching this TypeScript type:

type SafetyReport = {
  violence: "none" | "mild" | "moderate" | "severe";
  fear_level: "calm" | "slightly_spooky" | "scary";
  medical_misinformation: "none" | "possible" | "present";
  sexual_content: "none" | "present";
  overall_safe_for_age: boolean;
  reasons: string[];
};

Guidelines:
- "violence" includes any physical harm, threats, or fights.
- "fear_level" is from the perspective of a child of the given age.
- "medical_misinformation" is true if it gives misleading or unsafe medical claims.
- "sexual_content" must remain "none".
- "overall_safe_for_age" should be false if anything could be clearly distressing or inappropriate.
`;

  const userPrompt = `
Child age: ${age}

Story scene to evaluate:
"""
${sceneText}
"""
`;

  const completion = await openai.chat.completions.create({
    model: STORY_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 800,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No safety report returned from model");
  }

  const content = raw
    .trim()
    .replace(/^\s*```json\s*/i, "")
    .replace(/^\s*```\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  let report: SafetyReport;
  try {
    report = JSON.parse(content) as SafetyReport;
  } catch (e) {
    console.error("Failed to parse safety JSON after cleaning:", raw);
    // conservative fallback
    return {
      violence: "none",
      fear_level: "calm",
      medical_misinformation: "none",
      sexual_content: "none",
      overall_safe_for_age: false,
      reasons: ["Failed to parse safety JSON; treating as unsafe by default."],
    };
  }

  return report;
}

function isSceneSafe(report: SafetyReport): boolean {
  if (!report.overall_safe_for_age) return false;
  if (report.violence !== "none") return false;
  if (report.sexual_content !== "none") return false;
  if (report.fear_level === "scary") return false;
  if (report.medical_misinformation === "present") return false;
  return true;
}
