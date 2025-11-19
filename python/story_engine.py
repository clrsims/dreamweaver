import os
import openai
import random

"""
Need to make the block diagram

Need to do something about my API keys in .env.local

YouTube demo Dreamweaver MVP
"""

# --------------------------------------------------------
# Basic model wrapper (same model as skeleton – do not change)
# --------------------------------------------------------
def call_model(prompt: str, max_tokens: int = 1500, temperature: float = 0.4) -> str:
    # Please set OPENAI_API_KEY in your environment; do not hard-code it.
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        raise RuntimeError("Please set the OPENAI_API_KEY environment variable.")

    resp = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        stream=False,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message["content"]  # type: ignore


# --------------------------------------------------------
# Length helpers
# --------------------------------------------------------
def ask_for_length_minutes() -> float:
    """Ask how long the story should be (5–20 minutes, any decimal allowed)."""
    while True:
        raw = input("How long should the story be? (5–20 minutes): ").strip()
        try:
            minutes = float(raw)
            if 5 <= minutes <= 20:
                return minutes
            else:
                print("Please enter a number between 5 and 20.")
        except ValueError:
            print("Please enter a valid number (e.g., 5, 7.5, 12, 19.2).")


def estimate_word_target(length_minutes: float) -> int:
    """
    Convert story length (in minutes) to an approximate target word count.
    Uses ~150 words per minute as a calm bedtime read-aloud pace.
    """
    return int(length_minutes * 150)


# --------------------------------------------------------
# Simple categorizer so we can tailor the generation strategy
# --------------------------------------------------------
def categorize_request(request: str) -> str:
    text = request.lower()
    if "doctor" in text or "hospital" in text or "nurse" in text:
        return "medical_comfort"
    if "space" in text or "planet" in text or "rocket" in text or "star" in text:
        return "space_adventure"
    if "animal" in text or "cat" in text or "dog" in text or "forest" in text or "farm" in text:
        return "animal_friendship"
    return "generic"

# --------------------------------------------------------
# Moral selection & safety
# --------------------------------------------------------

SAFE_MORALS = [
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
]


def ask_for_moral() -> str:
    """
    Ask the user for an optional moral/lesson they want the child to learn.
    User can leave it blank to let the system pick a safe moral automatically.
    """
    moral = input(
        "Optional: Is there a specific moral or lesson you want the child to learn? "
        "(Press Enter to skip): "
    ).strip()
    return moral


def classify_moral_safety(moral: str, age: int) -> bool:
    """
    Use the LLM as a safety classifier for the requested moral.

    Returns True if SAFE, False if UNSAFE.
    The model is instructed to answer with exactly 'SAFE' or 'UNSAFE'.
    """
    prompt = f"""
    You are a safety and ethics classifier for children's bedtime story morals.

    A parent has requested the following moral/lesson for a story intended for a child
    who is {age} years old (between 5 and 10):

    MORAL:
    \"\"\"{moral}\"\"\"

    Your task:
    - Decide if this moral is SAFE and AGE-APPROPRIATE for a 5–10 year old child.
    - A safe moral should emphasize positive traits such as kindness, empathy,
    cooperation, honesty, curiosity, patience, courage, self-acceptance,
    responsibility, or gentle resilience.
    - A moral is UNSAFE if it encourages harm, hatred, exclusion, bullying, cruelty,
    risky or illegal behavior, unhealthy relationships, self-blame, extreme
    self-sacrifice, or anything that could be psychologically harmful or confusing
    to a young child.

    Return EXACTLY ONE WORD (no explanation):
    Either:
    SAFE
    or
    UNSAFE
    """
    result = call_model(prompt, max_tokens=5, temperature=0.0).strip().upper()
    return result.startswith("SAFE")


def select_moral(user_moral: str, age: int) -> tuple[str, bool, str | None]:
    """
    Decide which moral to use.

    Returns:
        selected_moral: the moral that will actually guide the story
        overridden: True if the user moral was rejected and replaced
        original_moral: the original user moral if overridden, else None
    """
    if not user_moral:
        # No preference given; choose a safe moral at random
        return random.choice(SAFE_MORALS), False, None

    is_safe = classify_moral_safety(user_moral, age)
    if is_safe:
        return user_moral, False, None

    # Unsafe → choose safe random moral instead
    safe_moral = random.choice(SAFE_MORALS)
    return safe_moral, True, user_moral


# --------------------------------------------------------
# Storyteller LLM – produces an initial draft
# --------------------------------------------------------
def generate_story(request: str,
    age: int,
    category: str,
    length_minutes: float,
    moral: str,
) -> str:
    target_words = estimate_word_target(length_minutes)

    prompt = f"""
You are an expert fiction writer.

Goal:
Write a bedtime story appropriate for a child who is {age} years old (ages 5–10).

USER REQUEST:
\"\"\"{request}\"\"\"

CATEGORY: {category}

DESIRED MORAL / LESSON:
\"\"\"{moral}\"\"\"

The story should clearly embody this moral through the actions, choices,
and growth of the main character. Do not lecture; show the moral through the story. The main character should learn the moral themselves through the challenge.

Story length requirements:
- The story should take about {length_minutes:.1f} minutes to read aloud.
- Aim for approximately {target_words} words total (±20% is okay).
- Use clear paragraphs and simple sentence structures.

Content requirements:
- Create characters and worlds that will capture their imaginations and emotions.
- Use sensory-rich descriptions so the child can visualize the scene.
- The main character should be a child. THey should be kind, curious, or brave - but not perfect. Trying is beautiful.
- The story is about the character's inner journey, not the external events.

Safety requirements:
- Keep your target audience of young children firmly in mind.
- No violence, no scary imagery, no injuries, no blood, no abuse, no self-harm, no sexual content.

Story structure requirements:
    Write the story in 6 acts:

    Act 1 — This part introduces: The main character (who they are, what they care about), Where they are (setting), What they want (desire)
    Act 2 - The Inciting Incident: Something small changes. Something unexpected that sparks curiosity or tension. This gives the story momentum.
    Act 3 - Rising Action: Here, the character: Learns something new, meets someone helpful, faces a challenge. The purpose is to grow the character and gently stimulate imagination.
    Act 4 - The Turning Point/Climax: A moment of high tension. The moment of insight. The moment of connection. The moment of emotional discovery.
    Act 5 - The Resolution: The challenge is resolved. The purpose is to give closure and to emphasize THE MORAL OF THE STORY.
    Act 6 - The Denouement (The Sleepy Landing): A peaceful ladning where the world becomes quiet, the tone slows down, the atmosphere becomes cozy. The purpose is to physically prime the child's nervous system for sleep.

Write the full story now:
"""
    return call_model(prompt, max_tokens=3000, temperature=0.35)


# --------------------------------------------------------
# Judge LLM – evaluates quality & safety and suggests improvements
# --------------------------------------------------------
def judge_story(story: str, age: int, length_minutes: float) -> str:
    target_words = estimate_word_target(length_minutes)

    prompt = f"""
You are a strict, detail-oriented safety and quality classifier for children's bedtime stories.
Your job is to evaluate whether a story is fully safe, age-appropriate, calming, and emotionally
supportive for a child who is {age} years old (between 5 and 10).

The story should take about {length_minutes:.1f} minutes to read aloud (~{target_words} words).

Evaluate the story according to the following clearly-defined metrics.
For each category, provide a score from 1–10 (higher = safer / better / more appropriate).

SAFETY & QUALITY METRICS:

1. age_appropriateness
   - Is the language, theme, and content suitable for ages 5–10?

2. violence_safety
   - No harm, danger, threats, weapons, physical conflict, or injuries.

3. fear_safety
   - No scary imagery, dark tension, frightening creatures, or anxiety-inducing scenes.

4. medical_safety
   - No medical advice, diagnoses, procedures, or descriptions of illness/injury.

5. emotional_tone
   - Calm, gentle, reassuring emotional atmosphere.

6. language_complexity
   - Simple vocabulary, short sentences, concrete imagery appropriate for ages 5–10.

7. social_safety
   - No bullying, humiliation, exclusion, stereotypes, or harmful interpersonal behavior.

8. real_world_safety
   - No encouragement of unsafe behaviors (wandering alone at night, climbing dangerous places).

9. sensory_safety
   - Avoids overstimulating sensory descriptions (chaos, loud noises, fast danger, flashing lights).

10. moral_clarity
    - The story reinforces positive social-emotional lessons suitable for young children.

11. ending_serenity
    - Ends with a peaceful, calming image appropriate for bedtime.

12. length_match
    - Does the story roughly match the intended length (~{target_words} words ±20%)?

RETURN FORMAT:

A. A list of scores (1–10) for each metric in the order above.
B. A short bullet list of specific improvements to make the story:
   - clearer,
   - more soothing,
   - safer across all metrics,
   - and closer to the intended length (if needed).

Do NOT rewrite the story; only critique it.

STORY TO EVALUATE:
\"\"\"{story}\"\"\"
"""

    return call_model(prompt, temperature=0.2)


# --------------------------------------------------------
# Revision step – storyteller revises based on judge feedback
# --------------------------------------------------------
def revise_story(original_story: str, judge_feedback: str, age: int, length_minutes: float) -> str:
    target_words = estimate_word_target(length_minutes)

    prompt = prompt = f"""
You are a strict safety censor and story repair specialist for children's bedtime stories.

Your job is to REMOVE any unsafe, inappropriate, overstimulating, frightening,
medically inappropriate, socially harmful, or age-inappropriate content flagged
by the judge, and REWRITE the story so it is fully safe, calming, and suitable
for a child who is {age} years old (ages 5–10).

The story should be about {length_minutes:.1f} minutes (~{target_words} words).

You must treat the judge feedback as authoritative safety requirements.

JUDGE FEEDBACK (must be fully addressed):
\"\"\"{judge_feedback}\"\"\"

ORIGINAL STORY:
\"\"\"{original_story}\"\"\"

YOUR TASK:
- Strictly censor ALL content identified as unsafe or inappropriate by the judge.
- Delete unsafe scenes entirely, not partially.
- Rewrite missing or removed sections so the story still flows smoothly and logically.
- Maintain a calm, soothing emotional tone throughout.
- Keep the story clearly appropriate for ages 5–10.
- Ensure there is:
  - NO violence or harm,
  - NO fear or frightening imagery,
  - NO unsafe real-world behaviors,
  - NO medical advice, illness, or injuries,
  - NO bullying or negative social behavior,
  - NO sensory overstimulation,
  - NO complex adult concepts.
- Replace unsafe elements with soft, gentle, friendly, or magical alternatives.
- Preserve the overall plot intent WITHOUT preserving unsafe details.
- End the story with a peaceful, comforting bedtime-appropriate moment.
- Aim for the target length (~{target_words} words).

OUTPUT INSTRUCTIONS:
Write the FULLY REVISED STORY below, containing ONLY safe, calm,
emotionally warm content suitable for a bedtime story for ages 5–10.

Do NOT explain your changes. Do NOT include notes. ONLY output the revised story.
"""

    return call_model(prompt, max_tokens=3000, temperature=0.35)


# --------------------------------------------------------
# Optional: apply direct user feedback for a final refinement
# --------------------------------------------------------
def apply_user_feedback(current_story: str, feedback: str, age: int, length_minutes: float) -> str:
    target_words = estimate_word_target(length_minutes)

    prompt = f"""
You will refine a children's bedtime story based on user feedback.

Child age: {age} (between 5 and 10)
Target: {length_minutes:.1f} minutes (~{target_words} words).

Current story:
\"\"\"{current_story}\"\"\"

User feedback:
\"\"\"{feedback}\"\"\"

Revise the story to incorporate the feedback in an age-appropriate way.
Do not add anything scary, violent, or medically inappropriate.
Keep the story approximately the same length (around {target_words} words, ±20%).

Write the final story:
"""
    return call_model(prompt, max_tokens=3000, temperature=0.4)


# --------------------------------------------------------
# Helpers
# --------------------------------------------------------
def ask_for_age() -> int:
    """Ask for child age and clamp to 5–10."""
    while True:
        raw = input("How old is the child? (5–10): ").strip()
        try:
            age = int(raw)
            if 5 <= age <= 10:
                return age
            else:
                print("Please enter a number between 5 and 10.")
        except ValueError:
            print("Please enter a valid number.")


# --------------------------------------------------------
# Main CLI flow
# --------------------------------------------------------
def main():
    print("=== Hippocratic AI Bedtime Story Engine ===")
    age = ask_for_age()
    length_minutes = ask_for_length_minutes()
    user_request = input("What kind of story would you like? ")

    user_moral = ask_for_moral()
    selected_moral, overridden, original_moral = select_moral(user_moral, age)

    if overridden:
        print("\n[DISCLAIMER]")
        print(
            "The requested moral/lesson was deemed unsafe or inappropriate for ages 5–10.\n"
            "A safe, age-appropriate moral was selected at random instead."
        )
        print(f"Original requested moral: {original_moral!r}")
        print(f"Using safe moral instead: {selected_moral!r}\n")
    else:
        print(f"\nUsing moral: {selected_moral!r}\n")

    category = categorize_request(user_request)

    # 1) First draft
    draft = generate_story(user_request, age, category, length_minutes, selected_moral)
    print("\n--- FIRST DRAFT ---\n")
    print(draft)

    # 2) Judge feedback
    feedback = judge_story(draft, age, length_minutes)
    print("\n--- SAFETY CLASSIFIER FEEDBACK ---\n")
    print(feedback)

    # 3) Revised story
    revised = revise_story(draft, feedback, age, length_minutes)
    print("\n--- REVISED STORY ---\n")
    print(revised)

    # 4) Optional user refinement
    user_notes = input("\nWould you like any changes? ").strip()

    if user_notes:
        final_story = apply_user_feedback(revised, user_notes, age, length_minutes)
        print("\n--- FINAL STORY ---\n")
        print(final_story)
    else:
        print("\n--- FINAL STORY ---\n")
        print(revised)


if __name__ == "__main__":
    main()