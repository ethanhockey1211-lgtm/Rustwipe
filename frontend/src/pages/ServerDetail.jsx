import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { format, formatDistanceToNow, formatDistance } from 'date-fns';
import CountdownTimer from '../components/CountdownTimer.jsx';
import { useWatchlist } from '../hooks/useWatchlist.js';

// ── Helpers (same as ServerCard, kept local to avoid circular imports) ─────────
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
  const m = lower.match(/\bmax\s*(\d+)\b|\b(\d+)\s*[\s-]?man\b|\bgroup\s*(\d+)\b/);
  if (m) { const n = parseInt(m[1]||m[2]||m[3]); if (n>=1&&n<=50) return n; }
  if (/\bquad\b/.test(lower)) return 4;
  if (/\btrio\b/.test(lower)) return 3;
  if (/\bduo\b/.test(lower)  && !/trio|squad/.test(lower)) return 2;
  if (/\bsolo\b/.test(lower) && !/duo|trio|squad/.test(lower)) return 1;
  return null;
}

const TYPE_COLORS = {
  official: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
  vanilla:  'bg-green-900/60 text-green-300 border-green-700/50',
  community:'bg-dark-500 text-dark-200 border-dark-400',
  modded:   'bg-orange-900/60 text-orange-300 border-orange-700/50',
};
const CONF_COLORS = { high:'text-green-400', medium:'text-amber-400', low:'text-dark-300' };
const CONF_ICONS  = { high:'●', medium:'◐', low:'○' };

// ── Wipe timeline chart ───────────────────────────────────────────────────────
function WipeTimeline({ history, avgInterval }) {
  if (!history || history.length === 0) {
    return <p className="text-dark-400 text-sm italic">No wipe history recorded yet. History builds over time as the tracker runs.</p>;
  }

  const maxInterval = Math.max(...history.map(w => w.intervalDays || 0), avgInterval || 0);

  return (
    <div className="space-y-2">
      {history.map((w, i) => {
        const isLatest = i === 0;
        const pct = maxInterval > 0 && w.intervalDays ? Math.min((w.intervalDays / maxInterval) * 100, 100) : 0;
        const barColor = w.intervalDays
          ? Math.abs(w.intervalDays - (avgInterval || w.intervalDays)) < 1 ? 'bg-green-500' : 'bg-amber-500'
          : 'bg-dark-500';

        return (
          <div key={w.wipe_time} className="flex items-center gap-3 group">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLatest ? 'bg-rust-500' : 'bg-dark-400'}`} />
            <div className="w-36 flex-shrink-0">
              <div className="text-xs text-white">{format(new Date(w.wipe_time), 'MMM d, h:mm a')}</div>
              <div className="text-[11px] text-dark-400">
                {formatDistanceToNow(new Date(w.wipe_time), { addSuffix: true })}
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2">
              {w.intervalDays != null ? (
                <>
                  <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-dark-300 w-16 text-right tabular-nums">
                    {w.intervalDays < 1
                      ? `${Math.round(w.intervalDays * 24)}h`
                      : `${w.intervalDays.toFixed(1)}d`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-dark-500">First recorded wipe</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ServerDetail() {
  const { id } = useParams();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const watchlist = useWatchlist();

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/servers/${id}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Server not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-40 bg-dark-600 rounded-xl" />
        <div className="h-8 bg-dark-600 rounded w-2/3" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_,i)=><div key={i} className="h-20 bg-dark-600 rounded-xl"/>)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <Link to="/" className="btn-primary">← Back to Just Wiped</Link>
      </div>
    );
  }

  const { server, wipeHistory, prediction, avgInterval, nextForceWipe, similar } = data;
  const gatherRate = detectGatherRate(server.name);
  const teamMax    = detectTeamMax(server.name);
  const playerPct  = server.max_players > 0 ? Math.min((server.players / server.max_players) * 100, 100) : 0;
  const isWatched  = watchlist.isWatched(server.id);
  const bmUrl      = `https://www.battlemetrics.com/servers/rust/${server.id}`;
  const serverAge  = server.rust_born
    ? formatDistance(new Date(server.rust_born), new Date(), { addSuffix: false }) + ' old'
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-dark-300 hover:text-white text-sm transition-colors">
        ← Back
      </Link>

      {/* Hero */}
      <div className="card overflow-hidden">
        {server.header_image ? (
          <div className="h-44 sm:h-56 overflow-hidden">
            <img src={server.header_image} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-3 bg-gradient-to-r from-rust-700 to-rust-500" />
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-2xl">{countryFlag(server.country)}</span>
                <span className={`badge border ${TYPE_COLORS[server.server_type]||TYPE_COLORS.community}`}>
                  {server.server_type}
                </span>
                {gatherRate > 1 && (
                  <span className="badge bg-purple-900/60 text-purple-300 border border-purple-700/50">{gatherRate}x</span>
                )}
                {teamMax && (
                  <span className="badge bg-teal-900/60 text-teal-300 border border-teal-700/50">Max {teamMax}</span>
                )}
                {server.rank < 10000 && (
                  <span className="badge bg-dark-500 text-dark-200 border border-dark-400">Rank #{server.rank?.toLocaleString()}</span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">{server.name}</h1>
              {serverAge && <p className="text-xs text-dark-400 mt-1">Server {serverAge}</p>}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => watchlist.toggle(server)}
                className={`btn-ghost border py-2 px-3 text-lg ${isWatched ? 'border-amber-600/60 text-amber-400' : 'border-dark-500'}`}
                title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                {isWatched ? '★' : '☆'}
              </button>
              {server.ip && (
                <a href={`steam://connect/${server.ip}:${server.port||28015}`} className="btn-primary">
                  Connect
                </a>
              )}
              <a href={bmUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost border border-dark-500">
                BattleMetrics
              </a>
            </div>
          </div>

          {/* Player bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-dark-500 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${playerPct>=90?'bg-red-500':playerPct>=60?'bg-amber-500':'bg-green-500'}`}
                style={{ width: `${playerPct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-white tabular-nums">
              {server.players}/{server.max_players} players
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="Map Size"   value={server.world_size?.toLocaleString() || '—'} icon="🗺" />
        <InfoCard label="Map"        value={server.map_name || 'Procedural'} icon="🌍" />
        <InfoCard label="Wipes Tracked" value={wipeHistory.length} icon="📊" />
        <InfoCard label="Avg Interval"
          value={avgInterval != null ? (avgInterval < 1 ? `${Math.round(avgInterval*24)}h` : `${avgInterval.toFixed(1)}d`) : '—'}
          icon="⏱"
        />
      </div>

      {/* Wipe info row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Last wipe */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-dark-300 uppercase tracking-wider mb-3">🔥 Last Wipe</h2>
          {server.rust_last_wipe ? (
            <>
              <p className="text-2xl font-bold text-white">{format(new Date(server.rust_last_wipe), 'MMM d, h:mm a')}</p>
              <p className="text-dark-300 text-sm mt-1">{formatDistanceToNow(new Date(server.rust_last_wipe), { addSuffix: true })}</p>
            </>
          ) : (
            <p className="text-dark-400">No wipe recorded</p>
          )}
          {server.ip && (
            <p className="text-xs text-dark-400 mt-3 font-mono">{server.ip}:{server.port||28015}</p>
          )}
        </div>

        {/* Next wipe prediction */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-dark-300 uppercase tracking-wider mb-3">⏰ Next Wipe Prediction</h2>
          {prediction ? (
            <>
              <p className="text-2xl font-bold text-white">{format(new Date(prediction.nextWipe), 'MMM d, h:mm a')}</p>
              <div className="flex items-center gap-3 mt-2">
                <CountdownTimer targetDate={prediction.nextWipe} />
                <span className={`text-xs ${CONF_COLORS[prediction.confidence]}`}>
                  {CONF_ICONS[prediction.confidence]} {prediction.confidence} confidence
                </span>
              </div>
              <p className="text-xs text-dark-400 mt-1 capitalize">
                Schedule: {prediction.schedule || 'unknown'}
                {prediction.intervalDays && ` · ~${prediction.intervalDays.toFixed(1)} day interval`}
              </p>
            </>
          ) : (
            <p className="text-dark-400 text-sm">Not enough data to predict</p>
          )}
        </div>
      </div>

      {/* Wipe History */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">📅 Wipe History</h2>
          {avgInterval != null && (
            <span className="text-xs text-dark-300 bg-dark-600 border border-dark-500 px-2 py-1 rounded-lg">
              Average: {avgInterval < 1 ? `${Math.round(avgInterval*24)}h` : `${avgInterval.toFixed(1)} days`}
            </span>
          )}
        </div>
        <WipeTimeline history={wipeHistory} avgInterval={avgInterval} />
      </div>

      {/* Map thumbnail if available */}
      {(server.map_thumbnail_url || server.map_url) && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-white mb-3">🗺 Current Map</h2>
          <div className="flex gap-4 items-start">
            {server.map_thumbnail_url && (
              <a href={server.map_url || server.map_thumbnail_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={server.map_thumbnail_url}
                  alt="Map preview"
                  className="w-32 h-32 rounded-lg object-cover border border-dark-500 hover:border-rust-500 transition-colors"
                />
              </a>
            )}
            <div className="text-sm text-dark-300 space-y-1">
              {server.world_size && <p>Size: <span className="text-white">{server.world_size.toLocaleString()}</span></p>}
              {server.map_seed   && <p>Seed: <span className="text-white font-mono">{server.map_seed}</span></p>}
              {server.map_url && (
                <a href={server.map_url} target="_blank" rel="noopener noreferrer"
                  className="text-rust-400 hover:text-rust-300 text-xs">
                  View full map →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Similar servers */}
      {similar.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-white mb-3">🔍 Similar Servers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {similar.map(s => (
              <Link
                key={s.id}
                to={`/server/${s.id}`}
                className="card p-3.5 hover:border-dark-400 transition-colors flex items-center gap-3"
              >
                <span className="text-xl">{countryFlag(s.country)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{s.name}</p>
                  <p className="text-xs text-dark-300">{s.players}/{s.max_players} players</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-dark-400">{label}</div>
    </div>
  );
}
