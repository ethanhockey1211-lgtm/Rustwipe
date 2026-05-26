import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import CountdownTimer from './CountdownTimer.jsx';

// ── Shared helpers ────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  official:  'bg-blue-900/60 text-blue-300 border-blue-700/50',
  vanilla:   'bg-green-900/60 text-green-300 border-green-700/50',
  community: 'bg-dark-500 text-dark-200 border-dark-400',
  modded:    'bg-orange-900/60 text-orange-300 border-orange-700/50',
};
const SCHEDULE_COLORS = {
  daily:    'bg-red-900/60 text-red-300 border-red-700/50',
  '3day':   'bg-orange-900/60 text-orange-300 border-orange-700/50',
  weekly:   'bg-amber-900/60 text-amber-300 border-amber-700/50',
  biweekly: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50',
  monthly:  'bg-rust-900/60 text-rust-300 border-rust-700/50',
};
const CONFIDENCE_COLORS = { exact:'text-rust-400', high:'text-green-400', medium:'text-amber-400', low:'text-dark-300' };
const CONFIDENCE_ICONS  = { exact:'⚡', high:'●', medium:'◐', low:'○' };

export function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

export function detectGatherRate(name) {
  const m = name.match(/\b([2-9]\d{0,2}|1\d{1,2})\s*[xX]\b/);
  if (m) { const n = parseInt(m[1]); if (n >= 2 && n <= 1000) return n; }
  return 1;
}

export function detectTeamMax(name) {
  const lower = name.toLowerCase();
  const m = lower.match(/\bmax\s*(\d+)\b|\b(\d+)\s*[\s-]?man\b|\bgroup\s*(\d+)\b/);
  if (m) { const n = parseInt(m[1]||m[2]||m[3]); if (n>=1&&n<=50) return n; }
  if (/\bquad\b/.test(lower)) return 4;
  if (/\btrio\b/.test(lower)) return 3;
  if (/\bduo\b/.test(lower)  && !/trio|squad/.test(lower)) return 2;
  if (/\bsolo\b/.test(lower) && !/duo|trio|squad/.test(lower)) return 1;
  return null;
}

function guessSchedule(name, tags) {
  const c = (name + ' ' + (Array.isArray(tags) ? tags.join(' ') : '')).toLowerCase();
  if (/\bmonthly\b|\bvanilla\b|\bofficial\b/.test(c)) return 'monthly';
  if (/\bbiweekly\b|\bbi[\s-]weekly\b/.test(c))       return 'biweekly';
  if (/\bweekly\b/.test(c) && !/biweekly|bi-weekly/i.test(c)) return 'weekly';
  if (/\b3[\s-]?day\b/.test(c)) return '3day';
  if (/\bdaily\b/.test(c))      return 'daily';
  return null;
}

function PlayerBar({ players, max }) {
  const pct   = max > 0 ? Math.min((players / max) * 100, 100) : 0;
  const color = pct>=90?'bg-red-500':pct>=60?'bg-amber-500':pct>=20?'bg-green-500':'bg-dark-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-dark-500 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width:`${pct}%` }} />
      </div>
      <span className="text-xs text-dark-200 tabular-nums whitespace-nowrap">{players}/{max}</span>
    </div>
  );
}

function CopyIPButton({ ip, port }) {
  const [copied, setCopied] = useState(false);
  if (!ip) return null;

  async function copy(e) {
    e.preventDefault();
    const text = `${ip}:${port||28015}`;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={copy} title={`Copy ${ip}:${port||28015}`}
      className={`btn-ghost text-xs py-1.5 px-2.5 border ${copied?'border-green-600 text-green-400':'border-dark-500'}`}>
      {copied ? '✓' : '⎘'}
    </button>
  );
}

function StarButton({ server, watchlist }) {
  if (!watchlist) return null;
  const watched = watchlist.isWatched(server.id);
  return (
    <button
      onClick={e => { e.preventDefault(); watchlist.toggle(server); }}
      title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`btn-ghost text-base py-1.5 px-2.5 border ${watched?'border-amber-600/60 text-amber-400':'border-dark-500 text-dark-400 hover:text-amber-400'}`}
    >
      {watched ? '★' : '☆'}
    </button>
  );
}

function Badges({ server, extra }) {
  const gr = detectGatherRate(server.name);
  const tm = detectTeamMax(server.name);
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`badge border ${TYPE_COLORS[server.server_type]||TYPE_COLORS.community}`}>
        {server.server_type||'community'}
      </span>
      {gr > 1 && <span className="badge bg-purple-900/60 text-purple-300 border border-purple-700/50">{gr}x</span>}
      {tm     && <span className="badge bg-teal-900/60 text-teal-300 border border-teal-700/50">Max {tm}</span>}
      {server.world_size > 0 && (
        <span className="badge bg-dark-500 text-dark-200 border border-dark-400">🗺 {server.world_size.toLocaleString()}</span>
      )}
      {extra}
    </div>
  );
}

// ── Just Wiped Card ───────────────────────────────────────────────────────────
export function WipedServerCard({ server, watchlist }) {
  const { players, max_players, ip, port, id, rust_last_wipe, header_image, name } = server;
  const isNew    = rust_last_wipe && (Date.now()-new Date(rust_last_wipe).getTime()) < 3600000;
  const bmUrl    = `https://www.battlemetrics.com/servers/rust/${id}`;
  const schedule = guessSchedule(name, server.tags);
  const hoursSince = rust_last_wipe ? (Date.now()-new Date(rust_last_wipe).getTime())/3600000 : Infinity;
  const pct        = max_players > 0 ? players/max_players : 0;
  const isHot    = !isNew && hoursSince < 4 && (pct >= 0.25 || players >= 30);

  return (
    <div className="card hover:border-dark-400 transition-colors group flex flex-col relative">
      {isNew && (
        <span className="absolute top-2 left-2 z-10 badge bg-rust-600 text-white border-0 glow-rust">NEW</span>
      )}
      {isHot && (
        <span className="absolute top-2 left-2 z-10 badge bg-orange-800 text-orange-200 border-0">🔥 HOT</span>
      )}

      {header_image
        ? <div className="h-20 overflow-hidden bg-dark-700">
            <img src={header_image} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" loading="lazy"/>
          </div>
        : <div className="h-2 bg-gradient-to-r from-rust-700 to-rust-500"/>
      }

      <div className="px-4 pb-4 pt-3 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/server/${id}`} className="text-sm font-semibold text-white leading-tight line-clamp-2 flex-1 hover:text-rust-400 transition-colors">
            {name}
          </Link>
          <span className="text-xl flex-shrink-0">{countryFlag(server.country)}</span>
        </div>

        <Badges server={server} extra={
          schedule && <span className={`badge border ${SCHEDULE_COLORS[schedule]||SCHEDULE_COLORS.monthly}`}>{schedule}</span>
        }/>

        <PlayerBar players={players} max={max_players}/>

        <div className="flex items-center gap-2 pt-1 border-t border-dark-500">
          <span className="text-rust-500 flex-shrink-0">🔥</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-dark-300 truncate">
              Wiped {rust_last_wipe ? formatDistanceToNow(new Date(rust_last_wipe),{addSuffix:true}) : 'unknown'}
            </div>
            {rust_last_wipe && (
              <div className="text-[11px] text-dark-400">{format(new Date(rust_last_wipe),'MMM d, h:mm a')}</div>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 mt-auto pt-1">
          {ip && <a href={`steam://connect/${ip}:${port||28015}`} className="flex-1 btn-primary text-center text-xs py-1.5">Connect</a>}
          <StarButton server={server} watchlist={watchlist}/>
          <CopyIPButton ip={ip} port={port}/>
          <a href={bmUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5 px-2.5 border border-dark-500">BM</a>
        </div>
      </div>
    </div>
  );
}

// ── Upcoming Wipe Card ────────────────────────────────────────────────────────
export function UpcomingServerCard({ server, watchlist }) {
  const { players, max_players, ip, port, id, nextWipe, wipeSchedule, confidence, wipe_count, header_image, wipeSource } = server;
  const bmUrl = `https://www.battlemetrics.com/servers/rust/${id}`;
  const isForceWipe = wipeSource === 'force_wipe';
  const isFromHistory = wipeSource === 'history';

  function SourceBadge() {
    if (isForceWipe) {
      return <span className="text-[10px] text-rust-400 font-semibold tracking-wide">⚡ Facepunch scheduled</span>;
    }
    if (isFromHistory) {
      return (
        <span className={`text-[10px] ${CONFIDENCE_COLORS[confidence]}`}>
          {CONFIDENCE_ICONS[confidence]} {wipe_count > 0 ? `${wipe_count} wipes logged` : confidence}
        </span>
      );
    }
    if (wipeSource === 'name_tags') {
      return <span className="text-[10px] text-amber-400">◐ schedule from name</span>;
    }
    return <span className="text-[10px] text-dark-300">○ estimated</span>;
  }

  return (
    <div className={`card hover:border-dark-400 transition-colors group flex flex-col ${isForceWipe ? 'border-rust-800/60' : ''}`}>
      {header_image
        ? <div className="h-20 overflow-hidden bg-dark-700 relative">
            <img src={header_image} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" loading="lazy"/>
            {isForceWipe && (
              <div className="absolute inset-0 bg-gradient-to-t from-dark-900/70 to-transparent flex items-end px-3 pb-2">
                <span className="badge bg-rust-600/90 text-white border-0 text-[10px] tracking-wide uppercase glow-rust">⚡ Force Wipe</span>
              </div>
            )}
          </div>
        : <div className={`h-2 bg-gradient-to-r ${isForceWipe ? 'from-rust-700 to-rust-400' : 'from-amber-700 to-amber-500'}`}/>
      }

      <div className="px-4 pb-4 pt-3 flex flex-col gap-2.5 flex-1">
        {/* Server name + flag */}
        <div className="flex items-start justify-between gap-2">
          <Link to={`/server/${id}`} className="text-sm font-semibold text-white leading-tight line-clamp-2 flex-1 hover:text-rust-400 transition-colors">
            {server.name}
          </Link>
          <span className="text-xl flex-shrink-0">{countryFlag(server.country)}</span>
        </div>

        <Badges server={server} extra={
          wipeSchedule && (
            <span className={`badge border ${SCHEDULE_COLORS[wipeSchedule]||SCHEDULE_COLORS.monthly}`}>
              {isForceWipe ? '⚡ ' : ''}{wipeSchedule}
            </span>
          )
        }/>

        <PlayerBar players={players} max={max_players}/>

        {/* Wipe timing section */}
        <div className="pt-2 border-t border-dark-500">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[10px] text-dark-400 uppercase tracking-wider mb-1">
                {isForceWipe ? 'Force Wipe In' : 'Wipes In'}
              </div>
              <CountdownTimer targetDate={nextWipe}/>
            </div>
            <div className="text-right">
              {nextWipe && (
                <div className="text-xs text-dark-200 font-medium">
                  {format(new Date(nextWipe), 'MMM d, h:mm a')}
                </div>
              )}
              <div className="mt-0.5">
                <SourceBadge />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 mt-auto pt-1">
          {ip && <a href={`steam://connect/${ip}:${port||28015}`} className="flex-1 btn-primary text-center text-xs py-1.5">Connect</a>}
          <StarButton server={server} watchlist={watchlist}/>
          <CopyIPButton ip={ip} port={port}/>
          <a href={bmUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5 px-2.5 border border-dark-500">BM</a>
        </div>
      </div>
    </div>
  );
}
