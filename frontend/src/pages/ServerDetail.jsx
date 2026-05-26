import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { format, formatDistanceToNow, formatDistance } from 'date-fns';
import CountdownTimer from '../components/CountdownTimer.jsx';
import { useWatchlist } from '../hooks/useWatchlist.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
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
const CONF_COLORS = { exact:'text-rust-400', high:'text-green-400', medium:'text-amber-400', low:'text-dark-300' };
const CONF_ICONS  = { exact:'⚡', high:'●', medium:'◐', low:'○' };

function sourceLabel(prediction) {
  if (!prediction) return null;
  switch (prediction.source) {
    case 'force_wipe': return { label: 'Facepunch scheduled', color: 'text-rust-400', icon: '⚡' };
    case 'history':    return { label: `from ${prediction.wipe_count || '?'} recorded wipes`, color: 'text-green-400', icon: '●' };
    case 'name_tags':  return { label: 'detected from server name', color: 'text-amber-400', icon: '◐' };
    default:           return { label: 'estimated', color: 'text-dark-300', icon: '○' };
  }
}

// ── Wipe timeline chart ───────────────────────────────────────────────────────
function WipeTimeline({ history, avgInterval }) {
  if (!history || history.length === 0) {
    return <p className="text-dark-400 text-sm italic">No wipe history yet — data builds as the tracker runs.</p>;
  }

  const maxInterval = Math.max(...history.map(w => w.intervalDays || 0), avgInterval || 0);

  return (
    <div className="space-y-2.5">
      {history.map((w, i) => {
        const isLatest = i === 0;
        const pct = maxInterval > 0 && w.intervalDays ? Math.min((w.intervalDays / maxInterval) * 100, 100) : 0;
        const deviation = avgInterval && w.intervalDays ? Math.abs(w.intervalDays - avgInterval) / avgInterval : 0;
        const barColor = w.intervalDays
          ? deviation < 0.1 ? 'bg-green-500' : deviation < 0.25 ? 'bg-amber-500' : 'bg-red-500'
          : 'bg-dark-500';

        return (
          <div key={w.wipe_time} className="flex items-center gap-3 group">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLatest ? 'bg-rust-400' : 'bg-dark-500'}`} />
            <div className="w-40 flex-shrink-0">
              <div className="text-xs text-white font-medium">{format(new Date(w.wipe_time), 'MMM d, h:mm a')}</div>
              <div className="text-[10px] text-dark-400">
                {formatDistanceToNow(new Date(w.wipe_time), { addSuffix: true })}
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2">
              {w.intervalDays != null ? (
                <>
                  <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-dark-300 w-14 text-right tabular-nums flex-shrink-0">
                    {w.intervalDays < 1
                      ? `${Math.round(w.intervalDays * 24)}h`
                      : `${w.intervalDays.toFixed(1)}d`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-dark-500 italic">first entry</span>
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
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
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
  const src = sourceLabel(prediction);

  const intervals = wipeHistory.map(w => w.intervalDays).filter(d => d != null && d > 0);
  const consistency = (() => {
    if (intervals.length < 2) return null;
    const mean = intervals.reduce((a,b)=>a+b,0) / intervals.length;
    const variance = intervals.reduce((s,d)=>s+Math.pow(d-mean,2),0) / intervals.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    return Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));
  })();

  const consistencyColor = consistency == null ? '' :
    consistency >= 85 ? 'text-green-400' :
    consistency >= 60 ? 'text-amber-400' : 'text-red-400';

  const hoursSinceWipe = server.rust_last_wipe
    ? (Date.now() - new Date(server.rust_last_wipe).getTime()) / 3600000 : Infinity;
  const hot = hoursSinceWipe < 4 && playerPct >= 25;

  const isForceWipe = prediction?.source === 'force_wipe';
  const nextWipeTitle = isForceWipe ? '⚡ Force Wipe' : '⏰ Next Wipe';

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-dark-300 hover:text-white text-sm transition-colors">
        ← Back
      </Link>

      {/* Hero */}
      <div className="card overflow-hidden">
        {server.header_image ? (
          <div className="h-44 sm:h-52 overflow-hidden relative">
            <img src={server.header_image} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-dark-800/80 to-transparent" />
          </div>
        ) : (
          <div className="h-3 bg-gradient-to-r from-rust-700 to-rust-500" />
        )}

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
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

            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
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
            <span className="text-sm font-semibold text-white tabular-nums whitespace-nowrap">
              {server.players}/{server.max_players} players
            </span>
          </div>
        </div>
      </div>

      {hot && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-900/30 border border-orange-700/40 rounded-xl text-orange-300 text-sm">
          🔥 <span className="font-semibold">Hot server</span> — wiped recently and filling up fast ({Math.round(playerPct)}% full)
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="Map Size"   value={server.world_size?.toLocaleString() || '—'} icon="🗺" />
        <InfoCard label="Wipes Recorded" value={wipeHistory.length || '—'} icon="📊" />
        <InfoCard label="Avg Interval"
          value={avgInterval != null ? (avgInterval < 1 ? `${Math.round(avgInterval*24)}h` : `${avgInterval.toFixed(1)}d`) : '—'}
          icon="⏱"
        />
        <InfoCard
          label="Reliability"
          value={consistency != null ? `${consistency}%` : '—'}
          icon={consistency == null ? '📈' : consistency >= 85 ? '✅' : consistency >= 60 ? '⚠️' : '❌'}
          valueClass={consistencyColor}
          tooltip={consistency != null ? `Based on ${intervals.length} recorded intervals` : 'Need 3+ wipes to calculate'}
        />
      </div>

      {/* Wipe info row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Last wipe */}
        <div className="card p-5">
          <h2 className="text-xs font-bold text-dark-300 uppercase tracking-wider mb-3">🔥 Last Wipe</h2>
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

        {/* Next wipe */}
        <div className={`card p-5 ${isForceWipe ? 'border-rust-800/50' : ''}`}>
          <h2 className="text-xs font-bold text-dark-300 uppercase tracking-wider mb-3">{nextWipeTitle}</h2>
          {prediction ? (
            <>
              <p className="text-2xl font-bold text-white">{format(new Date(prediction.nextWipe), 'MMM d, h:mm a')}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <CountdownTimer targetDate={prediction.nextWipe} variant="blocks" />
                {src && (
                  <span className={`text-xs ${src.color} flex items-center gap-1`}>
                    <span>{src.icon}</span>
                    <span>{src.label}</span>
                  </span>
                )}
              </div>
              {prediction.source !== 'force_wipe' && prediction.intervalDays && (
                <p className="text-xs text-dark-400 mt-1.5 capitalize">
                  {prediction.schedule} · ~{prediction.intervalDays.toFixed(1)} day interval
                </p>
              )}
              {isForceWipe && (
                <p className="text-xs text-rust-500/70 mt-1.5">
                  Facepunch patches all servers on this date
                </p>
              )}
            </>
          ) : (
            <p className="text-dark-400 text-sm">Not enough data to calculate</p>
          )}
        </div>
      </div>

      {/* Wipe History */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">📅 Wipe History</h2>
          <div className="flex items-center gap-3">
            {avgInterval != null && (
              <span className="text-xs text-dark-300 bg-dark-700 border border-dark-500 px-2.5 py-1 rounded-lg">
                avg {avgInterval < 1 ? `${Math.round(avgInterval*24)}h` : `${avgInterval.toFixed(1)}d`}
              </span>
            )}
            {consistency != null && (
              <span className={`text-xs ${consistencyColor} bg-dark-700 border border-dark-500 px-2.5 py-1 rounded-lg`}>
                {consistency}% reliable
              </span>
            )}
          </div>
        </div>
        <WipeTimeline history={wipeHistory} avgInterval={avgInterval} />
      </div>

      {/* Map thumbnail */}
      {(server.map_thumbnail_url || server.map_url) && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-white mb-4">🗺 Current Map</h2>
          <div className="flex gap-5 items-start">
            {server.map_thumbnail_url && (
              <a href={server.map_url || server.map_thumbnail_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={server.map_thumbnail_url}
                  alt="Map preview"
                  className="w-36 h-36 rounded-xl object-cover border border-dark-500 hover:border-rust-500 transition-colors"
                />
              </a>
            )}
            <div className="text-sm text-dark-300 space-y-1.5">
              {server.world_size && <p>Size: <span className="text-white font-medium">{server.world_size.toLocaleString()}</span></p>}
              {server.map_seed   && <p>Seed: <span className="text-white font-mono">{server.map_seed}</span></p>}
              {server.map_url && (
                <a href={server.map_url} target="_blank" rel="noopener noreferrer"
                  className="text-rust-400 hover:text-rust-300 text-xs inline-flex items-center gap-1">
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
                <span className="text-xl flex-shrink-0">{countryFlag(s.country)}</span>
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

function InfoCard({ icon, label, value, valueClass = 'text-white', tooltip }) {
  return (
    <div className="card p-4 text-center" title={tooltip}>
      <div className="text-2xl mb-1.5">{icon}</div>
      <div className={`text-lg font-bold leading-none ${valueClass}`}>{value}</div>
      <div className="text-xs text-dark-400 mt-1">{label}</div>
    </div>
  );
}
