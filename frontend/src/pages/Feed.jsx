import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { formatDistanceToNow, format } from 'date-fns';

const POLL_MS = 30000;

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

function detectGatherRate(name) {
  const m = name.match(/\b([2-9]\d{0,2}|1\d{1,2})\s*[xX]\b/);
  if (m) { const n = parseInt(m[1]); if (n >= 2 && n <= 1000) return n; }
  return 1;
}

function detectTeamMax(name) {
  const lower = name.toLowerCase();
  const m = lower.match(/\bmax\s*(\d+)\b|\b(\d+)\s*[\s-]?man\b/);
  if (m) { const n = parseInt(m[1] || m[2]); if (n >= 1 && n <= 50) return n; }
  if (/\btrio\b/.test(lower)) return 3;
  if (/\bduo\b/.test(lower)  && !/trio/.test(lower)) return 2;
  if (/\bsolo\b/.test(lower) && !/duo|trio/.test(lower)) return 1;
  return null;
}

function isHot(server) {
  const hoursSince = server.rust_last_wipe
    ? (Date.now() - new Date(server.rust_last_wipe).getTime()) / 3600000
    : Infinity;
  const pct = server.max_players > 0 ? server.players / server.max_players : 0;
  return hoursSince < 4 && (pct >= 0.25 || server.players >= 30);
}

function copyToClipboard(text) {
  try { navigator.clipboard.writeText(text); } catch {
    const el = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
  }
}

// ── Feed item ─────────────────────────────────────────────────────────────────
function FeedItem({ server, isNew }) {
  const [copied, setCopied] = useState(false);
  const gr  = detectGatherRate(server.name);
  const tm  = detectTeamMax(server.name);
  const hot = isHot(server);
  const pct = server.max_players > 0 ? Math.min((server.players / server.max_players) * 100, 100) : 0;
  const barColor = pct >= 80 ? 'bg-red-500' : pct >= 40 ? 'bg-amber-500' : 'bg-green-500';

  function handleCopy(e) {
    e.preventDefault();
    copyToClipboard(`${server.ip}:${server.port || 28015}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`border-b border-dark-600/70 last:border-0 px-4 py-3 hover:bg-dark-600/30 transition-colors group ${isNew ? 'flash-new' : ''}`}>
      <div className="flex items-start gap-3">

        {/* Left: flag + wipe time */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 w-12 text-center pt-0.5">
          <span className="text-xl leading-none">{countryFlag(server.country)}</span>
          {server.rust_last_wipe && (
            <>
              <span className="text-[10px] text-dark-400 tabular-nums leading-tight mt-0.5">
                {formatDistanceToNow(new Date(server.rust_last_wipe), { addSuffix: false })
                  .replace('about ', '').replace(' minutes', 'm').replace(' minute', 'm')
                  .replace(' hours', 'h').replace(' hour', 'h').replace(' days', 'd')
                  .replace(' day', 'd')}
              </span>
              <span className="text-[9px] text-dark-500 tabular-nums leading-tight">
                {format(new Date(server.rust_last_wipe), 'h:mm a')}
              </span>
            </>
          )}
        </div>

        {/* Center: server info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <Link
              to={`/server/${server.id}`}
              className="text-sm font-semibold text-white hover:text-rust-400 transition-colors leading-snug line-clamp-1 flex-1"
            >
              {server.name}
            </Link>
            <div className="flex gap-1 flex-shrink-0">
              {isNew && (
                <span className="badge bg-rust-600 text-white border-0 text-[10px] glow-rust">NEW</span>
              )}
              {hot && !isNew && (
                <span className="badge bg-orange-900/70 text-orange-300 border border-orange-700/50 text-[10px]">🔥 HOT</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-1.5">
            <span className="badge bg-dark-500 text-dark-200 border border-dark-400 text-[10px]">
              {server.server_type || 'community'}
            </span>
            {gr > 1 && (
              <span className="badge bg-purple-900/50 text-purple-300 border border-purple-700/40 text-[10px]">{gr}x</span>
            )}
            {tm && (
              <span className="badge bg-teal-900/50 text-teal-300 border border-teal-700/40 text-[10px]">Max {tm}</span>
            )}
            {server.world_size > 0 && (
              <span className="badge bg-dark-500 text-dark-300 border border-dark-400 text-[10px]">🗺 {server.world_size.toLocaleString()}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-dark-600 rounded-full overflow-hidden max-w-[100px]">
              <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-dark-300 tabular-nums">{server.players}/{server.max_players}</span>
          </div>
        </div>

        {/* Right: action buttons — always visible on sm, hover on larger */}
        <div className="flex-shrink-0 flex flex-col gap-1 sm:flex-row sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
          {server.ip && (
            <a
              href={`steam://connect/${server.ip}:${server.port || 28015}`}
              className="text-[11px] px-2.5 py-1.5 bg-rust-700 hover:bg-rust-600 text-white rounded-lg font-semibold transition-colors text-center"
            >
              Join
            </a>
          )}
          <Link
            to={`/server/${server.id}`}
            className="text-[11px] px-2.5 py-1.5 bg-dark-500 hover:bg-dark-400 text-dark-200 rounded-lg transition-colors text-center"
          >
            Info
          </Link>
          {server.ip && (
            <button
              onClick={handleCopy}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-colors text-center ${copied ? 'bg-green-900/60 text-green-400' : 'bg-dark-500 hover:bg-dark-400 text-dark-400'}`}
              title="Copy IP"
            >
              {copied ? '✓' : '⎘'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Feed() {
  const [servers, setServers]   = useState([]);
  const [newIds, setNewIds]     = useState(new Set());
  const [loading, setLoading]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [country, setCountry]   = useState('all');
  const [hours, setHours]       = useState('12');
  const [paused, setPaused]     = useState(false);
  const knownIds                = useRef(new Set());
  const timerRef                = useRef(null);

  const doFetch = useCallback(async (isInitial = false) => {
    try {
      const { data } = await axios.get('/api/servers/recent', {
        params: { limit: 100, hours, country: country !== 'all' ? country : undefined },
      });
      const incoming = data.servers || [];

      if (!isInitial) {
        const freshNew = new Set(incoming.filter(s => !knownIds.current.has(s.id)).map(s => s.id));
        if (freshNew.size > 0) {
          setNewIds(freshNew);
          setTimeout(() => setNewIds(new Set()), 4000);
        }
      }

      knownIds.current = new Set(incoming.map(s => s.id));
      setServers(incoming);
      setLastUpdated(data.lastUpdated);
    } catch { /* silent */ } finally {
      if (isInitial) setLoading(false);
    }
  }, [country, hours]);

  useEffect(() => {
    setLoading(true);
    knownIds.current = new Set();
    doFetch(true);
  }, [doFetch]);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      if (!document.hidden) doFetch(false);
    }, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [doFetch, paused]);

  const hotCount   = servers.filter(isHot).length;
  const freshCount = servers.filter(s => s.isFresh).length;

  return (
    <div className="max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            📡 Live Wipe Feed
            {!paused && (
              <span className="flex items-center gap-1.5 text-sm font-normal text-dark-300">
                <span className="w-2 h-2 rounded-full bg-green-500 live-dot inline-block" />
                Live
              </span>
            )}
          </h1>
          <p className="text-dark-300 text-sm mt-0.5">
            {servers.length.toLocaleString()} servers wiped in the last {hours}h
            {freshCount > 0 && <> · <span className="text-rust-400 font-semibold">{freshCount} in last 20 min</span></>}
            {hotCount > 0   && <> · <span className="text-orange-400 font-semibold">{hotCount} 🔥 hot</span></>}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <select className="select text-xs py-1.5" value={country} onChange={e => setCountry(e.target.value)}>
            <option value="all">🌐 All Regions</option>
            <option value="US">🇺🇸 US</option>
            <option value="GB">🇬🇧 UK</option>
            <option value="DE">🇩🇪 Germany</option>
            <option value="FR">🇫🇷 France</option>
            <option value="NL">🇳🇱 Netherlands</option>
            <option value="AU">🇦🇺 Australia</option>
            <option value="SG">🇸🇬 Singapore</option>
            <option value="RU">🇷🇺 Russia</option>
            <option value="CA">🇨🇦 Canada</option>
          </select>

          <select className="select text-xs py-1.5" value={hours} onChange={e => setHours(e.target.value)}>
            <option value="1">Last 1 hour</option>
            <option value="3">Last 3 hours</option>
            <option value="6">Last 6 hours</option>
            <option value="12">Last 12 hours</option>
            <option value="24">Last 24 hours</option>
          </select>

          <button
            onClick={() => setPaused(p => !p)}
            className={`btn-ghost text-xs border py-1.5 ${paused ? 'border-amber-600/60 text-amber-400' : 'border-dark-500'}`}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={() => doFetch(false)} className="btn-ghost text-xs border border-dark-500 py-1.5" title="Refresh">
            ↻
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        {paused ? (
          <div className="px-3 py-1.5 bg-amber-900/20 border border-amber-700/30 rounded-lg text-amber-300 text-xs">
            ⏸ Feed paused — click Resume to continue
          </div>
        ) : (
          <div className="text-xs text-dark-500">Auto-refreshes every 30s</div>
        )}
        {lastUpdated && (
          <span className="text-xs text-dark-400 flex items-center gap-1">
            {!paused && <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot inline-block" />}
            {format(new Date(lastUpdated), 'h:mm:ss a')}
          </span>
        )}
      </div>

      {/* Feed list */}
      <div className="card">
        {loading ? (
          <LoadingSkeleton />
        ) : servers.length === 0 ? (
          <div className="text-center py-16 text-dark-400 text-sm">
            No wipes in this window — try expanding the time range
          </div>
        ) : (
          servers.map(s => (
            <FeedItem key={s.id} server={s} isNew={newIds.has(s.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-dark-600">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="px-4 py-3 flex gap-3">
          <div className="w-12 flex flex-col items-center gap-1.5">
            <div className="w-7 h-7 bg-dark-500 rounded-full" />
            <div className="w-9 h-2 bg-dark-500 rounded" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-dark-500 rounded w-3/4" />
            <div className="flex gap-1">
              <div className="h-4 w-16 bg-dark-500 rounded-full" />
              <div className="h-4 w-10 bg-dark-500 rounded-full" />
            </div>
            <div className="h-1 bg-dark-500 rounded-full w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
