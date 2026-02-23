# Deploy Stateful Viewers to Hugging Face Spaces

Step-by-step guide. Do each step in order.

---

## Endpoints the server implements

| Method | Path | Purpose |
|--------|------|--------|
| All | `/api/openai/*` | Proxy to `https://api.openai.com`; forward `X-OpenAI-API-Key` as `Authorization: Bearer`. |
| All | `/api/gemini/*` | Proxy to `https://generativelanguage.googleapis.com`; forward `X-Google-API-Key` as `x-goog-api-key`. |
| All | `/api/anthropic/*` | Proxy to `https://api.anthropic.com`; forward `X-Anthropic-API-Key` as `x-api-key`. |
| All | `/api/ollama/*` | On HF: returns 503 (no local Ollama). |
| All | `/images/*` | Proxy to `https://www.fredericbenard.com`. |
| POST | `/api/save-profile` | Body: JSON `{ id, ... }`. Writes to `data/profiles/<id>.json`. |
| POST | `/api/save-style` | Body: JSON `{ id, ... }`. Writes to `data/styles/<id>.json`. |
| POST | `/api/save-state` | Body: JSON `{ id, ... }`. Writes to `data/states/<id>.json`. |
| POST | `/api/save-reflection-session` | Body: JSON `{ profileId, galleryId, sessionStartedAt, ... }`. Writes to `data/reflections/`. |
| GET | `/api/list-profiles` | Returns `{ profiles: [...] }` from `data/profiles/` (including `public/`). |
| GET | `/api/list-styles` | Returns `{ styles: [...] }` from `data/styles/` (including `public/`), plus fallback extraction from `data/profiles/`. |
| GET | `/api/list-states` | Returns `{ states: [...] }` from `data/states/` (including `public/`), plus fallback extraction from `data/profiles/`. |
| GET | `/api/load-profile?id=<id>` | Returns `{ profile }` from `data/profiles/` or `data/profiles/public/`. |
| GET | `/api/load-style?id=<id>` | Returns `{ style }` from `data/styles/` / `data/styles/public/`, or falls back to extracting from `data/profiles/`. |
| GET | `/api/load-state?id=<id>` | Returns `{ state }` from `data/states/` / `data/states/public/`, or falls back to extracting from `data/profiles/`. |

Static SPA: serve `dist/` for all other routes (fallback to `index.html`). Health: `GET/POST /api/health` returns `{ ok: true }`.

---

## Step 1: Create the Space on Hugging Face

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces) and sign in (or create an account).
2. Click **"Create new Space"**.
3. Fill in:
   - **Space name:** e.g. `stateful-viewers` (or any name you like).
   - **License:** e.g. MIT.
   - **Select the Space SDK:** choose **Docker** (not Gradio, not Static).
4. Choose **Public** or **Private**.
5. Click **"Create Space"**.

You now have an empty Space. We'll add the app code next (Dockerfile + server + built frontend).

**Important:** After creation, note your Space URL:  
`https://huggingface.co/spaces/<your-username>/<space-name>`

---

## Step 2: App contents

The repo contains:

- **Dockerfile** — Builds the frontend (Vite) and runs a Node server. Uses `PORT=7860` for Hugging Face.
- **server/** — Express app that serves `dist/`, proxies `/api/openai`, `/api/gemini`, `/api/anthropic`, `/api/ollama`, `/images`, and handles save/load profiles and reflections.

Push this repo (or the branch you use) to the Space’s Git repo. Add the Space as a remote and push (Step 3).

---

## Step 3: Push to the Space and deploy

1. In your Space page on HF, open **Settings** and note the Git URL (e.g. `https://huggingface.co/spaces/<username>/<space-name>`).
2. **One-time:** add the Space as a remote:  
   `git remote add space https://huggingface.co/spaces/<username>/<space-name>`
3. **Log in:** `huggingface-cli login`, or use your [HF token](https://huggingface.co/settings/tokens) (write scope) as password when Git prompts.
4. **Push:** e.g. `git push space main` (or `git push space develop:main` to push `develop` as `main` on the Space).
5. HF builds the Docker image and starts the app. Watch **Logs**, then open **App** when the build finishes. Users set API keys in the app (BYOK).

---

## Step 4: Using the app on HF

- **API keys:** Users open the app → Settings → API Keys, and paste their OpenAI / Google / Anthropic keys. Keys are stored in the browser and sent with each request (passthrough); the server does not store them.
- **Language (EN/FR):** The app detects the browser language and defaults to EN or FR. Users can switch language at any time via the footer toggle. Gallery names/sections/descriptions/captions are served in the selected locale, and newly generated content follows the active locale.
- **Ollama:** Not available on HF (no local server). The app will show an option for Ollama but it will fail unless you run the app locally or elsewhere with Ollama.
- **Save/load artifacts (profiles/styles/states):** On HF, user-created artifacts are saved **in the browser (localStorage)** so they are not shared across users and survive Space restarts/deploys. They are still ephemeral in the sense that clearing site data (or switching browsers/devices) removes them. Public artifacts are served by the app as usual.
- **Saved data includes locale metadata:** saved profiles and reflection sessions include `locale` fields (and per-reflection `generatedAt` / optional per-reflection `locale`). Trajectory summaries include `trajectorySummaryLocale` and `trajectorySummaryGeneratedAt`.

---

## Notes

- **Cold start:** On the free tier the Space sleeps; the first load after idle can take 30–60 seconds.
- **Timeouts:** LLM calls use a 90s client timeout and 85s server proxy timeout (`PROXY_TIMEOUT_MS`). You can set `PROXY_TIMEOUT_MS` in the Space’s **Settings → Variables and secrets** if needed.
- **Persistence:** The server supports `DATA_DIR=/data` for persistent storage, but by default the app avoids writing user artifacts/sessions to the server filesystem on HF (to prevent cross-user sharing). If you want server-side persistence on HF, implement per-user partitioning (cookie/header-based user id) and/or remove the HF no-write guard.
- **Analytics (optional):** To enable Google Analytics on the deployed Space without committing it to the repo, set `GA_MEASUREMENT_ID` (public Variable) to your GA4 measurement ID (e.g. `G-XXXXXXXXXX`). If unset, no GA script is injected.
- **Build issues:** Check the Space **Logs** tab. The server uses the `PORT` environment variable (Dockerfile sets `PORT=7860` for HF).

---

## Troubleshooting: Space stuck in "Restarting"

If the Space shows "Restarting" and never loads:

1. **Check the Logs tab** — Open your Space → **Logs**. Look for:
   - `Stateful Viewers server loading...` — our process started; next line should be `Server listening on port 7860`
   - If you only see `Application Startup` (HF banner) and nothing else — the Node process may have crashed before logging; the Dockerfile uses `USER user` (UID 1000) per HF requirements to avoid permission issues
   - `FATAL: dist/index.html not found` — build failed or dist wasn’t copied
   - `Uncaught exception` / `Unhandled rejection` — runtime error (details will appear)
   - `EADDRINUSE` — port conflict (rare on HF)

2. **Build vs runtime** — If the build succeeds but the app restarts, the logs will show the runtime error. If the build fails, you’ll see the Docker build error.

3. **HF platform issues** — If logs show nothing useful or the build never finishes, try:
   - **Factory rebuild** — Space Settings → **Factory rebuild**
   - **New Space** — Create a new Space and push the same code again
   - **HF status** — Check [status.huggingface.co](https://status.huggingface.co) for incidents
