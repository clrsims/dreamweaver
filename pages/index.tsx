"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

//
// TYPES
//
type StoryConfig = {
  age: number | null;
  lengthMinutes: number;
  themes: string;
  moral: string;
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

type ApiResponse = {
  story: string;
  outline: StoryOutline;
  scenes: string[];
  moral: string;
  moralOverridden: boolean;
  moralDisclaimer?: string;
};

export default function Home() {
  //
  // FORM STATE
  //
  const [config, setConfig] = useState<StoryConfig>({
    age: 5,
    lengthMinutes: 10,
    themes: "",
    moral: "",
  });

  //
  // STORY STATE
  //
  const [isLoading, setIsLoading] = useState(false);
  const [story, setStory] = useState<string | null>(null);
  const [scenes, setScenes] = useState<string[]>([]);
  const [outline, setOutline] = useState<StoryOutline | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedMoral, setSelectedMoral] = useState<string | null>(null);
  const [moralOverridden, setMoralOverridden] = useState<boolean>(false);
  const [moralDisclaimer, setMoralDisclaimer] = useState<string | undefined>();

  //
  // SCENE NAVIGATION STATE
  //
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  //
  // AUDIO STATE
  //
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  //
  // IMAGE STATE
  //
  const [sceneImages, setSceneImages] = useState<(string | null)[]>([]);
  const [sceneImageLoading, setSceneImageLoading] = useState(false);
  const [sceneImageError, setSceneImageError] = useState<string | null>(null);

  //
  // FORM SUBMIT
  //
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setStory(null);
    setScenes([]);
    setOutline(null);
    setSelectedMoral(null);
    setMoralOverridden(false);
    setMoralDisclaimer(undefined);
    setCurrentSceneIndex(0);
    stopSpeaking();
    clearAudio();
    setSceneImages([]);
    setSceneImageLoading(false);
    setSceneImageError(null);

    // Validate age
    if (
      config.age === null ||
      Number.isNaN(config.age) ||
      config.age < 5 ||
      config.age > 10
    ) {
      setIsLoading(false);
      setError("Please enter a child age between 5 and 10.");
      return;
    }

    try {
      const res = await fetch("/api/generate-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data: ApiResponse = await res.json();

      setStory(data.story);
      setScenes(data.scenes || []);
      setOutline(data.outline || null);
      setCurrentSceneIndex(0);

      // New moral state
      setSelectedMoral(data.moral ?? null);
      setMoralOverridden(data.moralOverridden ?? false);
      setMoralDisclaimer(data.moralDisclaimer);

      // Set placeholders for images
      setSceneImages(Array((data.scenes || []).length).fill(null));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  function handleChange<K extends keyof StoryConfig>(
    key: K,
    value: StoryConfig[K]
  ) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  //
  // AUDIO
  //
  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  }

  function clearAudio() {
    if (audioRef.current) {
      audioRef.current.src = "";
    }
    if (audioSrc) {
      URL.revokeObjectURL(audioSrc);
    }
    setAudioSrc(null);
  }

  async function prepareSceneAudio(index: number) {
    const text = scenes[index];
    if (!text) return;
    if (!audioRef.current) return;

    try {
      setIsLoadingAudio(true);
      setIsSpeaking(false);

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        alert("Error generating audio.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (audioSrc) URL.revokeObjectURL(audioSrc);

      setAudioSrc(url);
      audioRef.current.src = url;
    } finally {
      setIsLoadingAudio(false);
    }
  }

  async function handlePlayPause() {
    if (!scenes.length) return;
    if (!audioRef.current) return;
    if (isLoadingAudio) return;

    // First click → generate audio
    if (!audioSrc) {
      await prepareSceneAudio(currentSceneIndex);
      return;
    }

    if (isSpeaking) {
      audioRef.current.pause();
      setIsSpeaking(false);
    } else {
      try {
        await audioRef.current.play();
        setIsSpeaking(true);
      } catch (err) {
        console.error("Audio play error:", err);
      }
    }
  }

  //
  // SCENE NAVIGATION
  //
  function goToScene(idx: number) {
    if (idx < 0 || idx >= scenes.length) return;
    setCurrentSceneIndex(idx);
    stopSpeaking();
    clearAudio();
  }

  //
  // ILLUSTRATIONS
  //
  async function generateSceneImage(index: number) {
    if (!outline || !outline.scenes[index]) return;

    const summary = outline.scenes[index].summary;

    try {
      setSceneImageLoading(true);
      setSceneImageError(null);

      const res = await fetch("/api/scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });

      const data = await res.json();
      if (data.placeholder) {
        return;
      }

      if (data.imageUrl) {
        setSceneImages((prev) => {
          const next = [...prev];
          next[index] = data.imageUrl;
          return next;
        });
      }
    } catch (err) {
      setSceneImageError("Could not generate illustration.");
    } finally {
      setSceneImageLoading(false);
    }
  }

  //
  // CLEANUP
  //
  useEffect(() => {
    return () => clearAudio();
  }, []);

  //
  // AUTO-GENERATE ILLUSTRATIONS
  //
  useEffect(() => {
    if (!scenes.length || !outline) return;
    if (!sceneImages[currentSceneIndex]) {
      generateSceneImage(currentSceneIndex);
    }
  }, [currentSceneIndex, scenes, outline]);

  //
  // RENDER
  //

  const currentSceneText = scenes[currentSceneIndex] || null;
  const currentScenePlan = outline?.scenes[currentSceneIndex] || null;

  const totalScenes = scenes.length;

  const playButtonLabel = isLoadingAudio
    ? "Generating..."
    : !audioSrc
    ? "Read Aloud"
    : isSpeaking
    ? "Pause"
    : "Play";

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: "2rem 1rem 4rem",
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
      }}
    >
      <header style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.25rem" }}>
          DreamWeaver – Bedtime Story Maker
        </h1>
        <p style={{ color: "#555" }}>
          Generate a safe, personalized bedtime story for your child.
        </p>
      </header>

      {/* FORM */}
      <section
        style={{
          borderRadius: 18,
          padding: "1.75rem",
          marginBottom: "2.25rem",
          boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
          backgroundColor: "white",
        }}
      >
        <h2 style={{ margin: 0, marginBottom: "1rem" }}>Story Settings</h2>

        <form onSubmit={handleSubmit}>
          <div
            style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem" }}
          >
            {/* AGE */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <label>Child age</label>
              <input
                type="number"
                min={5}
                max={10}
                value={config.age ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  handleChange("age", v === "" ? null : Number(v));
                }}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.6rem",
                  borderRadius: 10,
                  border: "1px solid #d4d4d8",
                }}
              />
            </div>

            {/* LENGTH */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <label>Story length (minutes)</label>
              <select
                value={config.lengthMinutes}
                onChange={(e) =>
                  handleChange("lengthMinutes", Number(e.target.value))
                }
                style={{
                  width: "100%",
                  padding: "0.5rem 0.6rem",
                  borderRadius: 10,
                  border: "1px solid #d4d4d8",
                }}
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
            </div>
          </div>

          {/* THEMES */}
          <label>Themes (comma-separated)</label>
          <input
            type="text"
            placeholder="space, friendship, animals"
            value={config.themes}
            onChange={(e) => handleChange("themes", e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.6rem",
              borderRadius: 10,
              border: "1px solid #d4d4d8",
            }}
          />

          {/* MORAL */}
          <div style={{ marginTop: "1rem" }}>
            <label>Desired moral / lesson (optional)</label>
            <input
              type="text"
              placeholder="e.g. always be kind, honesty matters"
              value={config.moral}
              onChange={(e) => handleChange("moral", e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.6rem",
                borderRadius: 10,
                border: "1px solid #d4d4d8",
              }}
            />
          </div>

          {/* SUBMIT */}
          <div style={{ marginTop: "1.6rem" }}>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: "0.7rem 1.5rem",
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, #2563eb, #4f46e5, #6366f1)",
                color: "white",
                fontWeight: 600,
                cursor: isLoading ? "wait" : "pointer",
              }}
            >
              {isLoading ? "Generating story…" : "Generate Story"}
            </button>

            {error && (
              <span style={{ color: "#b91c1c", marginLeft: "1rem" }}>
                Error: {error}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* STORY VIEW */}
      {outline && scenes.length > 0 && (
        <section style={{ marginBottom: "2.5rem" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", marginBottom: 16 }}>
            <h2 style={{ marginBottom: 4 }}>{outline.title}</h2>
            <p style={{ marginTop: 4, color: "#6b7280" }}>
              Setting: {outline.setting}
            </p>

            {/* MORAL DISPLAY */}
            {selectedMoral && (
              <p style={{ marginTop: 8, fontSize: "0.9rem", color: "#374151" }}>
                <strong>Moral:</strong> {selectedMoral}
              </p>
            )}
            {moralDisclaimer && (
              <p style={{ marginTop: 4, color: "#b91c1c", fontSize: "0.8rem" }}>
                {moralDisclaimer}
              </p>
            )}
          </div>

          {/* SCENE VIEW */}
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              backgroundColor: "white",
              borderRadius: 24,
              padding: "1.75rem",
              boxShadow: "0 12px 30px rgba(15,23,42,0.10)",
            }}
          >
            {/* IMAGE */}
            {sceneImages[currentSceneIndex] ? (
              <img
                src={sceneImages[currentSceneIndex] as string}
                alt="Scene"
                style={{
                  width: "100%",
                  borderRadius: 18,
                  boxShadow: "0 6px 18px rgba(15,23,42,0.20)",
                  marginBottom: 16,
                }}
              />
            ) : sceneImageLoading ? (
              <div style={{ padding: 16 }}>Painting illustration…</div>
            ) : (
              <div
                style={{
                  height: 180,
                  borderRadius: 18,
                  background:
                    "linear-gradient(135deg, #1d4ed8, #4f46e5, #a855f7)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                Cozy night sky – illustration on standby 🌙
              </div>
            )}

            {/* SUMMARY */}
            {currentScenePlan && (
              <p style={{ fontStyle: "italic", marginBottom: 16 }}>
                {currentScenePlan.summary}
              </p>
            )}

            {/* TEXT */}
            <div
              style={{
                backgroundColor: "#f9fafb",
                padding: 16,
                borderRadius: 16,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                {currentSceneText}
              </p>
            </div>

            {/* HIDDEN AUDIO */}
            <audio
              ref={audioRef}
              src={audioSrc || undefined}
              onEnded={() => setIsSpeaking(false)}
              style={{ display: "none" }}
            />

            {/* CONTROLS */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 16,
              }}
            >
              <button
                onClick={handlePlayPause}
                disabled={isLoadingAudio}
                style={{
                  padding: "0.5rem 1.2rem",
                  borderRadius: 999,
                  background:
                    "linear-gradient(135deg, #059669, #10b981, #34d399)",
                  color: "white",
                }}
              >
                🔊 {playButtonLabel}
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => goToScene(currentSceneIndex - 1)}
                  disabled={currentSceneIndex === 0}
                >
                  ◀ Previous
                </button>
                <button
                  onClick={() => goToScene(currentSceneIndex + 1)}
                  disabled={currentSceneIndex === scenes.length - 1}
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* DEBUG FULL STORY */}
      {story && (
        <section style={{ maxWidth: 720, margin: "0 auto" }}>
          <h3>Full Story (debug)</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              backgroundColor: "white",
              padding: "1rem",
              borderRadius: 12,
            }}
          >
            {story}
          </pre>
        </section>
      )}
    </main>
  );
}
