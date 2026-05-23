'use strict';

const axios = require('axios');

const BM_BASE    = 'https://api.battlemetrics.com';
const PAGE_SIZE  = 100;
const PAGES_TO_FETCH = 15;
const DELAY_MS   = 600;

async function fetchPage(page) {
  const response = await axios.get(`${BM_BASE}/servers`, {
    params: {
      'filter[game]':   'rust',
      'filter[status]': 'online',
      'sort':           '-players',
      'page[size]':     PAGE_SIZE,
      'page[offset]':   (page - 1) * PAGE_SIZE,
    },
    timeout: 20000,
    headers: { Accept: 'application/json', 'User-Agent': 'RustWipeTracker/1.0' },
  });
  return response.data;
}

function parseServer(raw) {
  const attr    = raw.attributes || {};
  const details = attr.details   || {};
  const tags    = Array.isArray(details.tags) ? details.tags : [];
  const maps    = details.rust_maps || {};

  let serverType = details.rust_type || 'community';
  if (!['community', 'modded', 'official', 'vanilla'].includes(serverType)) serverType = 'community';

  return {
    id:                raw.id,
    name:              (attr.name || '').substring(0, 200),
    players:           attr.players    || 0,
    max_players:       attr.maxPlayers || 0,
    rank:              attr.rank       || 999999,
    status:            attr.status     || 'online',
    country:           attr.country    || null,
    ip:                attr.ip         || null,
    port:              attr.port       || 28015,
    map_name:          details.map     || 'Procedural Map',
    world_size:        details.rust_world_size || null,
    map_seed:          details.rust_world_seed || null,
    server_type:       serverType,
    tags:              JSON.stringify(tags),
    rust_last_wipe:    details.rust_last_wipe || null,
    rust_born:         details.rust_born      || null,
    header_image:      details.rust_headerimage || null,
    server_url:        details.rust_url         || null,
    map_url:           maps.url          || null,
    map_thumbnail_url: maps.thumbnailUrl || null,
    last_seen:         new Date().toISOString(),
    updated_at:        new Date().toISOString(),
  };
}

async function fetchAndCacheServers(db) {
  const upsert = db.prepare(`
    INSERT INTO servers (
      id, name, players, max_players, rank, status, country, ip, port,
      map_name, world_size, map_seed, server_type, tags, rust_last_wipe, rust_born,
      header_image, server_url, map_url, map_thumbnail_url, last_seen, updated_at
    ) VALUES (
      @id, @name, @players, @max_players, @rank, @status, @country, @ip, @port,
      @map_name, @world_size, @map_seed, @server_type, @tags, @rust_last_wipe, @rust_born,
      @header_image, @server_url, @map_url, @map_thumbnail_url, @last_seen, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      name              = excluded.name,
      players           = excluded.players,
      max_players       = excluded.max_players,
      rank              = excluded.rank,
      status            = excluded.status,
      country           = excluded.country,
      map_name          = excluded.map_name,
      world_size        = excluded.world_size,
      map_seed          = excluded.map_seed,
      server_type       = excluded.server_type,
      tags              = excluded.tags,
      rust_last_wipe    = excluded.rust_last_wipe,
      rust_born         = excluded.rust_born,
      header_image      = excluded.header_image,
      server_url        = excluded.server_url,
      map_url           = COALESCE(excluded.map_url, map_url),
      map_thumbnail_url = COALESCE(excluded.map_thumbnail_url, map_thumbnail_url),
      last_seen         = excluded.last_seen,
      updated_at        = excluded.updated_at
  `);

  const getExisting    = db.prepare(`SELECT rust_last_wipe FROM servers WHERE id = ?`);
  const recordWipe     = db.prepare(`INSERT OR IGNORE INTO wipe_history (server_id,wipe_time,detected_at) VALUES (?,?,?)`);

  const upsertBatch = db.transaction((servers) => {
    const now = new Date().toISOString();
    for (const s of servers) {
      const existing = getExisting.get(s.id);
      if (s.rust_last_wipe) {
        if (!existing) {
          recordWipe.run(s.id, s.rust_last_wipe, now);
        } else if (existing.rust_last_wipe !== s.rust_last_wipe) {
          recordWipe.run(s.id, s.rust_last_wipe, now);
        }
      }
      upsert.run(s);
    }
  });

  let totalFetched = 0;
  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    try {
      const data = await fetchPage(page);
      if (!data.data || data.data.length === 0) break;
      const servers = data.data.map(parseServer);
      upsertBatch(servers);
      totalFetched += servers.length;
      if (data.data.length < PAGE_SIZE) break;
      if (page < PAGES_TO_FETCH) await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (err) {
      console.error(`[BattleMetrics] Page ${page} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000));
      break;
    }
  }

  console.log(`[BattleMetrics] Cached ${totalFetched} servers`);
  return totalFetched;
}

module.exports = { fetchAndCacheServers };
