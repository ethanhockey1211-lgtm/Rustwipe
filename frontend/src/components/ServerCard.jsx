import { formatDistanceToNow, format } from 'date-fns';
import CountdownTimer from './CountdownTimer.jsx';

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

const CONFIDENCE_COLORS = {
  high:   'text-green-400',
  medium: 'text-amber-400',
  low:    'text-dark-300',
};

const CONFIDENCE_LABELS = {
  high:   '● High confidence',
  medium: '◐ Medium confidence',
  low:    '○ Low confidence',
};

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  );
}

function PlayerBar({ players, max }) {
  const pct = max > 0 ? Math.min((players / max) * 100, 100) : 0;
  const color =
    pct >= 90 ? 'bg-red-500' :
    pct >= 60 ? 'bg-amber-500' :
    pct >= 20 ? 'bg-green-500' : 'bg-dark-400';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-dark-500 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-dark-200 tabular-nums whitespace-nowrap">
        {players}/{max}
      </span>
    </div>
  );
}

export function WipedServerCard({ server }) {
  const { name, players, max_players, country, server_type, world_size, rust_last_wipe, ip, port, header_image, id } = server;
  const bmUrl = `https://www.battlemetrics.com/servers/rust/${id}`;

  return (
    <div className="card hover:border-dark-400 transition-colors group">
      {/* Header image */}
      {header_image ? (
        <div className="h-20 overflow-hidden bg-dark-700">
          <img src={header_image} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" />
        </div>
      ) : (
        <div className="h-2 bg-gradient-to-r from-rust-700 to-rust-500" />
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* Name + flag */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 flex-1">{name}</h3>
          <span className="text-xl flex-shrink-0" title={country}>{countryFlag(country)}</span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`badge border ${TYPE_COLORS[server_type] || TYPE_COLORS.community}`}>
            {server_type}
          </span>
          {world_size && (
            <span className="badge bg-dark-500 text-dark-200 border border-dark-400">
              🗺 {world_size.toLocaleString()}
            </span>
          )}
        </div>

        {/* Players */}
        <PlayerBar players={players} max={max_players} />

        {/* Wipe time */}
        <div className="flex items-center gap-2 pt-1 border-t border-dark-500">
          <span className="text-rust-500 text-sm">🔥</span>
          <div className="flex-1">
            <div className="text-xs text-dark-300">
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

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {ip && (
            <a
              href={`steam://connect/${ip}:${port || 28015}`}
              className="flex-1 btn-primary text-center text-xs py-1.5"
            >
              Connect
            </a>
          )}
          <a
            href={bmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs py-1.5 border border-dark-500"
          >
            BM
          </a>
        </div>
      </div>
    </div>
  );
}

export function UpcomingServerCard({ server }) {
  const { name, players, max_players, country, server_type, world_size,
          nextWipe, wipeSchedule, confidence, ip, port, header_image, id } = server;
  const bmUrl = `https://www.battlemetrics.com/servers/rust/${id}`;

  return (
    <div className="card hover:border-dark-400 transition-colors group">
      {header_image ? (
        <div className="h-20 overflow-hidden bg-dark-700">
          <img src={header_image} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" />
        </div>
      ) : (
        <div className="h-2 bg-gradient-to-r from-amber-700 to-amber-500" />
      )}

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 flex-1">{name}</h3>
          <span className="text-xl flex-shrink-0" title={country}>{countryFlag(country)}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`badge border ${TYPE_COLORS[server_type] || TYPE_COLORS.community}`}>
            {server_type}
          </span>
          {wipeSchedule && (
            <span className={`badge border ${SCHEDULE_COLORS[wipeSchedule] || SCHEDULE_COLORS.monthly}`}>
              {wipeSchedule}
            </span>
          )}
          {world_size && (
            <span className="badge bg-dark-500 text-dark-200 border border-dark-400">
              🗺 {world_size.toLocaleString()}
            </span>
          )}
        </div>

        <PlayerBar players={players} max={max_players} />

        {/* Countdown */}
        <div className="flex items-center justify-between pt-1 border-t border-dark-500">
          <div>
            <div className="text-xs text-dark-300">Wipes in</div>
            <CountdownTimer targetDate={nextWipe} />
          </div>
          <div className="text-right">
            <div className="text-xs text-dark-300">
              {nextWipe ? format(new Date(nextWipe), 'MMM d, h:mm a') : ''}
            </div>
            {confidence && (
              <div className={`text-[11px] ${CONFIDENCE_COLORS[confidence]}`}>
                {CONFIDENCE_LABELS[confidence]}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {ip && (
            <a
              href={`steam://connect/${ip}:${port || 28015}`}
              className="flex-1 btn-primary text-center text-xs py-1.5"
            >
              Connect
            </a>
          )}
          <a
            href={bmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs py-1.5 border border-dark-500"
          >
            BM
          </a>
        </div>
      </div>
    </div>
  );
}
