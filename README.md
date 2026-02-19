---
title: Stateful Viewers
emoji: 🖼️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# Stateful Viewers

*A viewer whose perception evolves with each image*

Stateful Viewers is an art and research project that simulates a visitor walking through a gallery. A vision–language model reflects on images one at a time, carrying forward memory, attention, and affect so that each encounter subtly shapes how subsequent images are perceived.

Rather than treating images as independent inputs, the system models viewing as a continuous, cumulative experience.

## Features

- **Viewer Profile Generation** — Generate a unique viewer profile and reflection style (plus a short label) before viewing galleries
- **Load Saved Profiles** — Load previously generated profiles; the list is filtered by the selected LLM provider
- **English + French (EN/FR)** — UI localization, locale-aware scraping (gallery names/sections/descriptions/captions), and locale-aware generation/TTS
- **Multiple Vision Providers** — Use LLaVA-1.6 7B / Llama 3.1 8B Instruct (Q5_K_M quantized) via Ollama (local), GPT-5.2 via OpenAI (cloud), Gemini 3 Pro (preview) via Google (cloud), or Claude Sonnet 4.5 via Anthropic (cloud)
- **Stateful Reflections** — Each reflection is conditioned by prior encounters
- **Structured Output** — Reflections use `[REFLECTION]` and `[STATE]` blocks for clear parsing
- **Text-to-Speech** — Listen to reflections with customizable voice and playback rate
- **Auto Voice-Over** — Automatically play reflections during walk-through mode
- **Walk-Through Mode** — Automated guided tour with sequential image viewing
- **Reflection History** — Timeline of all reflections with quick navigation
- **Summarize Trajectory** — Generate a short narrative summary of how the experience moved through the gallery (phenomenological, non-reductive)

## Images & Copyright

Images displayed in this application are served from [fredericbenard.com](https://www.fredericbenard.com) (bilingual EN/FR galleries and captions).

**© 1990–2026 Frédéric Bénard. All rights reserved.**

These images are not part of the open-source repository and may not be copied, reused, or redistributed without permission.

## Prerequisites

### Local Models (Ollama / LLaVA-1.6)

```bash
# Pull the vision model (VLM)
ollama pull llava:7b

# Pull the text model for profile and style generation
ollama pull llama3.1:8b-instruct-q5_K_M

# Start Ollama (usually runs automatically)
ollama serve
```

### Cloud Models (OpenAI, Google Gemini, Anthropic)

This app uses **BYOK (bring your own key)**:

- Users paste API keys in the app UI (**Settings → API Keys**).
- Keys are stored in the browser and forwarded in request headers; the server does not store them.

Get keys from:
- **OpenAI** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Google Gemini** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Anthropic** — [console.anthropic.com](https://console.anthropic.com/)

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

In dev, `npm run dev` starts:
- **Vite** (frontend)
- **Node/Express** on `http://localhost:8787` (the app API server). Vite proxies `/api/*` to it.

**Language:**

- The app detects locale from the browser and persists your choice in localStorage.
- You can switch **EN/FR** via the footer toggle.

### Deploy to Hugging Face Spaces

The app can be deployed to [Hugging Face Spaces](https://huggingface.co/spaces) as a **Docker** Space. Users bring their own API keys (BYOK) via the in-app Settings; no keys are stored on the server. Ollama is not available on HF (the UI falls back to cloud providers). For step-by-step instructions, see **[docs/deploy-huggingface.md](docs/deploy-huggingface.md)**.

## Usage

### 1. Generate or Load a Viewer Profile

Before selecting a gallery, either generate a new profile or load a saved one.

**Generate** — Click **"Generate viewer profile"** in the sidebar. This creates:

- **Viewer Profile** — Defines the viewer's initial perceptual stance (baseline affect, attention style, tolerance for ambiguity, aesthetic conditioning, etc.)
- **Reflection Style** — Defines how experience is expressed (explicitness, voice stability, pacing, distance from experience)
- **Label** — A short 2–5 word summary (e.g. “Anxious, detail-oriented observer”) for easy identification

**Load** — If you have saved profiles (dev server), click **"Load saved profile"** to see a list filtered by the currently selected LLM provider. Each entry shows the label and profile ID; click one to load it. The profile ID is always visible so you can match it to files in `data/profiles/` and `data/reflections/`.

These settings shape all subsequent reflections.

### 2. Select a Gallery

Choose from the scraped galleries. Gallery sections and names follow the selected locale (EN/FR). Images are loaded from fredericbenard.com.

### 3. Reflect on Images

- **Manual Reflection** — Click **"Reflect on this image"**
- **Walk-Through Mode** — Click **"Start walk-through"** for an automated sequence:
  - Reflects on each image in order
  - Auto-advances after voice-over completes (if enabled) or after a short delay
  - Can be paused or stopped at any time

### 4. Listen to Reflections

- Click **"Listen"** to hear a reflection
- Adjust **Rate** (0.5–1.5) and **Voice** (browser-provided voices)
- Enable **"Auto voice-over"** to play reflections automatically

### 5. Navigate History

The **Reflection History** panel shows all reflections in sequence. Click any entry to jump directly to that image.

### 6. Summarize Trajectory

After reflecting on at least one image, use **"Summarize trajectory"** to get a short narrative summary of how the experience moved (e.g. gradual settling, oscillation, depletion). This uses the same text LLM as profile generation; the summary appears below the buttons.

## How It Works

### Viewer Profile System

**Profile Generation**  
Creates a temporary inner stance rather than a fixed personality, including:

- Baseline emotional tone
- Tolerance for ambiguity
- Relationship to control and boundaries
- Attention style
- Level of embodied awareness
- Aesthetic conditioning

**Saved profiles**  
When you generate a profile and reflection style **while running the dev server** (`npm run dev`), they are written to `data/profiles/<uuid>.json`. Saving requires the dev server because it provides the `/api/save-profile` endpoint (served by the Node/Express app; Vite proxies `/api/*` to it). Each file includes: the UUID, generation timestamp, LLM used, an optional **label** (2–5 word summary), the generated profile and reflection style text, and optional raw LLM outputs. The filename is the profile’s UUID.

**Loading profiles**  
The dev server also exposes `/api/list-profiles?llm=<provider>` and `/api/load-profile?id=<uuid>`. The UI uses these to list and load saved profiles; the list is filtered by the selected LLM provider so you only see profiles generated with that provider.

**Reflection Style**  
Derived from the profile, defining:

- Explicitness of emotional language
- Stability of inner voice
- Distance from experience
- Pacing and length
- Restraint or confidence in expression

### Stateful Reflections

Each reflection:

- Incorporates the viewer profile and reflection style
- Carries forward accumulated internal state
- Evolves gradually unless an image is strongly disruptive
- Outputs structured `[REFLECTION]` and `[STATE]` blocks

**Saved reflection sessions**  
When you reflect on images with a profile that was successfully saved **and** the dev server is running, each reflection auto-saves the full session to `data/reflections/<profileId>_<galleryId>_<sessionStartedAt>.json`. One file per (profile, gallery) run is updated in place after every new reflection. The file embeds gallery metadata, profile and reflection style text, all reflections so far, and last internal state. Sessions are only saved when the app has a real `profileId` (i.e. profile save to the dev server succeeded). The saved JSON matches the structure used by the export utilities in code (`src/lib/exportSession.ts`) if you re-enable export in the UI.

Locale notes:

- Each reflection includes `generatedAt` (ISO) and may include `locale` (EN/FR).
- Trajectory summaries include `trajectorySummaryLocale` and `trajectorySummaryGeneratedAt`.

### Experiential Trajectory Analysis

Reflection sessions can be treated as **experiential trajectories**: ordered paths of internal state and reflection through a gallery, shaped by profile and reflection style. Analysis stays qualitative and phenomenological — no valence/arousal or sentiment scores.

**In the app**  
Use **"Summarize trajectory"** in the Reflection history section (after reflecting on at least one image) to get a narrative summary of the current run. It uses the same text LLM as profile generation.

**Data model**  

- `src/lib/trajectory.ts` — Defines `ExperientialTrajectory` and `trajectoryFromSession(session)`. A trajectory is an ordered sequence of steps (reflection text + internal state per image), plus gallery and viewer context.

**Implemented**  

- **Narrative summarization** (`src/lib/analyzeTrajectory.ts`) — `generateNarrativeSummary(trajectory, provider, locale)` produces a short reflective summary of how the experience moved (e.g. gradual settling, oscillation, depletion, drift). In the UI this is triggered by the button in the Reflection history section; programmatically, load a session from `data/reflections/*.json`, convert with `trajectoryFromSession()`, then call `generateNarrativeSummary()` with your chosen LLM provider and target locale. See `docs/trajectory-summary-prompt-example.md` for the exact prompt sent to the LLM.

## Research Positioning

Stateful Viewers draws on reception theory, phenomenology, and aesthetic psychology. It models a viewer's perceptual stance prior to viewing, maintains a stable expressive voice across images, and treats emotional response as something that unfolds over time.

The system operationalizes qualitative theories of aesthetic experience within a structured generative framework, without reducing experience to numerical scores or fixed emotion labels.

### Prompt-to-Research Mapping

| Prompt              | Research Anchor                                                | Core Thinkers                  |
| ------------------- | -------------------------------------------------------------- | ------------------------------ |
| Viewer Profile      | Reception theory, phenomenology of perception                  | Jauss, Merleau-Ponty, Gombrich |
| Reflection Style    | Inner speech, narrative psychology, phenomenological reduction | Vygotsky, Bruner, Husserl      |
| Stateful Reflection | Aesthetic experience as process, affect dynamics               | Dewey, Tomkins                 |

### Relation to Affective Computing

While the system tracks internal state over time, it differs fundamentally from affective computing. Rather than detecting, classifying, or predicting emotion, it models aesthetic experience as situated, qualitative, and temporally unfolding.

Emotional state is treated as one component of lived experience, expressed through a stable reflective voice and shaped by prior orientation, attention style, and aesthetic conditioning.

Where affective computing often asks what emotion is present, Stateful Viewers asks *what it is like to encounter this image, having already encountered the previous ones.*

| Dimension         | Affective Computing       | Stateful Viewers          |
| ----------------- | ------------------------- | ------------------------- |
| Goal              | Detect / classify emotion | Simulate lived experience |
| View of the human | Signal source             | Situated subject          |
| Emotion           | Target variable           | Embedded component        |
| Representation    | Numeric / categorical     | Qualitative / narrative   |
| Time              | Discrete steps            | Continuous accumulation   |
| Ambiguity         | Minimized                 | Preserved                 |
| Outcome           | Prediction / adaptation   | Reflection / articulation |

## Project Structure

- `docs/` — Prompt examples (profile, reflection style, profile label, stateful reflection, trajectory summary) and deployment guide ([deploy-huggingface.md](docs/deploy-huggingface.md))
- `src/data/galleries.ts` — Gallery data types
- `src/data/galleries.en.json` — Scraped gallery data (EN)
- `src/data/galleries.fr.json` — Scraped gallery data (FR)
- `scripts/scrape-galleries.ts` — Gallery scraper
- `src/api/vision.ts` — Unified vision API router
- `src/api/ollama.ts` — Ollama/LLaVA-1.6 client
- `src/api/openai.ts` — OpenAI client
- `src/api/gemini.ts` — Gemini client
- `src/api/anthropic.ts` — Anthropic client
- `src/api/llm.ts` — Text-only LLM interface
- `src/prompts.ts` — Viewer profile, reflection style, and stateful prompts
- `src/lib/parseReflection.ts` — Parse `[REFLECTION]` / `[STATE]` blocks
- `src/lib/exportSession.ts` — Export session data
- `src/lib/saveProfile.ts` — Save generated profiles to `data/profiles/`
- `src/lib/loadProfile.ts` — List and load saved profiles (filtered by provider)
- `src/lib/saveReflectionSession.ts` — Auto-save reflection sessions to `data/reflections/`
- `src/lib/trajectory.ts` — Experiential trajectory types and `trajectoryFromSession()`
- `src/lib/analyzeTrajectory.ts` — Phenomenological analysis (narrative summary; extensible)
- `src/hooks/useSpeech.ts` — Text-to-speech utilities
- `src/App.tsx` — Main UI and state management

## Scripts

**Refresh gallery data** — To refresh galleries from fredericbenard.com:

```bash
npm run scrape
```

This updates `src/data/galleries.en.json` and `src/data/galleries.fr.json`.

**Add profile labels** — To add labels to existing profiles that are missing them (e.g. profiles created before the label feature):

```bash
npm run add-labels
```

The script reads API keys from environment variables, detects which providers are available, and only processes profiles for those providers. Profiles that already have a label are skipped. See `scripts/add-profile-labels.ts`.

Common variables:

- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `ANTHROPIC_API_KEY`
- `OLLAMA_BASE_URL` (optional; defaults to `http://localhost:11434`)

## Technical Notes

- **Vision Models**: LLaVA-1.6 7B (Ollama), GPT-5.2, Gemini 3 Pro (preview), Claude Sonnet 4.5
- **Text Models**: Llama 3.1 8B Instruct (Q5_K_M quantized) (Ollama), GPT-5.2, Gemini 3 Pro (preview), Claude Sonnet 4.5
- **API Proxying**: In dev, the frontend calls `/api/*`; Vite proxies most `/api/*` to the local Node/Express server, which proxies cloud providers. `/api/ollama/*` is proxied directly to Ollama for local usage.
- **Image Source**: Images proxied from fredericbenard.com
- **State Management**: React hooks with per-gallery state tracking
- **Text-to-Speech**: Web Speech API
- **Saved data** (dev + HF server): `data/profiles/` (generated profiles, with optional label), `data/reflections/` (reflection sessions); both are gitignored. Saving and loading are implemented by the Node/Express server (`/api/save-profile`, `/api/save-reflection-session`, `/api/list-profiles`, `/api/load-profile`). In dev, Vite proxies to this server; on Hugging Face Spaces, the same server runs inside the Docker container.

For production deployment to a static host, a backend is required to proxy cloud model requests and (if you want persistence) to provide save endpoints. **Hugging Face Spaces** is supported: use a Docker Space and follow [docs/deploy-huggingface.md](docs/deploy-huggingface.md); the repo’s Dockerfile and frontmatter (`sdk: docker`, `app_port: 7860`) are already configured for HF.

## References

**Phenomenology & Perception**

- Merleau-Ponty, M. (2012). *Phenomenology of perception* (D. A. Landes, Trans.). Routledge. (Original work published 1945)
- Husserl, E. (1982). *Ideas pertaining to a pure phenomenology and to a phenomenological philosophy, First Book* (F. Kersten, Trans.). Springer. (Original work published 1913)

**Reception Theory & Viewer Orientation**

- Jauss, H. R. (1982). *Toward an aesthetic of reception* (T. Bahti, Trans.). University of Minnesota Press.
- Gombrich, E. H. (1960). *Art and illusion: A study in the psychology of pictorial representation*. Princeton University Press.

**Aesthetic Experience as Process**

- Dewey, J. (2005). *Art as experience*. Perigee Books. (Original work published 1934)

**Inner Speech, Narrative, and Expression**

- Vygotsky, L. S. (1986). *Thought and language* (A. Kozulin, Trans.). MIT Press. (Original work published 1934)
- Bruner, J. (1990). *Acts of meaning*. Harvard University Press.

**Affect Theory & Affective Computing (for contrast)**

- Picard, R. W. (1997). *Affective computing*. MIT Press.
- Russell, J. A. (1980). A circumplex model of affect. *Journal of Personality and Social Psychology*, 39(6), 1161–1178.
- Tomkins, S. S. (1962). *Affect, imagery, consciousness: Vol. 1. The positive affects*. Springer.

