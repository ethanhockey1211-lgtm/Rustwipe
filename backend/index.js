'use strict';

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const cron     = require('node-cron');
const crypto   = require('crypto');
const Database = require('better-sqlite3');

const { fetchAndCacheServers }   = require('./services/battlemetrics');
const { predictNextWipe, getNextForceWipe } = require('./services/wipePredictor');
const { processSubscriptions, matchesFilters, sendToWebhook, buildEmbed, DISCORD_WEBHOOK_REGEX }
  = require('./services/discordNotifier');

const PORT = process.env.PORT || 3001;
const app  = express();

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'rustwipe.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    players           INTEGER DEFAULT 0,
    max_players       INTEGER DEFAULT 0,
    rank              INTEGER DEFAULT 999999,
    status            TEXT    DEFAULT 'online',
    country           TEXT,
    ip                TEXT,
    port              INTEGER,
    map_name          TEXT,
    world_size        INTEGER,
    map_seed          INTEGER,
    server_type       TEXT,
    tags              TEXT    DEFAULT '[]',
    rust_last_wipe    TEXT,
    rust_born         TEXT,
    header_image      TEXT,
    server_url        TEXT,
    map_url           TEXT,
    map_thumbnail_url TEXT,
    last_seen         TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wipe_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id   TEXT NOT NULL,
    wipe_time   TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    UNIQUE(server_id, wipe_time)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    filters     TEXT NOT NULL DEFAULT '{}',
    active      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL,
    last_fired  TEXT
  );

  CREATE TABLE IF NOT EXISTS notified_wipes (
    subscription_id TEXT NOT NULL,
    server_id       TEXT NOT NULL,
    wipe_time       TEXT NOT NULL,
    notified_at     TEXT NOT NULL,
    PRIMARY KEY (subscription_id, server_id, wipe_time)
  );

  CREATE INDEX IF NOT EXISTS idx_last_wipe ON servers(rust_last_wipe DESC);
  CREATE INDEX IF NOT EXISTS idx_rank      ON servers(rank);
  CREATE INDEX IF NOT EXISTS idx_country   ON servers(country);
  CREATE INDEX IF NOT EXISTS idx_wh_server ON wipe_history(server_id);
  CREATE INDEX IF NOT EXISTS idx_nw_sub    ON notified_wipes(subscription_id);
`);

// Safely add new columns to existing databases
const addCol = (col, type) => {
  try { db.prepare(`ALTER TABLE servers ADD COLUMN ${col} ${type}`).run(); } catch {}
};
addCol('map_seed',          'INTEGER');
addCol('map_url',           'TEXT');
addCol('map_thumbnail_url', 'TEXT');

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Simple in-memory rate limiter (max 60 req/min per IP)
const rateLimitMap = new Map();
app.use((req, res, next) => {
  const ip  = req.ip || 'unknown';
  const now = Date.now();
  const win = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - win.start > 60000) { win.count = 0; win.start = now; }
  win.count++;
  rateLimitMap.set(ip, win);
  if (win.count > 120) return res.status(429).json({ error: 'Too many requests' });
  next();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseTags(servers) {
  return servers.map(s => ({ ...s, tags: JSON.parse(s.tags || '[]') }));
}

function scheduleMatches(name, tags, schedule) {
  const c = (name + ' ' + (Array.isArray(tags) ? tags.join(' ') : '')).toLowerCase();
  switch (schedule) {
    case 'daily':    return /\bdaily\b|\b24[\s-]?hr/.test(c);
    case '3day':     return /\b3[\s-]?day\b|\b72[\s-]?hr/.test(c);
    case 'weekly':   return /\bweekly\b/.test(c) && !/biweekly|bi-weekly/i.test(c);
    case 'biweekly': return /\bbiweekly\b|\bbi[\s-]weekly\b/.test(c);
    case 'monthly':  return /\bmonthly\b|\bvanilla\b|\bofficial\b/.test(c);
    default: return true;
  }
}

function withPrediction(server) {
  const wipeCount = db.prepare(`SELECT COUNT(*) as c FROM wipe_history WHERE server_id=?`).get(server.id)?.c || 0;
  const prevWipe  = db.prepare(`SELECT MAX(wipe_time) as t FROM wipe_history WHERE server_id=? AND wipe_time < ?`)
    .get(server.id, server.rust_last_wipe || '')?.t || null;
  const forceWipe = getNextForceWipe();
  const pred = predictNextWipe({ ...server, wipe_count: wipeCount, prev_wipe: prevWipe }, forceWipe);
  return { ...server, wipe_count: wipeCount, prediction: pred };
}

// ── GET /api/stats ─────────────────────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  const total         = db.prepare(`SELECT COUNT(*) as c FROM servers WHERE status='online'`).get();
  const today         = db.prepare(`SELECT COUNT(*) as c FROM servers WHERE rust_last_wipe >= datetime('now','-24 hours')`).get();
  const thisWeek      = db.prepare(`SELECT COUNT(*) as c FROM servers WHERE rust_last_wipe >= datetime('now','-7 days')`).get();
  const totalWipes    = db.prepare(`SELECT COUNT(*) as c FROM wipe_history`).get();
  const withHistory   = db.prepare(`SELECT COUNT(DISTINCT server_id) as c FROM wipe_history GROUP BY server_id HAVING COUNT(*)>=2`).all().length;
  const dbUpdated     = db.prepare(`SELECT MAX(updated_at) as t FROM servers`).get();
  res.json({
    totalServers:     total.c,
    wipedToday:       today.c,
    wipedThisWeek:    thisWeek.c,
    totalWipesTracked: totalWipes.c,
    serversWithHistory: withHistory,
    nextForceWipe:    getNextForceWipe().toISOString(),
    lastUpdated:      dbUpdated.t || null,
  });
});

// ── GET /api/servers/recent (live feed) ────────────────────────────────────────
app.get('/api/servers/recent', (req, res) => {
  const limit   = Math.min(parseInt(req.query.limit)  || 50, 200);
  const hours   = Math.min(parseInt(req.query.hours)  || 12, 168);
  const country = req.query.country || null;

  const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
  let where = `rust_last_wipe >= @cutoff AND status='online' AND ip IS NOT NULL`;
  const p   = { cutoff };

  if (country && country !== 'all') { where += ` AND country=@country`; p.country = country.toUpperCase(); }

  const rows = parseTags(db.prepare(
    `SELECT * FROM servers WHERE ${where} ORDER BY rust_last_wipe DESC LIMIT @limit`
  ).all({ ...p, limit }));

  const freshCutoff = Date.now() - 20 * 60 * 1000; // last 20 min
  rows.forEach(s => {
    s.isFresh = !!s.rust_last_wipe && new Date(s.rust_last_wipe).getTime() >= freshCutoff;
  });

  res.json({ servers: rows, lastUpdated: new Date().toISOString() });
});

// ── GET /api/servers/wiped ─────────────────────────────────────────────────────
app.get('/api/servers/wiped', (req, res) => {
  const hours      = Math.min(parseInt(req.query.hours)      || 24,  168);
  const minPlayers = Math.max(parseInt(req.query.minPlayers) || 0,     0);
  const limit      = Math.min(parseInt(req.query.limit)      || 50,  200);
  const offset     = Math.max(parseInt(req.query.offset)     || 0,     0);
  const country    = req.query.country    || null;
  const serverType = req.query.serverType || null;
  const mapSize    = req.query.mapSize    || null;
  const schedule   = req.query.schedule   || null;
  const sort       = req.query.sort       || 'recent';

  const sortMap = { recent: 'rust_last_wipe DESC', players: 'players DESC', rank: 'rank ASC' };
  const orderBy = sortMap[sort] || sortMap.recent;
  const cutoff  = new Date(Date.now() - hours * 3600000).toISOString();

  let where = `rust_last_wipe >= @cutoff AND status='online' AND players >= @minPlayers`;
  const p   = { cutoff, minPlayers };
  if (country    && country    !== 'all') { where += ` AND country=@country`;      p.country    = country.toUpperCase(); }
  if (serverType && serverType !== 'all') { where += ` AND server_type=@serverType`; p.serverType = serverType; }
  if (mapSize    && mapSize    !== 'all') {
    const ranges = { small:[0,2000], medium:[2001,3500], large:[3501,4500], xl:[4501,99999] };
    if (ranges[mapSize]) { where += ` AND world_size BETWEEN @wsMin AND @wsMax`; [p.wsMin,p.wsMax] = ranges[mapSize]; }
  }

  let results = parseTags(db.prepare(`SELECT * FROM servers WHERE ${where} ORDER BY ${orderBy}`).all(p));
  if (schedule && schedule !== 'all') results = results.filter(s => scheduleMatches(s.name, s.tags, schedule));
  res.json({ servers: results.slice(offset, offset+limit), total: results.length, lastUpdated: new Date().toISOString() });
});

// ── GET /api/servers/upcoming ──────────────────────────────────────────────────
app.get('/api/servers/upcoming', (req, res) => {
  const hours      = Math.min(parseInt(req.query.hours)      || 48,  240);
  const minPlayers = Math.max(parseInt(req.query.minPlayers) || 0,     0);
  const limit      = Math.min(parseInt(req.query.limit)      || 50,  200);
  const offset     = Math.max(parseInt(req.query.offset)     || 0,     0);
  const country    = req.query.country    || null;
  const serverType = req.query.serverType || null;
  const schedule   = req.query.schedule   || null;
  const sort       = req.query.sort       || 'soon';

  let where = `s.status='online' AND s.rust_last_wipe IS NOT NULL AND s.players >= @minPlayers`;
  const p   = { minPlayers };
  if (country    && country    !== 'all') { where += ` AND s.country=@country`;      p.country    = country.toUpperCase(); }
  if (serverType && serverType !== 'all') { where += ` AND s.server_type=@serverType`; p.serverType = serverType; }

  const rows = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM wipe_history wh WHERE wh.server_id=s.id) AS wipe_count,
      (SELECT MAX(wipe_time) FROM wipe_history wh2 WHERE wh2.server_id=s.id AND wh2.wipe_time < s.rust_last_wipe) AS prev_wipe
    FROM servers s WHERE ${where} ORDER BY s.players DESC
  `).all(p);

  const forceWipe = getNextForceWipe();
  const now       = new Date();
  const cutoff    = new Date(now.getTime() + hours * 3600000);

  let upcoming = [];
  for (const s of parseTags(rows)) {
    const pred = predictNextWipe(s, forceWipe);
    if (!pred) continue;
    const next = new Date(pred.nextWipe);
    if (next > now && next <= cutoff) {
      upcoming.push({ ...s, nextWipe: pred.nextWipe, wipeSchedule: pred.schedule, intervalDays: pred.intervalDays, confidence: pred.confidence });
    }
  }

  if (schedule && schedule !== 'all') upcoming = upcoming.filter(s => s.wipeSchedule === schedule);

  const confOrder = { high:0, medium:1, low:2 };
  switch (sort) {
    case 'players':    upcoming.sort((a,b) => b.players - a.players); break;
    case 'confidence': upcoming.sort((a,b) => (confOrder[a.confidence]??2)-(confOrder[b.confidence]??2)); break;
    default:           upcoming.sort((a,b) => new Date(a.nextWipe)-new Date(b.nextWipe));
  }
  res.json({ servers: upcoming.slice(offset,offset+limit), total: upcoming.length, nextForceWipe: forceWipe.toISOString(), lastUpdated: new Date().toISOString() });
});

// ── GET /api/servers/batch?ids=a,b,c ──────────────────────────────────────────
app.get('/api/servers/batch', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 50);
  if (ids.length === 0) return res.json({ servers: [] });
  const ph  = ids.map(() => '?').join(',');
  const rows = parseTags(db.prepare(`SELECT * FROM servers WHERE id IN (${ph}) ORDER BY players DESC`).all(...ids));
  res.json({ servers: rows });
});

// ── GET /api/servers/search ────────────────────────────────────────────────────
app.get('/api/servers/search', (req, res) => {
  const q     = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  if (!q) return res.json({ servers: [] });
  const rows = parseTags(db.prepare(`SELECT * FROM servers WHERE name LIKE @q AND status='online' ORDER BY players DESC LIMIT @limit`).all({ q:`%${q}%`, limit }));
  res.json({ servers: rows });
});

// ── GET /api/servers/:id ───────────────────────────────────────────────────────
app.get('/api/servers/:id', (req, res) => {
  const server = db.prepare(`SELECT * FROM servers WHERE id=?`).get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  server.tags = JSON.parse(server.tags || '[]');

  const historyRows = db.prepare(
    `SELECT wipe_time, detected_at FROM wipe_history WHERE server_id=? ORDER BY wipe_time DESC LIMIT 30`
  ).all(req.params.id);

  const wipeHistory = historyRows.map((w, i) => {
    const prev = historyRows[i + 1];
    const intervalDays = prev ? (new Date(w.wipe_time) - new Date(prev.wipe_time)) / 86400000 : null;
    return { ...w, intervalDays };
  });

  const wipeCount = wipeHistory.length;
  const prevWipe  = wipeHistory.length > 1 ? wipeHistory[1].wipe_time : null;
  const forceWipe = getNextForceWipe();
  const prediction = predictNextWipe({ ...server, wipe_count: wipeCount, prev_wipe: prevWipe }, forceWipe);

  const avgInterval = wipeCount >= 2
    ? wipeHistory.slice(0, -1).reduce((s, w) => s + (w.intervalDays || 0), 0) / (wipeCount - 1)
    : null;

  const similar = parseTags(db.prepare(
    `SELECT * FROM servers WHERE country=? AND server_type=? AND id!=? AND status='online' ORDER BY players DESC LIMIT 6`
  ).all(server.country, server.server_type, server.id));

  res.json({ server, wipeHistory, prediction, avgInterval, nextForceWipe: forceWipe.toISOString(), similar });
});

// ── Subscriptions ──────────────────────────────────────────────────────────────
app.get('/api/subscriptions', (_req, res) => {
  const subs = db.prepare(`SELECT * FROM subscriptions ORDER BY created_at DESC`).all();
  res.json({ subscriptions: subs.map(s => ({ ...s, filters: JSON.parse(s.filters || '{}') })) });
});

app.post('/api/subscriptions', (req, res) => {
  const { name, webhook_url, filters = {} } = req.body;
  if (!name?.trim())  return res.status(400).json({ error: 'Name is required' });
  if (!webhook_url)   return res.status(400).json({ error: 'Webhook URL is required' });
  if (!DISCORD_WEBHOOK_REGEX.test(webhook_url)) return res.status(400).json({ error: 'Invalid Discord webhook URL' });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO subscriptions (id,name,webhook_url,filters,active,created_at) VALUES (?,?,?,?,1,?)`)
    .run(id, name.trim(), webhook_url.trim(), JSON.stringify(filters), new Date().toISOString());
  res.status(201).json({ id, message: 'Created' });
});

app.patch('/api/subscriptions/:id', (req, res) => {
  const sub = db.prepare(`SELECT id FROM subscriptions WHERE id=?`).get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  const { name, webhook_url, filters, active } = req.body;
  if (webhook_url && !DISCORD_WEBHOOK_REGEX.test(webhook_url)) return res.status(400).json({ error: 'Invalid Discord webhook URL' });
  db.prepare(`UPDATE subscriptions SET name=COALESCE(?,name), webhook_url=COALESCE(?,webhook_url), filters=COALESCE(?,filters), active=COALESCE(?,active) WHERE id=?`)
    .run(name?.trim()||null, webhook_url?.trim()||null, filters?JSON.stringify(filters):null, active!=null?(active?1:0):null, req.params.id);
  res.json({ message: 'Updated' });
});

app.delete('/api/subscriptions/:id', (req, res) => {
  if (!db.prepare(`SELECT id FROM subscriptions WHERE id=?`).get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM subscriptions WHERE id=?`).run(req.params.id);
  db.prepare(`DELETE FROM notified_wipes WHERE subscription_id=?`).run(req.params.id);
  res.json({ message: 'Deleted' });
});

app.post('/api/subscriptions/:id/test', async (req, res) => {
  const sub = db.prepare(`SELECT * FROM subscriptions WHERE id=?`).get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  const filters   = JSON.parse(sub.filters || '{}');
  const candidates = parseTags(db.prepare(`SELECT * FROM servers WHERE status='online' AND ip IS NOT NULL ORDER BY players DESC LIMIT 200`).all());
  const example   = candidates.find(s => matchesFilters(s, filters)) || candidates[0];
  if (!example)   return res.status(404).json({ error: 'No matching servers to preview with' });
  try {
    await sendToWebhook(sub.webhook_url, [{ ...buildEmbed(example), title:`[TEST] ${example.name}`, description:'_Test notification from RustWipe._', color:0x5865F2 }]);
    res.json({ message: 'Test sent!' });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ── Production static ─────────────────────────────────────────────────────────
const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendBuild));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendBuild, 'index.html'), err => { if (err) res.status(404).end(); });
});

// ── Startup ────────────────────────────────────────────────────────────────────
async function refresh() {
  await fetchAndCacheServers(db);
  await processSubscriptions(db);
}

(async () => {
  console.log('[RustWipe] Starting…');
  try { await refresh(); } catch (err) { console.error('[RustWipe] Initial fetch failed:', err.message); }
  cron.schedule('*/5 * * * *', async () => {
    try { await refresh(); } catch (err) { console.error('[RustWipe] Cron failed:', err.message); }
  });
  app.listen(PORT, () => console.log(`[RustWipe] API http://localhost:${PORT}`));
})();
