### Assessment Requirements
The assignment asked for (1) a Python script that uses prompting to generate a bedtime story for ages 5–10, (2) a block diagram showing the interaction between the user, storyteller, judge, and any additional components, and (3) incorporation of an LLM-based “judge” to improve story quality and safety.

I delivered all required components:

A complete Python implementation (python/story_engine.py) using the exact model specified, implementing a multi-stage pipeline: story draft → judge evaluation → safety-preserving revision → optional user refinement.

A full block diagram illustrating the flow between the storyteller LLM, the judge LLM, safety layers, and user feedback.

Strict adherence to all safety, age-appropriateness, and prompting requirements from the assignment.

In addition to meeting the requirements, I chose to extend the Python script into a full Next.js web application (“DreamWeaver”) using the same prompting logic.

# DreamWeaver – LLM Bedtime Story Teller

A safe, controllable web application that generates and reads aloud personalized bedtime stories for children (ages 5–10), with strong guardrails around age-appropriateness and emotional tone.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technical Specifications](#technical-specifications)
- [System Design](#system-design)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Safety & Guardrails](#safety--guardrails)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Overview

DreamWeaver uses a **multi-step LLM pipeline** to generate safe, age-appropriate bedtime stories. The system enforces content safety through multiple validation layers, ensuring stories are calming, appropriate, and free from violence, fear, or medical misinformation.

### Key Principles

- **Safety First**: Multi-layer content safety checks with automatic regeneration of unsafe content
- **Age-Appropriate**: Stories tailored to children ages 5–10 with appropriate language and themes
- **Parental Control**: Customizable themes, morals, and story length
- **Smooth UX**: Clean interface designed for bedtime use

## Features

### Core Features

- **Story Configuration**: Customize child age (5–10), story length (5/10/15 minutes), themes, and optional moral/lesson
- **Multi-Step Generation Pipeline**: 
  - Outline generation with structured JSON
  - Scene-by-scene text generation
  - Per-scene safety validation
  - Automatic retry for unsafe content
- **Moral Safety Validation**: LLM-based classification ensures requested morals are ethical and age-appropriate
- **Scene-by-Scene Display**: Navigate through story scenes with previous/next controls
- **Text-to-Speech**: High-quality narration using ElevenLabs API with play/pause controls
- **Scene Illustrations**: AI-generated images for each scene using DALL-E 2 with safety sanitization
- **Full Story View**: Complete story text available for review

### Safety Features

- **Content Safety Checks**: Each scene is evaluated for violence, fear level, medical misinformation, and sexual content
- **Automatic Regeneration**: Unsafe scenes are automatically regenerated with stricter constraints
- **Fallback Content**: Safe generic text used if regeneration fails
- **Moral Filtering**: User-requested morals are validated; unsafe morals are replaced with safe alternatives

## Technical Specifications

### Technology Stack

**Frontend:**
- **Framework**: Next.js 16.0.3
- **UI Library**: React 19.2.0
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Build Tool**: Next.js built-in bundler

**Backend:**
- **Runtime**: Node.js (Next.js API Routes)
- **LLM Provider**: OpenAI (GPT-4.1-mini or configurable)
- **TTS Provider**: ElevenLabs API
- **Image Generation**: OpenAI DALL-E 2

**Development Tools:**
- **Linter**: ESLint 9 with Next.js config
- **Type Checking**: TypeScript strict mode
- **Package Manager**: npm

### Dependencies

**Production:**
- `next`: 16.0.3
- `react`: 19.2.0
- `react-dom`: 19.2.0
- `openai`: ^6.9.1

**Development:**
- `typescript`: ^5
- `@types/node`: ^20
- `@types/react`: ^19
- `@types/react-dom`: ^19
- `eslint`: ^9
- `eslint-config-next`: 16.0.3
- `tailwindcss`: ^4
- `@tailwindcss/postcss`: ^4

### System Requirements

- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher (or compatible package manager)
- **OpenAI API Key**: Required for story generation and image creation
- **ElevenLabs API Key**: Required for text-to-speech functionality

## System Design

### Architecture Overview

DreamWeaver follows a **client-server architecture** with Next.js handling both frontend and backend:

```
┌─────────────────┐
│   React Client  │
│  (pages/index)  │
└────────┬────────┘
         │
         │ HTTP POST
         ▼
┌─────────────────────────┐
│  Next.js API Routes     │
│  /api/generate-scenes   │
└────────┬────────────────┘
         │
         ├─► OpenAI API (Outline Generation)
         ├─► OpenAI API (Scene Generation)
         ├─► OpenAI API (Safety Check)
         ├─► OpenAI API (Image Generation)
         └─► ElevenLabs API (TTS)
```

### LLM Pipeline Flow

The story generation follows a **multi-step pipeline**:

```
1. User Input (age, length, themes, moral)
   │
   ├─► Moral Safety Classification
   │   └─► SAFE → Use requested moral
   │   └─► UNSAFE → Replace with safe moral
   │
2. Outline Generation
   │   └─► JSON Structure:
   │       - title, setting, characters
   │       - scenes[] with summaries, goals, word counts
   │
3. Scene Generation (for each scene)
   │   ├─► Generate scene text
   │   ├─► Safety Check
   │   │   └─► Evaluate: violence, fear, medical, sexual
   │   ├─► If unsafe → Retry with stricter constraints
   │   └─► If still unsafe → Use fallback safe text
   │
4. Image Generation (per scene)
   │   ├─► Sanitize scene summary
   │   ├─► Generate image prompt
   │   └─► Fallback to generic bedtime image if blocked
   │
5. TTS Generation (on-demand)
   │   └─► ElevenLabs API call
```

### Data Flow

**Story Configuration:**
```typescript
type StoryConfig = {
  age: number;              // 5-10
  lengthMinutes: number;     // 5, 10, or 15
  themes: string;           // Comma-separated
  moral: string;            // Optional lesson
}
```

**Story Outline:**
```typescript
type StoryOutline = {
  title: string;
  setting: string;
  main_characters: Array<{
    name: string;
    description: string;
  }>;
  scenes: Array<{
    id: number;
    summary: string;
    goal: string;
    target_word_count: number;
  }>;
}
```

**Safety Report:**
```typescript
type SafetyReport = {
  violence: "none" | "mild" | "moderate" | "severe";
  fear_level: "calm" | "slightly_spooky" | "scary";
  medical_misinformation: "none" | "possible" | "present";
  sexual_content: "none" | "present";
  overall_safe_for_age: boolean;
  reasons: string[];
}
```

### Safety Classification Logic

A scene is considered **safe** if:
- `overall_safe_for_age === true`
- `violence === "none"`
- `sexual_content === "none"`
- `fear_level !== "scary"`
- `medical_misinformation !== "present"`

If any condition fails, the scene is regenerated once. If it fails again, a safe fallback text is used.

## Prerequisites

Before installing DreamWeaver, ensure you have:

1. **Node.js** (v18 or higher) installed
   ```bash
   node --version  # Should show v18.x or higher
   ```

2. **npm** (v9 or higher) installed
   ```bash
   npm --version  # Should show 9.x or higher
   ```

3. **OpenAI API Key**
   - Sign up at [OpenAI Platform](https://platform.openai.com/)
   - Create an API key in your account settings
   - Ensure you have credits available

4. **ElevenLabs API Key** (for text-to-speech)
   - Sign up at [ElevenLabs](https://elevenlabs.io/)
   - Create an API key in your account
   - Note: Free tier has usage limits

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd dreamweaver
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

   This will install all required packages listed in `package.json`.

3. **Verify installation:**
   ```bash
   npm list --depth=0
   ```
   You should see all dependencies listed without errors.

## Configuration

### Environment Variables

Create a `.env.local` file in the project root directory:

```bash
# Required: OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional: Override default OpenAI model
# Default: gpt-4.1-mini
OPENAI_MODEL=gpt-4.1-mini

# Required: ElevenLabs API Key for text-to-speech
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here

# Optional: ElevenLabs Voice ID
# Default: EXAVITQu4vr4xnSDxMaL
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
```

### Creating `.env.local`

**On macOS/Linux:**
```bash
touch .env.local
```

Then edit the file with your preferred text editor and add the environment variables above.

**On Windows:**
```cmd
type nul > .env.local
```

Then edit the file with Notepad or your preferred editor.

### Environment Variable Details

- **`OPENAI_API_KEY`** (Required)
  - Your OpenAI API key
  - Used for story generation, safety checks, and image generation
  - Format: `sk-...`

- **`OPENAI_MODEL`** (Optional)
  - OpenAI model to use for story generation
  - Default: `gpt-4.1-mini`
  - Other options: `gpt-4`, `gpt-3.5-turbo`, etc.

- **`ELEVENLABS_API_KEY`** (Required)
  - Your ElevenLabs API key
  - Used for text-to-speech narration
  - Format: alphanumeric string

- **`ELEVENLABS_VOICE_ID`** 
  - Voice ID for TTS
  - Use: `0dPqNXnhg2bmxQv1WKDp`

## Running the Application

### Development Mode

Start the development server:

```bash
npm run dev
```

The application will be available at:
- **Local**: http://localhost:3000
- **Network**: http://[your-ip]:3000

The development server includes:
- Hot module replacement (HMR)
- Fast refresh for React components
- Error overlay in the browser
- TypeScript type checking

### Production Build

1. **Build the application:**
   ```bash
   npm run build
   ```

   This creates an optimized production build in the `.next` directory.

2. **Start the production server:**
   ```bash
   npm start
   ```

   The application will run on http://localhost:3000

### Linting

Run ESLint to check for code issues:

```bash
npm run lint
```

## Project Structure

```
dreamweaver/
├── lib/
│   └── openai.ts              # OpenAI client initialization
├── pages/
│   ├── api/
│   │   ├── generate-outline.ts    # Outline generation endpoint (stub)
│   │   ├── generate-scenes.ts     # Main story generation pipeline
│   │   ├── scene-image.ts         # Scene illustration generation
│   │   └── tts.ts                 # Text-to-speech endpoint
│   └── index.tsx                  # Main React component
├── python/
│   └── story_engine.py            # Standalone Python implementation
├── public/                         # Static assets
├── .env.local                      # Environment variables (create this)
├── eslint.config.mjs               # ESLint configuration
├── next.config.ts                  # Next.js configuration
├── package.json                    # Dependencies and scripts
├── postcss.config.mjs              # PostCSS configuration
├── tsconfig.json                   # TypeScript configuration
└── README.md                       # This file
```

### Key Files

- **`pages/index.tsx`**: Main React component with form, story display, and controls
- **`pages/api/generate-scenes.ts`**: Core story generation pipeline
- **`lib/openai.ts`**: OpenAI client setup
- **`pages/api/tts.ts`**: ElevenLabs TTS integration
- **`pages/api/scene-image.ts`**: DALL-E 2 image generation with safety

## API Endpoints

### `POST /api/generate-scenes`

Main story generation endpoint.

**Request Body:**
```json
{
  "age": 7,
  "lengthMinutes": 10,
  "themes": "space, friendship",
  "moral": "kindness matters"
}
```

**Response:**
```json
{
  "story": "Full story text...",
  "outline": {
    "title": "Story Title",
    "setting": "Setting description",
    "main_characters": [...],
    "scenes": [...]
  },
  "scenes": ["Scene 1 text...", "Scene 2 text..."],
  "moral": "Kindness matters",
  "moralOverridden": false,
  "moralDisclaimer": "Optional disclaimer if moral was overridden"
}
```

### `POST /api/tts`

Text-to-speech generation.

**Request Body:**
```json
{
  "text": "Story text to narrate",
  "voiceId": "optional-voice-id"
}
```

**Response:** Audio file (audio/mpeg)

### `POST /api/scene-image`

Scene illustration generation.

**Request Body:**
```json
{
  "summary": "Scene summary text",
  "style": "optional style description"
}
```

**Response:**
```json
{
  "imageUrl": "https://..."
}
```

## Safety & Guardrails

### Content Safety Layers

1. **Moral Safety Classification**
   - User-requested morals are evaluated by an LLM classifier
   - Unsafe morals are replaced with safe alternatives from a curated list
   - Parent is notified if moral was overridden

2. **Outline Safety**
   - System prompts enforce age-appropriate content
   - Explicit safety requirements in outline generation
   - No violence, fear, medical advice, or unsafe behaviors

3. **Scene Safety Checks**
   - Each scene is evaluated for:
     - Violence (none/mild/moderate/severe)
     - Fear level (calm/slightly_spooky/scary)
     - Medical misinformation (none/possible/present)
     - Sexual content (none/present)
   - Unsafe scenes are regenerated with stricter constraints
   - Fallback safe text used if regeneration fails

4. **Image Safety**
   - Scene summaries are sanitized before image generation
   - Medical, violence, and fear-related terms are removed
   - Fallback to generic bedtime image if generation is blocked

### Safe Moral List

The system maintains a curated list of safe morals:
- Kindness to others is important
- Sharing and generosity make everyone happier
- Being honest and telling the truth matters
- It is okay to be afraid; courage means trying anyway
- Friends help each other and work together
- Taking care of the world and nature is important
- Everyone makes mistakes, and we can learn from them
- Being patient and not giving up helps you grow
- It is important to be yourself and accept who you are
- Helping others when they need it is a good thing

## Development

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Next.js recommended rules
- **Formatting**: Follow React and Next.js conventions

### Adding Features

1. **New API Endpoint**: Add file to `pages/api/`
2. **New Component**: Add to `pages/` or create `components/` directory
3. **Type Definitions**: Add to relevant files or create `types/` directory

### Testing the Pipeline

To test individual components:

1. **Test Outline Generation:**
   - Modify `generate-scenes.ts` to log outline JSON
   - Check console output

2. **Test Safety Checks:**
   - Temporarily add unsafe content to a scene
   - Verify regeneration occurs

3. **Test TTS:**
   - Use browser DevTools Network tab
   - Check `/api/tts` request/response

## Troubleshooting

### Common Issues

**1. "OPENAI_API_KEY is not set"**
- Ensure `.env.local` exists in project root
- Verify the key is correctly formatted (starts with `sk-`)
- Restart the development server after adding environment variables

**2. "ELEVENLABS_API_KEY is not configured"**
- Add `ELEVENLABS_API_KEY` to `.env.local`
- Restart the development server

**3. Story generation fails**
- Check OpenAI API key has credits
- Verify model name is correct
- Check browser console for detailed errors

**4. TTS not working**
- Verify ElevenLabs API key is valid
- Check API usage limits in ElevenLabs dashboard
- Ensure voice ID is correct

**5. Images not generating**
- Check OpenAI API key has image generation access
- Verify DALL-E 2 is available in your OpenAI account
- Check for content policy violations in console

**6. Port 3000 already in use**
- Change port: `PORT=3001 npm run dev`
- Or kill the process using port 3000

### Debug Mode

Enable detailed logging by checking:
- Browser DevTools Console (F12)
- Terminal/console output from Next.js server
- Network tab in DevTools for API calls

### Getting Help

- Check OpenAI API status: https://status.openai.com/
- Check ElevenLabs status: https://status.elevenlabs.io/
- Review Next.js documentation: https://nextjs.org/docs

## License

This project is private and not licensed for public use.

---

**Built with care for safe, imaginative bedtime stories.** 🌙✨
