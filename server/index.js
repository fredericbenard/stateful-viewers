/**
 * Production server for Stateful Viewers.
 * Serves the Vite build and proxies /api/* and /images to external services.
 * BYOK: forwards X-OpenAI-API-Key, X-Google-API-Key, X-Anthropic-API-Key from request headers.
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ENABLE_DEBUG_ENDPOINTS =
  process.env.ENABLE_DEBUG_ENDPOINTS === 'true' || process.env.NODE_ENV !== 'production';
const ALLOWED_ORIGINS = new Set(
  String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
);
const GA_MEASUREMENT_ID = String(process.env.GA_MEASUREMENT_ID || '').trim();

// Data directory (use /data on HF paid persistent storage if set)
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const PROFILES_DIR = path.join(DATA_DIR, 'profiles');
const STYLES_DIR = path.join(DATA_DIR, 'styles');
const STATES_DIR = path.join(DATA_DIR, 'states');
const REFLECTIONS_DIR = path.join(DATA_DIR, 'reflections');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GALLERY_ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

// Ensure body is parsed for API routes
app.use(express.json({ limit: '10mb' }));

function getRequestOrigins(req) {
  const host = req.headers.host;
  if (!host) return [];
  const xfp = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = xfp || req.protocol || 'http';
  return [`${proto}://${host}`, `http://${host}`, `https://${host}`];
}

function isAllowedCorsOrigin(req, origin) {
  if (!origin || typeof origin !== 'string') return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  const requestOrigins = getRequestOrigins(req);
  return requestOrigins.includes(origin);
}

// CORS for /api: allow same-origin and optional ALLOWED_ORIGINS entries only.
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  const hasOrigin = typeof origin === 'string' && origin.length > 0;
  const allowed = hasOrigin && isAllowedCorsOrigin(req, origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-OpenAI-API-Key, X-Google-API-Key, X-Anthropic-API-Key');
  }
  if (req.method === 'OPTIONS') {
    if (hasOrigin && !allowed) {
      return res.status(403).json({ error: 'CORS origin not allowed' });
    }
    res.status(204).end();
    return;
  }
  if (hasOrigin && !allowed) {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }
  next();
});

// --- Proxy helpers (forward request to upstream, pass through key from header) ---
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || 85_000; // slightly under client 90s

function safeSend(res, status, body) {
  if (res.headersSent) return;
  res.status(status);
  if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  } else {
    res.end(body);
  }
}

// Headers we must not forward: hop-by-hop, and Content-Encoding (Node fetch decompresses
// the body, so we send decompressed bytes and must not claim the body is gzip/br)
const SKIP_RESPONSE_HEADERS = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade',
  'proxy-authorization', 'proxy-authenticate', 'content-encoding',
]);

function isValidGaMeasurementId(id) {
  // GA4 measurement IDs look like: G-XXXXXXXXXX (letters/digits; length can vary)
  return typeof id === 'string' && /^G-[A-Z0-9]{6,}$/i.test(id);
}

function gaTagSnippet(id) {
  // Keep formatting close to Google's recommended snippet.
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${id}');
</script>
`;
}

async function proxyRequest(req, res, upstreamOrigin, pathRewrite, getAuth) {
  const url = new URL(req.originalUrl, `http://${req.headers.host}`);
  const upstreamPath = pathRewrite ? pathRewrite(url.pathname) : url.pathname;
  const upstreamUrl = `${upstreamOrigin}${upstreamPath}${url.search}`;
  const headers = { ...req.headers, host: new URL(upstreamOrigin).host };
  delete headers['content-length'];
  const authHeader = getAuth(req);
  if (authHeader) {
    if (typeof authHeader === 'object') Object.assign(headers, authHeader);
    else headers['authorization'] = authHeader;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    // Use already-parsed req.body when present (express.json() consumes the stream first)
    const body =
      ['GET', 'HEAD'].includes(req.method)
        ? undefined
        : req.body !== undefined
          ? JSON.stringify(req.body)
          : await streamBody(req);
    const resp = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.headersSent) return;
    const cl = resp.headers.get('content-length');
    console.log(`[proxy] upstream ${resp.status} ${cl || 'chunked'} bytes`);
    res.status(resp.status);
    res.setHeader('Connection', 'keep-alive');
    // Only forward safe response headers (avoid hop-by-hop and connection-breaking headers)
    resp.headers.forEach((v, k) => {
      const key = k.toLowerCase();
      if (!SKIP_RESPONSE_HEADERS.has(key) && key !== 'content-length') res.setHeader(k, v);
    });
    // Stream when body exists so client gets data immediately (avoids HF proxy closing idle connection)
    if (resp.body != null && typeof resp.body.getReader === 'function') {
      const nodeStream = Readable.fromWeb(resp.body);
      nodeStream.pipe(res, { end: true });
      nodeStream.on('error', (e) => {
        if (!res.writableEnded) res.destroy(e);
      });
    } else {
      const buf = Buffer.from(await resp.arrayBuffer());
      res.setHeader('Content-Length', buf.length);
      res.end(buf);
    }
  } catch (e) {
    clearTimeout(timeoutId);
    if (res.headersSent) return;
    if (e.name === 'AbortError') {
      console.log('[proxy] upstream timeout');
      safeSend(res, 504, {
        error: `Upstream request timed out (${PROXY_TIMEOUT_MS / 1000}s). The API may be slow or the app was waking up. Try again.`,
      });
      return;
    }
    console.error('[proxy] upstream error', e.message || e);
    safeSend(res, 502, { error: String(e.message || e) });
  }
}

function streamBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Health check (for HF / load balancers; also lets the frontend verify the API is reachable)
// Support both GET and POST so we can verify POST requests work (profile generation uses POST)
app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true });
});
app.post('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true });
});

// Troubleshooting endpoint: expose only for non-production or when explicitly enabled.
if (ENABLE_DEBUG_ENDPOINTS) {
  // Simulate a slow response (like LLM). GET or POST ?delay=15 to wait 15s then return 200.
  // If GET works but POST fails, the HF proxy may be dropping slow POST responses.
  app.all('/api/test-slow-response', (req, res) => {
    const delaySec = Math.min(Number(req.query.delay) || 5, 30);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    console.log(`[test-slow] ${req.method} waiting ${delaySec}s then sending 200`);
    setTimeout(() => {
      if (res.headersSent) return;
      res.json({ ok: true, waited: delaySec, method: req.method });
    }, delaySec * 1000);
  });
}

// --- LLM / image proxies (BYOK: key from headers only) ---
// Use app.use (prefix match) instead of app.all('/path/*') — path-to-regexp rejects bare *
function wrapProxy(routeName, handler) {
  return (req, res) => {
    const bodyLen = req.body !== undefined ? JSON.stringify(req.body).length : 0;
    console.log(`[${routeName}] ${req.method} ${req.path} body=${bodyLen}`);
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((e) => {
        if (!res.headersSent) safeSend(res, 500, { error: String(e?.message || e) });
        console.error(`[${routeName}] error`, e);
      });
  };
}

app.use('/api/openai', wrapProxy('openai', (req, res) => {
  const key = (req.headers['x-openai-api-key'] || '').trim();
  return proxyRequest(req, res, 'https://api.openai.com', (p) => p.replace(/^\/api\/openai/, ''), () =>
    key ? { Authorization: `Bearer ${key}` } : null
  );
}));

app.use('/api/gemini', wrapProxy('gemini', (req, res) => {
  const key = (req.headers['x-google-api-key'] || '').trim();
  return proxyRequest(req, res, 'https://generativelanguage.googleapis.com', (p) => p.replace(/^\/api\/gemini/, ''), () =>
    key ? { 'x-goog-api-key': key } : null
  );
}));

app.use('/api/anthropic', wrapProxy('anthropic', (req, res) => {
  const key = (req.headers['x-anthropic-api-key'] || '').trim();
  return proxyRequest(req, res, 'https://api.anthropic.com', (p) => p.replace(/^\/api\/anthropic/, ''), () =>
    key ? { 'x-api-key': key } : null
  );
}));

// Ollama: not available on HF; return 503 with message
app.use('/api/ollama', (_req, res) => {
  res.status(503).json({
    error: 'Ollama is not available on this server. Use OpenAI, Gemini, or Anthropic, or run the app locally with Ollama.',
  });
});

// Images: proxy to fredericbenard.com
app.use('/images', (req, res) => {
  proxyRequest(req, res, 'https://www.fredericbenard.com', (p) => p, () => null);
});

// --- Save/load profiles and reflection sessions ---
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resolvePathInside(baseDir, fileName) {
  const base = path.resolve(baseDir);
  const target = path.resolve(baseDir, fileName);
  return target.startsWith(`${base}${path.sep}`) ? target : null;
}

function isValidProfileId(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function readJsonFileSafe(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => {
        const fp = path.join(dir, f);
        return f.endsWith('.json') && fs.existsSync(fp) && fs.statSync(fp).isFile();
      });
  } catch {
    return [];
  }
}

function profileToStyleSummary(profile) {
  if (!profile || !profile.id || !profile.reflectionStyle) return null;
  return {
    id: profile.id,
    generatedAt: profile.generatedAt,
    locale: profile.locale || 'en',
    llm: profile.llm,
    llmModelLabel: profile.llmModelLabel || profile.modelLabel,
    modelLabel: profile.modelLabel || profile.llmModelLabel,
    label: profile.styleLabel,
    reflectionStyleShort: profile.reflectionStyleShort,
  };
}

function profileToStateSummary(profile) {
  if (!profile || !profile.id || !profile.initialState) return null;
  return {
    id: profile.id,
    generatedAt: profile.generatedAt,
    locale: profile.locale || 'en',
    llm: profile.llm,
    llmModelLabel: profile.llmModelLabel || profile.modelLabel,
    modelLabel: profile.modelLabel || profile.llmModelLabel,
    label: profile.stateLabel,
    initialStateShort: profile.initialStateShort,
  };
}

function isValidGalleryId(value) {
  return typeof value === 'string' && GALLERY_ID_RE.test(value);
}

function isValidSessionStartedAt(value) {
  return typeof value === 'string' && ISO_UTC_RE.test(value);
}

app.post('/api/save-profile', (req, res) => {
  try {
    const payload = req.body;
    const id = payload?.id;
    if (!isValidProfileId(id)) {
      return res.status(400).json({ error: 'Missing or invalid id' });
    }
    ensureDir(PROFILES_DIR);
    const filePath = resolvePathInside(PROFILES_DIR, `${id}.json`);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid profile path' });
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    res.json({ ok: true, path: filePath });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/save-style', (req, res) => {
  try {
    const payload = req.body;
    const id = payload?.id;
    if (!isValidProfileId(id)) {
      return res.status(400).json({ error: 'Missing or invalid id' });
    }
    ensureDir(STYLES_DIR);
    const filePath = resolvePathInside(STYLES_DIR, `${id}.json`);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid style path' });
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    res.json({ ok: true, path: filePath });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/save-state', (req, res) => {
  try {
    const payload = req.body;
    const id = payload?.id;
    if (!isValidProfileId(id)) {
      return res.status(400).json({ error: 'Missing or invalid id' });
    }
    ensureDir(STATES_DIR);
    const filePath = resolvePathInside(STATES_DIR, `${id}.json`);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid state path' });
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    res.json({ ok: true, path: filePath });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/save-reflection-session', (req, res) => {
  try {
    const payload = req.body;
    const { profileId, galleryId, sessionStartedAt } = payload;
    if (!isValidProfileId(profileId) || !isValidGalleryId(galleryId) || !isValidSessionStartedAt(sessionStartedAt)) {
      return res.status(400).json({ error: 'Missing or invalid profileId, galleryId, or sessionStartedAt' });
    }
    const safeTime = String(sessionStartedAt).replace(/:/g, '-');
    ensureDir(REFLECTIONS_DIR);
    const fileName = `${profileId}_${galleryId}_${safeTime}.json`;
    const filePath = resolvePathInside(REFLECTIONS_DIR, fileName);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid reflection session path' });
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    res.json({ ok: true, path: filePath });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/list-profiles', (req, res) => {
  try {
    const publicDir = path.join(PROFILES_DIR, 'public');
    const profilesMap = new Map();

    if (fs.existsSync(publicDir)) {
      listJsonFiles(publicDir).forEach((file) => {
        const profile = readJsonFileSafe(path.join(publicDir, file));
        if (!profile?.id) return;
        profilesMap.set(profile.id, {
          id: profile.id,
          generatedAt: profile.generatedAt,
          locale: profile.locale || 'en',
          llm: profile.llm,
          llmModelLabel: profile.llmModelLabel || profile.modelLabel,
          modelLabel: profile.modelLabel || profile.llmModelLabel,
          label: profile.label,
        });
      });
    }

    if (fs.existsSync(PROFILES_DIR)) {
      listJsonFiles(PROFILES_DIR).forEach((file) => {
        const profile = readJsonFileSafe(path.join(PROFILES_DIR, file));
        if (!profile?.id) return;
        profilesMap.set(profile.id, {
          id: profile.id,
          generatedAt: profile.generatedAt,
          locale: profile.locale || 'en',
          llm: profile.llm,
          llmModelLabel: profile.llmModelLabel || profile.modelLabel,
          modelLabel: profile.modelLabel || profile.llmModelLabel,
          label: profile.label,
        });
      });
    }

    const profiles = Array.from(profilesMap.values());
    res.json({ profiles });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/list-styles', (req, res) => {
  try {
    const stylesMap = new Map();

    // 1) Extract styles from public profiles (fallback, lowest priority)
    const publicProfilesDir = path.join(PROFILES_DIR, 'public');
    listJsonFiles(publicProfilesDir).forEach((file) => {
      const profile = readJsonFileSafe(path.join(publicProfilesDir, file));
      const summary = profileToStyleSummary(profile);
      if (summary) stylesMap.set(summary.id, summary);
    });

    // 2) Extract styles from user profiles (fallback)
    listJsonFiles(PROFILES_DIR).forEach((file) => {
      const profile = readJsonFileSafe(path.join(PROFILES_DIR, file));
      const summary = profileToStyleSummary(profile);
      if (summary) stylesMap.set(summary.id, summary);
    });

    // 3) Public styles (tracked in git if present)
    const publicStylesDir = path.join(STYLES_DIR, 'public');
    listJsonFiles(publicStylesDir).forEach((file) => {
      const style = readJsonFileSafe(path.join(publicStylesDir, file));
      if (!style?.id) return;
      stylesMap.set(style.id, {
        id: style.id,
        generatedAt: style.generatedAt,
        locale: style.locale || 'en',
        llm: style.llm,
        llmModelLabel: style.llmModelLabel || style.modelLabel,
        modelLabel: style.modelLabel || style.llmModelLabel,
        label: style.label,
        reflectionStyleShort: style.reflectionStyleShort,
      });
    });

    // 4) User styles (highest priority)
    listJsonFiles(STYLES_DIR).forEach((file) => {
      const style = readJsonFileSafe(path.join(STYLES_DIR, file));
      if (!style?.id) return;
      stylesMap.set(style.id, {
        id: style.id,
        generatedAt: style.generatedAt,
        locale: style.locale || 'en',
        llm: style.llm,
        llmModelLabel: style.llmModelLabel || style.modelLabel,
        modelLabel: style.modelLabel || style.llmModelLabel,
        label: style.label,
        reflectionStyleShort: style.reflectionStyleShort,
      });
    });

    const styles = Array.from(stylesMap.values());
    res.json({ styles });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/list-states', (req, res) => {
  try {
    const statesMap = new Map();

    // 1) Extract states from public profiles (fallback, lowest priority)
    const publicProfilesDir = path.join(PROFILES_DIR, 'public');
    listJsonFiles(publicProfilesDir).forEach((file) => {
      const profile = readJsonFileSafe(path.join(publicProfilesDir, file));
      const summary = profileToStateSummary(profile);
      if (summary) statesMap.set(summary.id, summary);
    });

    // 2) Extract states from user profiles (fallback)
    listJsonFiles(PROFILES_DIR).forEach((file) => {
      const profile = readJsonFileSafe(path.join(PROFILES_DIR, file));
      const summary = profileToStateSummary(profile);
      if (summary) statesMap.set(summary.id, summary);
    });

    // 3) Public states (tracked in git if present)
    const publicStatesDir = path.join(STATES_DIR, 'public');
    listJsonFiles(publicStatesDir).forEach((file) => {
      const state = readJsonFileSafe(path.join(publicStatesDir, file));
      if (!state?.id) return;
      statesMap.set(state.id, {
        id: state.id,
        generatedAt: state.generatedAt,
        locale: state.locale || 'en',
        llm: state.llm,
        llmModelLabel: state.llmModelLabel || state.modelLabel,
        modelLabel: state.modelLabel || state.llmModelLabel,
        label: state.label,
        initialStateShort: state.initialStateShort,
      });
    });

    // 4) User states (highest priority)
    listJsonFiles(STATES_DIR).forEach((file) => {
      const state = readJsonFileSafe(path.join(STATES_DIR, file));
      if (!state?.id) return;
      statesMap.set(state.id, {
        id: state.id,
        generatedAt: state.generatedAt,
        locale: state.locale || 'en',
        llm: state.llm,
        llmModelLabel: state.llmModelLabel || state.modelLabel,
        modelLabel: state.modelLabel || state.llmModelLabel,
        label: state.label,
        initialStateShort: state.initialStateShort,
      });
    });

    const states = Array.from(statesMap.values());
    res.json({ states });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/load-profile', (req, res) => {
  try {
    const id = req.query.id;
    if (!isValidProfileId(id)) return res.status(400).json({ error: 'Missing or invalid id parameter' });
    const userFilePath = resolvePathInside(PROFILES_DIR, `${id}.json`);
    const publicFilePath = resolvePathInside(path.join(PROFILES_DIR, 'public'), `${id}.json`);
    if (!userFilePath || !publicFilePath) {
      return res.status(400).json({ error: 'Invalid profile path' });
    }
    let filePath = null;
    if (fs.existsSync(userFilePath)) filePath = userFilePath;
    else if (fs.existsSync(publicFilePath)) filePath = publicFilePath;
    if (!filePath) return res.status(404).json({ error: 'Profile not found' });
    const profile = readJsonFileSafe(filePath);
    res.json({ profile });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/load-style', (req, res) => {
  try {
    const id = req.query.id;
    if (!isValidProfileId(id)) return res.status(400).json({ error: 'Missing or invalid id parameter' });

    const userStylePath = resolvePathInside(STYLES_DIR, `${id}.json`);
    const publicStylePath = resolvePathInside(path.join(STYLES_DIR, 'public'), `${id}.json`);
    const userProfilePath = resolvePathInside(PROFILES_DIR, `${id}.json`);
    const publicProfilePath = resolvePathInside(path.join(PROFILES_DIR, 'public'), `${id}.json`);
    if (!userStylePath || !publicStylePath || !userProfilePath || !publicProfilePath) {
      return res.status(400).json({ error: 'Invalid style path' });
    }

    let style = null;
    if (fs.existsSync(userStylePath)) style = readJsonFileSafe(userStylePath);
    else if (fs.existsSync(publicStylePath)) style = readJsonFileSafe(publicStylePath);
    else if (fs.existsSync(userProfilePath)) {
      const profile = readJsonFileSafe(userProfilePath);
      if (profile?.reflectionStyle) {
        style = {
          id: profile.id,
          generatedAt: profile.generatedAt,
          locale: profile.locale || 'en',
          llm: profile.llm,
          llmModelLabel: profile.llmModelLabel || profile.modelLabel,
          modelLabel: profile.modelLabel || profile.llmModelLabel,
          reflectionStyle: profile.reflectionStyle,
          reflectionStyleShort: profile.reflectionStyleShort,
          rawReflectionStyle: profile.rawReflectionStyle,
        };
      }
    } else if (fs.existsSync(publicProfilePath)) {
      const profile = readJsonFileSafe(publicProfilePath);
      if (profile?.reflectionStyle) {
        style = {
          id: profile.id,
          generatedAt: profile.generatedAt,
          locale: profile.locale || 'en',
          llm: profile.llm,
          llmModelLabel: profile.llmModelLabel || profile.modelLabel,
          modelLabel: profile.modelLabel || profile.llmModelLabel,
          reflectionStyle: profile.reflectionStyle,
          reflectionStyleShort: profile.reflectionStyleShort,
          rawReflectionStyle: profile.rawReflectionStyle,
        };
      }
    }

    if (!style) return res.status(404).json({ error: 'Style not found' });
    res.json({ style });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/load-state', (req, res) => {
  try {
    const id = req.query.id;
    if (!isValidProfileId(id)) return res.status(400).json({ error: 'Missing or invalid id parameter' });

    const userStatePath = resolvePathInside(STATES_DIR, `${id}.json`);
    const publicStatePath = resolvePathInside(path.join(STATES_DIR, 'public'), `${id}.json`);
    const userProfilePath = resolvePathInside(PROFILES_DIR, `${id}.json`);
    const publicProfilePath = resolvePathInside(path.join(PROFILES_DIR, 'public'), `${id}.json`);
    if (!userStatePath || !publicStatePath || !userProfilePath || !publicProfilePath) {
      return res.status(400).json({ error: 'Invalid state path' });
    }

    let state = null;
    if (fs.existsSync(userStatePath)) state = readJsonFileSafe(userStatePath);
    else if (fs.existsSync(publicStatePath)) state = readJsonFileSafe(publicStatePath);
    else if (fs.existsSync(userProfilePath)) {
      const profile = readJsonFileSafe(userProfilePath);
      if (profile?.initialState) {
        state = {
          id: profile.id,
          generatedAt: profile.generatedAt,
          locale: profile.locale || 'en',
          llm: profile.llm,
          llmModelLabel: profile.llmModelLabel || profile.modelLabel,
          modelLabel: profile.modelLabel || profile.llmModelLabel,
          initialState: profile.initialState,
          initialStateShort: profile.initialStateShort,
          rawInitialState: profile.rawInitialState,
        };
      }
    } else if (fs.existsSync(publicProfilePath)) {
      const profile = readJsonFileSafe(publicProfilePath);
      if (profile?.initialState) {
        state = {
          id: profile.id,
          generatedAt: profile.generatedAt,
          locale: profile.locale || 'en',
          llm: profile.llm,
          llmModelLabel: profile.llmModelLabel || profile.modelLabel,
          modelLabel: profile.modelLabel || profile.llmModelLabel,
          initialState: profile.initialState,
          initialStateShort: profile.initialStateShort,
          rawInitialState: profile.rawInitialState,
        };
      }
    }

    if (!state) return res.status(404).json({ error: 'State not found' });
    res.json({ state });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Static build (SPA) ---
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath, { index: false }));
// Catch-all for SPA: use regex (path-to-regexp v7 rejects bare '*')
app.get(/.*/, (_req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  try {
    let html = fs.readFileSync(indexPath, 'utf-8');
    if (isValidGaMeasurementId(GA_MEASUREMENT_ID) && !html.includes('googletagmanager.com/gtag/js')) {
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${gaTagSnippet(GA_MEASUREMENT_ID)}</head>`);
      } else {
        // Extremely unlikely; fall back to appending.
        html = `${gaTagSnippet(GA_MEASUREMENT_ID)}\n${html}`;
      }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } catch (e) {
    safeSend(res, 404, { error: 'dist/index.html not found. Build the frontend (npm run build) before starting the production server.' });
  }
});

// Ensure any unhandled error (e.g. from express.json()) sends a response
app.use((err, _req, res, _next) => {
  if (!res.headersSent) safeSend(res, 500, { error: String(err?.message || err) });
  console.error('Unhandled error', err);
});

// Keep a strong reference to the server so the process stays alive.
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
server.on('error', (e) => {
  console.error('Server error', e);
  // In dev, make port conflicts loud (otherwise concurrently can be confusing).
  if (e?.code === 'EADDRINUSE') process.exit(1);
});
