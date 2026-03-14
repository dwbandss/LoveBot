/**
 * server/index.js — LoveBot Express Backend
 *
 * All admin logic, messages, voice clips, and password live HERE.
 * The browser only ever sees JSON responses — no source code, no data keys.
 *
 * Routes:
 *   POST /api/admin/login          — returns JWT token
 *   GET  /api/message              — returns one random message for current mood
 *   GET  /api/admin/messages       — list admin messages        [auth required]
 *   POST /api/admin/messages       — add admin message          [auth required]
 *   DELETE /api/admin/messages/:id — delete admin message       [auth required]
 *   GET  /api/admin/clips          — list voice clips           [auth required]
 *   POST /api/admin/clips          — upload voice clip          [auth required]
 *   DELETE /api/admin/clips/:id    — delete voice clip          [auth required]
 *   GET  /api/admin/moments        — list thinking-of-you lines [auth required]
 *   POST /api/admin/moments        — add moment                 [auth required]
 *   DELETE /api/admin/moments/:id  — delete moment              [auth required]
 *   PUT  /api/admin/password       — change password            [auth required]
 *   GET  /api/admin/clip/:id/audio — stream audio file          [auth required]
 */

import express     from 'express';
import bcrypt      from 'bcrypt';
import jwt         from 'jsonwebtoken';
import multer      from 'multer';
import cors        from 'cors';
import rateLimit   from 'express-rate-limit';
import fs          from 'fs';
import path        from 'path';
import crypto      from 'crypto';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();

/* ── Config ──────────────────────────────────── */
const PORT         = process.env.PORT || 3000;
const JWT_SECRET   = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const UPLOADS_DIR  = path.resolve(__dirname, process.env.UPLOADS_DIR || './uploads');
const DATA_FILE    = path.resolve(__dirname, './data.json');
const SALT_ROUNDS  = 12;

/* ── Ensure dirs exist ───────────────────────── */
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ── Data store (JSON file — no database needed) */
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return _defaultData();
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch { return _defaultData(); }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function _defaultData() {
  return {
    passwordHash: null,   // set on first login attempt
    messages:  [],        // { id, text, category, createdAt }
    clips:     [],        // { id, filename, originalName, size, createdAt }
    moments:   [],        // { id, text, createdAt }
  };
}

/* ── Init password hash on first run ─────────── */
async function ensurePassword() {
  const data = readData();
  if (!data.passwordHash) {
    const plain = process.env.ADMIN_PASSWORD || 'loveyou';
    data.passwordHash = await bcrypt.hash(plain, SALT_ROUNDS);
    writeData(data);
    console.log('Admin password initialized.');
  }
}
ensurePassword();

/* ── Middleware ──────────────────────────────── */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Serve frontend static files
app.use(express.static(path.resolve(__dirname, '..')));

/* ── Rate limiters ───────────────────────────── */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                      // 5 attempts per window
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests.' },
});

app.use('/api/', apiLimiter);

/* ── JWT auth middleware ─────────────────────── */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/* ── Multer (audio uploads) ──────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const id  = crypto.randomBytes(12).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are allowed'));
  },
});

/* ══════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════ */

/** POST /api/admin/login */
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const data = readData();
  const ok   = await bcrypt.compare(password, data.passwordHash || '');
  if (!ok)   return res.status(401).json({ error: 'Incorrect password' });

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token });
});

/**
 * GET /api/message?mood=happy
 * Returns one random message — public route.
 * Mixes built-in messages with admin custom ones.
 */
app.get('/api/message', (req, res) => {
  const mood = req.query.mood || 'happy';
  const data = readData();

  // Built-in message bank (same content as the old messages.js but server-side now)
  const BUILT_IN = {
    happy: [
      { t: "You crossed my mind today and it made me smile.",            c: "connection"  },
      { t: "The way you move through the world is quietly extraordinary.", c: "affirmation" },
      { t: "You are allowed to take up space. All the space you need.",   c: "affirmation" },
      { t: "Something about you makes the ordinary feel more alive.",     c: "wonder"      },
      { t: "You deserve the same kindness you give to everyone else.",    c: "affirmation" },
      { t: "I hope you know how rare you actually are.",                  c: "compliment"  },
      { t: "The world is measurably better because you're in it.",        c: "affirmation" },
      { t: "Your presence is a gift, even on the days you forget that.",  c: "compliment"  },
      { t: "There is a quiet strength in you that I deeply admire.",      c: "compliment"  },
      { t: "You are made of the same atoms as distant stars.",            c: "wonder"      },
      { t: "Someone out there is thinking of you right now.",             c: "connection"  },
      { t: "You matter to more people than you'll ever know.",            c: "connection"  },
    ],
    sad: [
      { t: "Take a deep breath. You're doing better than you think.",     c: "breathe"    },
      { t: "It's okay to not be okay. You don't have to perform happiness today.", c: "validation" },
      { t: "You are allowed to rest. You are allowed to feel this.",      c: "validation" },
      { t: "Hard days are part of the story, not the end of it.",         c: "hope"       },
      { t: "You have survived every difficult day so far. That's 100%.",  c: "comfort"    },
      { t: "Whatever you're carrying — you don't have to carry it perfectly.", c: "comfort" },
      { t: "Your feelings are valid. Every single one of them.",          c: "validation" },
      { t: "This feeling is not permanent. You are not stuck here.",      c: "hope"       },
    ],
    stressed: [
      { t: "Breathe. Just the next minute. You don't need to handle more than that.", c: "breathe" },
      { t: "You are allowed to say no. You are allowed to slow down.",    c: "validation" },
      { t: "The chaos outside doesn't have to live inside you.",          c: "breathe"    },
      { t: "You're not behind. You're on your own timeline.",             c: "comfort"    },
      { t: "You are doing your best. That is always enough.",             c: "comfort"    },
    ],
    neutral: [
      { t: "I'm here, quietly beside you.",                               c: "connection" },
      { t: "No need to feel anything in particular. Just be.",            c: "validation" },
      { t: "Even ordinary days are worth something.",                     c: "wonder"     },
    ],
    night: [
      { t: "You did enough today. Rest well, gentle soul.",               c: "night" },
      { t: "The stars are out. So is your permission to stop and breathe.", c: "night" },
      { t: "Close your eyes. You've carried enough for one day.",         c: "night" },
      { t: "Tomorrow is a fresh page. But right now — rest.",             c: "night" },
    ],
  };

  const pool = [...(BUILT_IN[mood] || BUILT_IN.happy)];

  // Mix in admin custom messages (weighted slightly higher)
  data.messages.forEach(m => {
    pool.push({ t: m.text, c: m.category });
    pool.push({ t: m.text, c: m.category }); // push twice = 2x weight
  });

  const pick = pool[Math.floor(Math.random() * pool.length)];
  res.json(pick);
});

/**
 * GET /api/moment
 * Returns a random "thinking of you" moment — public.
 * Returns null if none configured.
 */
app.get('/api/moment', (req, res) => {
  const data    = readData();
  const moments = data.moments;
  if (!moments.length) return res.json(null);
  const pick = moments[Math.floor(Math.random() * moments.length)];
  res.json({ t: pick.text, c: 'thinking of you ✦' });
});

/**
 * GET /api/clip/random
 * Returns metadata of a random voice clip (NOT the audio data).
 * Frontend uses the id to request the audio stream separately.
 */
app.get('/api/clip/random', (req, res) => {
  const data  = readData();
  const clips = data.clips;
  if (!clips.length) return res.json(null);
  const pick = clips[Math.floor(Math.random() * clips.length)];
  res.json({ id: pick.id, name: pick.originalName });
});

/**
 * GET /api/clip/:id/audio
 * Streams the audio file. Requires valid clip id.
 */
app.get('/api/clip/:id/audio', (req, res) => {
  const data = readData();
  const clip = data.clips.find(c => c.id === req.params.id);
  if (!clip) return res.status(404).json({ error: 'Clip not found' });

  const filePath = path.join(UPLOADS_DIR, clip.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  res.setHeader('Content-Type', clip.mimeType || 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(filePath).pipe(res);
});

/* ══════════════════════════════════════════════
   ADMIN ROUTES (JWT required)
══════════════════════════════════════════════ */

/* Messages */
app.get('/api/admin/messages', requireAuth, (req, res) => {
  res.json(readData().messages);
});

app.post('/api/admin/messages', requireAuth, (req, res) => {
  const { text, category } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });
  const data = readData();
  const msg  = { id: crypto.randomUUID(), text: text.trim(), category: category || 'from you 💌', createdAt: new Date().toISOString() };
  data.messages.push(msg);
  writeData(data);
  res.json(msg);
});

app.delete('/api/admin/messages/:id', requireAuth, (req, res) => {
  const data = readData();
  data.messages = data.messages.filter(m => m.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

/* Voice clips */
app.get('/api/admin/clips', requireAuth, (req, res) => {
  res.json(readData().clips.map(c => ({ id: c.id, originalName: c.originalName, size: c.size, createdAt: c.createdAt })));
});

app.post('/api/admin/clips', requireAuth, upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const data = readData();
  const clip = {
    id:           crypto.randomUUID(),
    filename:     req.file.filename,
    originalName: req.file.originalname.replace(/\.[^.]+$/, ''),
    mimeType:     req.file.mimetype,
    size:         req.file.size,
    createdAt:    new Date().toISOString(),
  };
  data.clips.push(clip);
  writeData(data);
  res.json({ id: clip.id, originalName: clip.originalName, size: clip.size });
});

app.delete('/api/admin/clips/:id', requireAuth, (req, res) => {
  const data = readData();
  const clip = data.clips.find(c => c.id === req.params.id);
  if (clip) {
    const fp = path.join(UPLOADS_DIR, clip.filename);
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
  }
  data.clips = data.clips.filter(c => c.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

/* Moments */
app.get('/api/admin/moments', requireAuth, (req, res) => {
  res.json(readData().moments);
});

app.post('/api/admin/moments', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });
  const data   = readData();
  const moment = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString() };
  data.moments.push(moment);
  writeData(data);
  res.json(moment);
});

app.delete('/api/admin/moments/:id', requireAuth, (req, res) => {
  const data = readData();
  data.moments = data.moments.filter(m => m.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

/* Password change */
app.put('/api/admin/password', requireAuth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Password too short' });
  const data         = readData();
  data.passwordHash  = await bcrypt.hash(newPassword, SALT_ROUNDS);
  writeData(data);
  res.json({ ok: true });
});

/* ── SPA fallback ────────────────────────────── */
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..'));
});

app.listen(PORT, () => {
  console.log(`LoveBot server running on port ${PORT}`);
});
