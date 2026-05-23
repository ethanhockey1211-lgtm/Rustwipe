import { useState } from 'react';
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
  monthly:  'bg-dark-500 text-dark-200 border-dark-400',
};

const CONFIDENCE_COLORS = { high: 'text-green-400', medium: 'text-amber-400', low: 'text-dark-300' };
const CONFIDENCE_ICONS  = { high: '●', medium: '◐', low: '○' };

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

function detectGatherRate(name) {
  const m = name.match(/\b([2-9]\d{0,2}|1\d{1,2})\s*[xX]\b/);
  if (m) {
    const n = parseInt(m[1]);
    if (n >= 2 && n <= 1000) return n;
  }
  return null;
}

function detectTeamSize(name) {
  const lower = name.toLowerCase();
  const solo = /\bsolo\b/.test(lower);
  const duo  = /\bduo\b/.test(lower);
  const trio = /\btrio\b/.test(lower);
  const quad = /\bquad\b/.test(lower);
  if (solo && duo && trio) return 'S/D/T';
  if (solo && duo) return 'Solo/Duo';
  if (solo) return 'Solo';
  if (duo)  return 'Duo';
  if (trio) return 'Trio';
  if (quad) return 'Quad';
  return null;
}

function PlayerBar({ players, max }) {
  const pct   = max > 0 ? Math.min((players / max) * 100, 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : pct >= 20 ? 'bg-green-500' : 'bg-dark-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-dark-500 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-dark-200 tabular-nums whitespace-nowrap">{players}/{max}</span>
    </div>
  );
}

function CopyIPButton({ ip, port }) {
  const [copied, setCopied] = useState(false);
  if (!ip) return null;

  async function handleCopy(e) {
    e.preventDefault();
    const text = `${ip}:${port || 28015}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${ip}:${port || 28015}`}
      className={`btn-ghost text-xs py-1.5 px-2.5 border ${copied ? 'border-green-600 text-green-400' : 'border-dark-500'}`}
    >
      {copied ? '✓' : '⎘'}
    </button>
  );
}

function ServerBadges({ server, extra }) {
  const gatherRate = detectGatherRate(server.name);
  const teamSize   = detectTeamSize(server.name);

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`badge border ${TYPE_COLORS[server.server_type] || TYPE_COLORS.community}`}>
        {server.server_type || 'community'}
      </span>
      {gatherRate && (
        <span className="badge bg-purple-900/60 text-purple-300 border border-purple-700/50">
          {gatherRate}x
        </span>
      )}
      {teamSize && (
        <span className="badge bg-teal-900/60 text-teal-300 border border-teal-700/50">
          {teamSize}
        </span>
      )}
      {server.world_size > 0 && (
        <span className="badge bg-dark-500 text-dark-200 border border-dark-400">
          🗺 {server.world_size.toLocaleString()}
        </span>
      )}
      {extra}
    </div>
  );
}

function CardHeader({ server }) {
  const { header_image, name, country } = server;
  return (
    <>
      {header_image ? (
        <div className="h-20 overflow-hidden bg-dark-700">
          <img src={header_image} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" loading="lazy" />
        </div>
      ) : (
        <div className="h-2 bg-gradient-to-r from-rust-700 to-rust-500" />
      )}
      <div className="flex items-start justify-between gap-2 pt-3 px-4">
        <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 flex-1">{name}</h3>
        <span className="text-xl flex-shrink-0" title={country}>{countryFlag(country)}</span>
      </div>
    </>
  );
}

// ── Just Wiped Card ──────────────────────────────────────────────────────────
export function WipedServerCard({ server }) {
  const { players, max_players, ip, port, id, rust_last_wipe } = server;
  const isNew    = rust_last_wipe && (Date.now() - new Date(rust_last_wipe).getTime()) < 3600000;
  const bmUrl    = `https://www.battlemetrics.com/servers/rust/${id}`;
  const schedule = guessScheduleFromName(server.name, server.tags);

  return (
    <div className="card hover:border-dark-400 transition-colors group flex flex-col">
      {isNew && (
        <div className="absolute top-2 left-2 z-10 badge bg-rust-600 text-white border-0 glow-rust">
          NEW
        </div>
      )}
      <div className="relative">
        <CardHeader server={server} />
      </div>

      <div className="px-4 pb-4 flex flex-col gap-2.5 flex-1">
        <ServerBadges
          server={server}
          extra={schedule && (
            <span className={`badge border ${SCHEDULE_COLORS[schedule] || SCHEDULE_COLORS.monthly}`}>
              {schedule}
            </span>
          )}
        />

        <PlayerBar players={players} max={max_players} />

        <div className="flex items-center gap-2 pt-1 border-t border-dark-500">
          <span className="text-rust-500 flex-shrink-0">🔥</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-dark-300 truncate">
              Wiped {rust_last_wipe
                ? formatDistanceToNow(new Date(rust_last_wipe), { addSuffix: true })
                : 'unknown'}
            </div>
            {rust_last_wipe && (
              <div className="text-[11px] text-dark-400">
                {format(new Date(rust_last_wipe), 'MMM d, h:mm a')}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 mt-auto pt-1">
          {ip && (
            <a href={`steam://connect/${ip}:${port || 28015}`} className="flex-1 btn-primary text-center text-xs py-1.5">
              Connect
            </a>
          )}
          <CopyIPButton ip={ip} port={port} />
          <a href={bmUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5 px-2.5 border border-dark-500">
            BM
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Upcoming Wipe Card ───────────────────────────────────────────────────────
export function UpcomingServerCard({ server }) {
  const { players, max_players, ip, port, id, nextWipe, wipeSchedule, confidence, wipe_count } = server;
  const bmUrl = `https://www.battlemetrics.com/servers/rust/${id}`;

  return (
    <div className="card hover:border-dark-400 transition-colors group flex flex-col">
      <div className="h-2 bg-gradient-to-r from-amber-700 to-amber-500" />
      <div className="flex items-start justify-between gap-2 pt-3 px-4">
        <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 flex-1">{server.name}</h3>
        <span className="text-xl flex-shrink-0" title={server.country}>{countryFlag(server.country)}</span>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-2.5 flex-1">
        <ServerBadges
          server={server}
          extra={wipeSchedule && (
            <span className={`badge border ${SCHEDULE_COLORS[wipeSchedule] || SCHEDULE_COLORS.monthly}`}>
              {wipeSchedule}
            </span>
          )}
        />

        <PlayerBar players={players} max={max_players} />

        {/* Countdown + confidence */}
        <div className="flex items-center justify-between pt-1 border-t border-dark-500">
          <div>
            <div className="text-[11px] text-dark-400 mb-0.5">Wipes in</div>
            <CountdownTimer targetDate={nextWipe} />
          </div>
          <div className="text-right">
            {nextWipe && (
              <div className="text-xs text-dark-200">{format(new Date(nextWipe), 'MMM d, h:mm a')}</div>
            )}
            {confidence && (
              <div className={`text-[11px] ${CONFIDENCE_COLORS[confidence]}`}>
                {CONFIDENCE_ICONS[confidence]} {confidence} confidence
                {wipe_count > 0 && <span className="text-dark-400 ml-1">({wipe_count} wipes tracked)</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 mt-auto pt-1">
          {ip && (
            <a href={`steam://connect/${ip}:${port || 28015}`} className="flex-1 btn-primary text-center text-xs py-1.5">
              Connect
            </a>
          )}
          <CopyIPButton ip={ip} port={port} />
          <a href={bmUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1.5 px-2.5 border border-dark-500">
            BM
          </a>
        </div>
      </div>
    </div>
  );
}

// Lightweight schedule guess for Just Wiped cards (avoids importing the service)
function guessScheduleFromName(name, tags) {
  const combined = (name + ' ' + (Array.isArray(tags) ? tags.join(' ') : '')).toLowerCase();
  if (/\bmonthly\b|\bvanilla\b|\bofficial\b/.test(combined)) return 'monthly';
  if (/\bbiweekly\b|\bbi[\s-]weekly\b/.test(combined))       return 'biweekly';
  if (/\bweekly\b/.test(combined) && !/biweekly|bi-weekly/i.test(combined)) return 'weekly';
  if (/\b3[\s-]?day\b/.test(combined)) return '3day';
  if (/\bdaily\b/.test(combined))      return 'daily';
  return null;
}
