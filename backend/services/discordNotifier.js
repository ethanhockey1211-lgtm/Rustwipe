'use strict';

const axios = require('axios');

const DISCORD_WEBHOOK_REGEX = /^https:\/\/(discord(?:app)?\.com|ptb\.discord\.com)\/api\/webhooks\/\d+\/.+/;

// ── Utility ───────────────────────────────────────────────────────────────────
function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

function detectGatherRate(name) {
  const m = name.match(/\b([2-9]\d{0,2}|1\d{1,2})\s*[xX]\b/);
  if (m) { const n = parseInt(m[1]); if (n >= 2 && n <= 1000) return n; }
  return 1;
}

// Returns numeric team cap detected from server name, or null if unknown
function detectTeamMax(name) {
  const lower = name.toLowerCase();
  const maxMatch = lower.match(/\bmax\s*(\d+)\b|\b(\d+)\s*[\s-]?man\b|\bgroup\s*(\d+)\b/);
  if (maxMatch) {
    const n = parseInt(maxMatch[1] || maxMatch[2] || maxMatch[3]);
    if (n >= 1 && n <= 50) return n;
  }
  if (/\bquad\b/.test(lower)) return 4;
  if (/\btrio\b/.test(lower)) return 3;
  if (/\bduo\b/.test(lower)  && !/trio|squad|team/.test(lower)) return 2;
  if (/\bsolo\b/.test(lower) && !/duo|trio|squad/.test(lower)) return 1;
  return null;
}

// ── Filter matching ───────────────────────────────────────────────────────────
function matchesFilters(server, filters) {
  const f = filters;

  // Country
  if (f.country && f.country !== 'all') {
    if ((server.country || '').toUpperCase() !== f.country.toUpperCase()) return false;
  }

  // Server type
  if (f.serverType && f.serverType !== 'all') {
    if (server.server_type !== f.serverType) return false;
  }

  // Min players (current population)
  if (f.minPlayers && parseInt(f.minPlayers) > 0) {
    if (server.players < parseInt(f.minPlayers)) return false;
  }

  // Max server capacity (e.g. only get alerts for servers with ≤200 max players)
  if (f.maxCap && f.maxCap !== 'all') {
    if (server.max_players > parseInt(f.maxCap)) return false;
  }

  // Map size
  if (f.mapSize && f.mapSize !== 'all') {
    const ranges = { small: [0, 2000], medium: [2001, 3500], large: [3501, 4500], xl: [4501, 99999] };
    if (ranges[f.mapSize] && server.world_size) {
      const [mn, mx] = ranges[f.mapSize];
      if (server.world_size < mn || server.world_size > mx) return false;
    }
  }

  // Wipe schedule (name/tag based)
  if (f.schedule && f.schedule !== 'all') {
    const combined = (server.name + ' ' + (server.tags || []).join(' ')).toLowerCase();
    switch (f.schedule) {
      case 'daily':    if (!/\bdaily\b|\b24[\s-]?hr/.test(combined))    return false; break;
      case '3day':     if (!/\b3[\s-]?day\b|\b72[\s-]?hr/.test(combined)) return false; break;
      case 'weekly':   if (!/\bweekly\b/.test(combined) || /biweekly|bi-weekly/i.test(combined)) return false; break;
      case 'biweekly': if (!/\bbiweekly\b|\bbi[\s-]weekly\b/.test(combined)) return false; break;
      case 'monthly':  if (!/\bmonthly\b|\bvanilla\b|\bofficial\b/.test(combined)) return false; break;
    }
  }

  // Gather rate
  if (f.gatherRate && f.gatherRate !== 'all') {
    const rate = detectGatherRate(server.name);
    switch (f.gatherRate) {
      case 'vanilla': if (rate !== 1)            return false; break;
      case '2x':      if (rate !== 2)            return false; break;
      case '3x':      if (rate !== 3)            return false; break;
      case '5x':      if (rate < 5 || rate > 9) return false; break;
      case '10x':     if (rate < 10)             return false; break;
      case 'modded':  if (rate <= 1)             return false; break;
    }
  }

  // Team max — the key filter ("max5" means team cap ≤ 5)
  if (f.teamMax && f.teamMax !== 'all') {
    const detected = detectTeamMax(server.name);
    const cap = parseInt(f.teamMax);

    if (isNaN(cap)) return false;

    // If we couldn't detect a team limit from the name, exclude unless filter is 'any'
    if (detected === null) return false;
    if (detected > cap)   return false;
  }

  return true;
}

// ── Discord embed builder ─────────────────────────────────────────────────────
function buildEmbed(server) {
  const ts         = server.rust_last_wipe ? Math.floor(new Date(server.rust_last_wipe).getTime() / 1000) : null;
  const gatherRate = detectGatherRate(server.name);
  const teamMax    = detectTeamMax(server.name);
  const flag       = countryFlag(server.country);

  const fields = [
    { name: '🕐 Wiped',   value: ts ? `<t:${ts}:R>` : 'Just now', inline: true },
    { name: '👥 Players', value: `${server.players}/${server.max_players}`, inline: true },
    { name: '🌍 Region',  value: `${flag} ${server.country || '?'}`, inline: true },
  ];

  if (server.world_size) {
    fields.push({ name: '🗺 Map',    value: server.world_size.toLocaleString(), inline: true });
  }
  if (gatherRate > 1) {
    fields.push({ name: '⚒ Rates',  value: `${gatherRate}x`, inline: true });
  }
  if (teamMax) {
    fields.push({ name: '🛡 Team',  value: `Max ${teamMax}`, inline: true });
  }
  if (server.ip) {
    fields.push({
      name: '🔗 Connect',
      value: `\`connect ${server.ip}:${server.port || 28015}\``,
      inline: false,
    });
  }

  return {
    title:     server.name,
    color:     0xcd3d00,
    fields,
    timestamp: server.rust_last_wipe || new Date().toISOString(),
    footer:    { text: `RustWipe • ${server.server_type || 'community'}` },
    ...(server.header_image ? { thumbnail: { url: server.header_image } } : {}),
  };
}

// ── Send to webhook (batches up to 10 embeds per message) ────────────────────
async function sendToWebhook(webhookUrl, embeds) {
  const BATCH = 10;
  for (let i = 0; i < embeds.length; i += BATCH) {
    await axios.post(webhookUrl, {
      username:   'RustWipe',
      avatar_url: 'https://i.imgur.com/VkNiR4g.png',
      embeds:     embeds.slice(i, i + BATCH),
    }, { timeout: 10000 });

    if (i + BATCH < embeds.length) {
      await new Promise(r => setTimeout(r, 1200)); // Respect Discord rate limits
    }
  }
}

// ── Main notification job (called after every server refresh) ─────────────────
async function processSubscriptions(db) {
  const subs = db.prepare(`SELECT * FROM subscriptions WHERE active = 1`).all();
  if (subs.length === 0) return;

  // 7-minute lookback: catches wipes since last 5-min cron + buffer
  const cutoff = new Date(Date.now() - 7 * 60 * 1000).toISOString();
  const recentWipes = db.prepare(`
    SELECT * FROM servers
    WHERE rust_last_wipe >= ? AND status = 'online' AND ip IS NOT NULL
    ORDER BY rust_last_wipe DESC LIMIT 500
  `).all(cutoff);

  if (recentWipes.length === 0) return;

  const checkNotified  = db.prepare(`SELECT 1 FROM notified_wipes WHERE subscription_id=? AND server_id=? AND wipe_time=?`);
  const recordNotified = db.prepare(`INSERT OR IGNORE INTO notified_wipes (subscription_id,server_id,wipe_time,notified_at) VALUES(?,?,?,?)`);
  const updateLastFired = db.prepare(`UPDATE subscriptions SET last_fired=? WHERE id=?`);

  for (const sub of subs) {
    const filters  = JSON.parse(sub.filters || '{}');
    const matching = [];

    for (const server of recentWipes) {
      server.tags = JSON.parse(server.tags || '[]');
      if (checkNotified.get(sub.id, server.id, server.rust_last_wipe)) continue;
      if (!matchesFilters(server, filters)) continue;
      matching.push(server);
    }

    if (matching.length === 0) continue;

    try {
      await sendToWebhook(sub.webhook_url, matching.map(buildEmbed));
      const now = new Date().toISOString();
      for (const s of matching) recordNotified.run(sub.id, s.id, s.rust_last_wipe, now);
      updateLastFired.run(now, sub.id);
      console.log(`[Discord] Notified "${sub.name}": ${matching.length} wipes`);
    } catch (err) {
      console.error(`[Discord] Failed sub "${sub.name}":`, err.response?.data?.message || err.message);
    }
  }
}

module.exports = { processSubscriptions, matchesFilters, sendToWebhook, buildEmbed, DISCORD_WEBHOOK_REGEX };
