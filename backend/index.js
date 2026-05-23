'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const Database = require('better-sqlite3');

const { fetchAndCacheServers } = require('./services/battlemetrics');
const { predictNextWipe, getNextForceWipe } = require('./services/wipePredictor');

const PORT = process.env.PORT || 3001;
const app  = express();

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'rustwipe.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    players      INTEGER DEFAULT 0,
    max_players  INTEGER DEFAULT 0,
    rank         INTEGER DEFAULT 999999,
    status       TEXT    DEFAULT 'online',
    country      TEXT,
    ip           TEXT,
    port         INTEGER,
    map_name     TEXT,
    world_size   INTEGER,
    server_type  TEXT,
    tags         TEXT    DEFAULT '[]',
    rust_last_wipe TEXT,
    rust_born    TEXT,
    header_image TEXT,
    server_url   TEXT,
    last_seen    TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wipe_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id   TEXT    NOT NULL,
    wipe_time   TEXT    NOT NULL,
    detected_at TEXT    NOT NULL,
    UNIQUE(server_id, wipe_time)
  );

  CREATE INDEX IF NOT EXISTS idx_last_wipe ON servers(rust_last_wipe DESC);
  CREATE INDEX IF NOT EXISTS idx_rank      ON servers(rank);
  CREATE INDEX IF NOT EXISTS idx_country   ON servers(country);
  CREATE INDEX IF NOT EXISTS idx_wh_server ON wipe_history(server_id);
`);

// ── Helpers ───────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

function parseTags(servers) {
  return servers.map(s => ({ ...s, tags: JSON.parse(s.tags || '[]') }));
}

// Inline schedule detection (mirrors wipePredictor logic) for post-query filtering
function matchesSchedule(name, tags, schedule) {
  const combined = (name + ' ' + (Array.isArray(tags) ? tags.join(' ') : '')).toLowerCase();
  switch (schedule) {
    case 'daily':    return /\bdaily\b|\b24[\s-]?hr/.test(combined);
    case '3day':     return /\b3[\s-]?day\b|\b72[\s-]?hr/.test(combined);
    case 'weekly':   return /\bweekly\b/.test(combined) && !/biweekly|bi-weekly/i.test(combined);
    case 'biweekly': return /\bbiweekly\b|\bbi[\s-]weekly\b/.test(combined);
    case 'monthly':  return /\bmonthly\b|\bvanilla\b|\bofficial\b/.test(combined);
    default: return true;
  }
}

// ── GET /api/stats ─────────────────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  const total     = db.prepare(`SELECT COUNT(*) as c FROM servers WHERE status='online'`).get();
  const today     = db.prepare(`SELECT COUNT(*) as c FROM servers WHERE rust_last_wipe >= datetime('now','-24 hours')`).get();
  const thisWeek  = db.prepare(`SELECT COUNT(*) as c FROM servers WHERE rust_last_wipe >= datetime('now','-7 days')`).get();
  const dbUpdated = db.prepare(`SELECT MAX(updated_at) as t FROM servers`).get();

  res.json({
    totalServers:  total.c,
    wipedToday:    today.c,
    wipedThisWeek: thisWeek.c,
    nextForceWipe: getNextForceWipe().toISOString(),
    lastUpdated:   dbUpdated.t || null,
  });
});

// ── GET /api/servers/wiped ────────────────────────────────────────────────
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

  const sortMap = {
    recent:  'rust_last_wipe DESC',
    players: 'players DESC',
    rank:    'rank ASC',
  };
  const orderBy = sortMap[sort] || sortMap.recent;

  const cutoff = new Date(Date.now() - hours * 3600000).toISOString();

  let where = `rust_last_wipe >= @cutoff AND status = 'online' AND players >= @minPlayers`;
  const params = { cutoff, minPlayers };

  if (country && country !== 'all') {
    where += ` AND country = @country`;
    params.country = country.toUpperCase();
  }
  if (serverType && serverType !== 'all') {
    where += ` AND server_type = @serverType`;
    params.serverType = serverType;
  }
  if (mapSize && mapSize !== 'all') {
    const ranges = { small: [0, 2000], medium: [2001, 3500], large: [3501, 4500], xl: [4501, 99999] };
    if (ranges[mapSize]) {
      where += ` AND world_size BETWEEN @wsMin AND @wsMax`;
      [params.wsMin, params.wsMax] = ranges[mapSize];
    }
  }

  // Fetch all matching rows (for in-memory schedule filter), then paginate
  const rows = db.prepare(`SELECT * FROM servers WHERE ${where} ORDER BY ${orderBy}`).all(params);
  let results = parseTags(rows);

  if (schedule && schedule !== 'all') {
    results = results.filter(s => matchesSchedule(s.name, s.tags, schedule));
  }

  const total     = results.length;
  const paginated = results.slice(offset, offset + limit);

  res.json({ servers: paginated, total, lastUpdated: new Date().toISOString() });
});

// ── GET /api/servers/upcoming ────────────────────────────────────────────
app.get('/api/servers/upcoming', (req, res) => {
  const hours      = Math.min(parseInt(req.query.hours)      || 48,  240);
  const minPlayers = Math.max(parseInt(req.query.minPlayers) || 0,     0);
  const limit      = Math.min(parseInt(req.query.limit)      || 50,  200);
  const offset     = Math.max(parseInt(req.query.offset)     || 0,     0);
  const country    = req.query.country    || null;
  const serverType = req.query.serverType || null;
  const schedule   = req.query.schedule   || null;
  const sort       = req.query.sort       || 'soon';

  let where = `s.status = 'online' AND s.rust_last_wipe IS NOT NULL AND s.players >= @minPlayers`;
  const params = { minPlayers };

  if (country && country !== 'all') {
    where += ` AND s.country = @country`;
    params.country = country.toUpperCase();
  }
  if (serverType && serverType !== 'all') {
    where += ` AND s.server_type = @serverType`;
    params.serverType = serverType;
  }

  const rows = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*)   FROM wipe_history wh  WHERE wh.server_id = s.id) AS wipe_count,
      (SELECT MAX(wipe_time) FROM wipe_history wh2
        WHERE wh2.server_id = s.id AND wh2.wipe_time < s.rust_last_wipe)  AS prev_wipe
    FROM servers s WHERE ${where}
    ORDER BY s.players DESC
  `).all(params);

  const servers   = parseTags(rows);
  const forceWipe = getNextForceWipe();
  const now       = new Date();
  const cutoff    = new Date(now.getTime() + hours * 3600000);

  let upcoming = [];
  for (const s of servers) {
    const pred = predictNextWipe(s, forceWipe);
    if (!pred) continue;
    const next = new Date(pred.nextWipe);
    if (next > now && next <= cutoff) {
      upcoming.push({
        ...s,
        nextWipe:      pred.nextWipe,
        wipeSchedule:  pred.schedule,
        intervalDays:  pred.intervalDays,
        confidence:    pred.confidence,
      });
    }
  }

  // Schedule filter on predicted type
  if (schedule && schedule !== 'all') {
    upcoming = upcoming.filter(s => s.wipeSchedule === schedule);
  }

  // Sort
  const confOrder = { high: 0, medium: 1, low: 2 };
  switch (sort) {
    case 'players':    upcoming.sort((a, b) => b.players - a.players); break;
    case 'confidence': upcoming.sort((a, b) =>
      (confOrder[a.confidence] ?? 2) - (confOrder[b.confidence] ?? 2)); break;
    default:           upcoming.sort((a, b) => new Date(a.nextWipe) - new Date(b.nextWipe));
  }

  res.json({
    servers:      upcoming.slice(offset, offset + limit),
    total:        upcoming.length,
    nextForceWipe: forceWipe.toISOString(),
    lastUpdated:  new Date().toISOString(),
  });
});

// ── GET /api/servers/search ───────────────────────────────────────────────
app.get('/api/servers/search', (req, res) => {
  const q     = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  if (!q) return res.json({ servers: [] });

  const rows = db.prepare(`
    SELECT * FROM servers
    WHERE name LIKE @q AND status = 'online'
    ORDER BY players DESC LIMIT @limit
  `).all({ q: `%${q}%`, limit });

  res.json({ servers: parseTags(rows) });
});

// ── Production static frontend ─────────────────────────────────────────────
const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendBuild));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendBuild, 'index.html'), err => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

// ── Startup ────────────────────────────────────────────────────────────────
(async () => {
  console.log('[RustWipe] Starting…');
  try { await fetchAndCacheServers(db); }
  catch (err) { console.error('[RustWipe] Initial fetch failed:', err.message); }

  cron.schedule('*/5 * * * *', async () => {
    try { await fetchAndCacheServers(db); }
    catch (err) { console.error('[RustWipe] Cron refresh failed:', err.message); }
  });

  app.listen(PORT, () => console.log(`[RustWipe] API http://localhost:${PORT}`));
})();
