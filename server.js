const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// ⚙️ CONFIGURATION
// ============================================================
const CONFIG = {
  TIMEOUT_MS: 15000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 800,
  CACHE_TTL_MS: 5 * 60 * 1000,
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: 30,
  DEFAULT_QUALITY: '1080',
  DEFAULT_AUDIO_FORMAT: 'mp3',
};

// ============================================================
// 🌐 COBALT INSTANCE POOL
// ============================================================
const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt.api.lostpoint.me',
  'https://cobalt.api.timelessnesses.me',
  'https://cobalt.synzr.space',
  'https://co.wuk.sh',
];

// ============================================================
// 💾 IN-MEMORY CACHE
// ============================================================
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CONFIG.CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

// ============================================================
// 🚦 RATE LIMITER
// ============================================================
const rateLimitStore = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, start: now };

  if (now - entry.start > CONFIG.RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, start: now });
    return false;
  }

  if (entry.count >= CONFIG.RATE_LIMIT_MAX_REQUESTS) return true;

  entry.count++;
  rateLimitStore.set(ip, entry);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now - entry.start > CONFIG.RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ============================================================
// 🔍 PLATFORM DETECTOR
// ============================================================
function detectPlatform(url) {
  const platforms = {
    'youtube.com': 'YouTube',
    'youtu.be': 'YouTube',
    'instagram.com': 'Instagram',
    'tiktok.com': 'TikTok',
    'twitter.com': 'Twitter/X',
    'x.com': 'Twitter/X',
    'facebook.com': 'Facebook',
    'fb.watch': 'Facebook',
    'reddit.com': 'Reddit',
    'vimeo.com': 'Vimeo',
    'twitch.tv': 'Twitch',
    'pinterest.com': 'Pinterest',
    'snapchat.com': 'Snapchat',
    'dailymotion.com': 'Dailymotion',
    'soundcloud.com': 'SoundCloud',
  };

  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const [domain, name] of Object.entries(platforms)) {
      if (hostname.includes(domain)) return name;
    }
  } catch (_) {}
  return 'Unknown Platform';
}

// ============================================================
// ⏳ FETCH WITH TIMEOUT
// ============================================================
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// 🔄 RETRY WRAPPER
// ============================================================
async function withRetry(fn, retries = CONFIG.MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY_MS * attempt));
      }
    }
  }
  throw lastError;
}

// ============================================================
// 🎯 SINGLE COBALT INSTANCE REQUEST
// ============================================================
async function tryInstance(instanceUrl, videoUrl, options = {}) {
  const endpoint = `${instanceUrl}/api/json`;

  const body = {
    url: videoUrl,
    videoQuality: options.quality || CONFIG.DEFAULT_QUALITY,
    downloadMode: options.mode || 'auto',
    audioFormat: options.audioFormat || CONFIG.DEFAULT_AUDIO_FORMAT,
    filenamePattern: 'basic',
    isAudioOnly: options.audioOnly === true,
    disableMetadata: false,
  };

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(body),
    },
    CONFIG.TIMEOUT_MS
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.text || `HTTP ${response.status} from ${instanceUrl}`);
  }

  const data = await response.json();
  return { data, instanceUrl };
}

// ============================================================
// 🚀 MASTER ENGINE
// ============================================================
async function fetchViaThirdParty(videoUrl, options = {}) {
  const platform = detectPlatform(videoUrl);
  const cacheKey = `${videoUrl}::${options.quality || CONFIG.DEFAULT_QUALITY}::${options.audioOnly || false}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  let lastError;

  for (const instanceUrl of COBALT_INSTANCES) {
    try {
      const result = await withRetry(() => tryInstance(instanceUrl, videoUrl, options));
      const { data } = result;

      let response;

      if (data.status === 'stream' || data.status === 'redirect') {
        response = {
          success: true,
          platform,
          title: data.text || `${platform} Video`,
          thumbnail: data.thumbnail || '',
          duration: data.duration || 'N/A',
          downloadUrl: data.url,
          quality: options.quality || CONFIG.DEFAULT_QUALITY,
          type: 'direct',
          usedInstance: instanceUrl,
          cached: false,
        };
      } else if (data.status === 'picker') {
        const pickerItems = data.picker.map((item, index) => ({
          index,
          url: item.url,
          quality: item.quality || 'unknown',
          type: item.type || 'video',
        }));

        response = {
          success: true,
          platform,
          title: data.text || `${platform} Video`,
          thumbnail: data.thumbnail || '',
          type: 'picker',
          usedInstance: instanceUrl,
          cached: false,
          downloadUrl: data.picker[0].url,
          allQualities: pickerItems,
        };
      } else if (data.status === 'error') {
        throw new Error(data.text || 'Cobalt returned error status');
      } else {
        throw new Error(`Unknown status: ${data.status}`);
      }

      setCache(cacheKey, response);
      return response;

    } catch (err) {
      lastError = err;
      console.warn(`⚠️  Instance ${instanceUrl} failed: ${err.message}`);
    }
  }

  throw new Error(`Sab instances fail ho gaye. Last error: ${lastError?.message || 'Unknown'}`);
}

// ============================================================
// 🛡️ MIDDLEWARE
// ============================================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. 1 minute baad try karo.',
      retryAfter: 60,
    });
  }
  req.clientIp = ip;
  next();
});

// ============================================================
// 📡 ROUTES
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '🚀 Master Video Downloader API',
    version: '2.0.0',
    instances: COBALT_INSTANCES.length,
    endpoints: {
      download: 'POST /api/download',
      downloadGet: 'GET /api/download?videoUrl=URL',
      health: 'GET /api/health',
      info: 'GET /api/info?videoUrl=URL',
    },
  });
});

app.get('/api/health', async (req, res) => {
  const checks = await Promise.allSettled(
    COBALT_INSTANCES.map(async (url) => {
      const start = Date.now();
      try {
        const resp = await fetchWithTimeout(`${url}/api/serverInfo`, {}, 5000);
        return { url, status: resp.ok ? 'online' : 'degraded', latencyMs: Date.now() - start };
      } catch {
        return { url, status: 'offline', latencyMs: null };
      }
    })
  );

  const instanceStatuses = checks.map(r => r.value || r.reason);
  const onlineCount = instanceStatuses.filter(i => i.status === 'online').length;

  res.json({
    apiStatus: onlineCount > 0 ? 'healthy' : 'degraded',
    onlineInstances: onlineCount,
    totalInstances: COBALT_INSTANCES.length,
    cacheSize: cache.size,
    instances: instanceStatuses,
  });
});

app.post('/api/download', async (req, res) => {
  const {
    videoUrl,
    quality = '1080',
    audioOnly = false,
    audioFormat = 'mp3',
    mode = 'auto',
  } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ success: false, error: 'videoUrl field required hai request body mein.' });
  }

  try {
    new URL(videoUrl);
  } catch {
    return res.status(400).json({ success: false, error: 'Valid URL nahi hai.' });
  }

  try {
    const result = await fetchViaThirdParty(videoUrl, { quality, audioOnly, audioFormat, mode });
    return res.json({ method: 'POST', ...result });
  } catch (error) {
    console.error(`❌ Download failed [${req.clientIp}]:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Video extract nahi ho saka.',
      details: error.message,
      tip: 'URL sahi hai? Ya platform supported nahi ho sakta.',
    });
  }
});

app.get('/api/download', async (req, res) => {
  const {
    videoUrl,
    quality = '1080',
    audioOnly = 'false',
    audioFormat = 'mp3',
  } = req.query;

  if (!videoUrl) {
    return res.status(400).json({ success: false, error: 'videoUrl query param chahiye.' });
  }

  try {
    new URL(videoUrl);
  } catch {
    return res.status(400).json({ success: false, error: 'Valid URL nahi hai.' });
  }

  try {
    const result = await fetchViaThirdParty(videoUrl, {
      quality,
      audioOnly: audioOnly === 'true',
      audioFormat,
    });
    return res.json({ method: 'GET', ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/info', (req, res) => {
  const { videoUrl } = req.query;
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' });

  try {
    const platform = detectPlatform(videoUrl);
    return res.json({ videoUrl, platform, supported: platform !== 'Unknown Platform' });
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} nahi mili.` });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Server error. Dobara try karo.' });
});

// ============================================================
// 🟢 START
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 Master Video Downloader API`);
  console.log(`   Port     : ${PORT}`);
  console.log(`   Instances: ${COBALT_INSTANCES.length} Cobalt nodes`);
  console.log(`   Cache TTL: ${CONFIG.CACHE_TTL_MS / 1000}s`);
  console.log(`   Rate Limit: ${CONFIG.RATE_LIMIT_MAX_REQUESTS} req/min per IP\n`);
});