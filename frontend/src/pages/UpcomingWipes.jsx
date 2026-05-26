import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import FilterBar, { defaultFilters } from '../components/FilterBar.jsx';
import { UpcomingServerCard } from '../components/ServerCard.jsx';
import { SkeletonGrid } from '../components/SkeletonCard.jsx';
import StatsBar from '../components/StatsBar.jsx';
import DashboardStats from '../components/DashboardStats.jsx';
import { useWatchlist } from '../hooks/useWatchlist.js';
import { format, differenceInHours } from 'date-fns';

const PAGE_SIZE = 48;

export default function UpcomingWipes() {
  const [filters, setFilters]         = useState(defaultFilters('upcoming'));
  const [servers, setServers]         = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(0);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextForceWipe, setNextForceWipe] = useState(null);
  const abortRef  = useRef(null);
  const firstRun  = useRef(true);
  const watchlist = useWatchlist();

  const fetchServers = useCallback(async (f, p) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true); setError(null);
    try {
      const { data } = await axios.get('/api/servers/upcoming', {
        signal: abortRef.current.signal,
        params: {
          hours:      f.hours,
          sort:       f.sort,
          schedule:   f.schedule   !== 'all' ? f.schedule   : undefined,
          serverType: f.serverType !== 'all' ? f.serverType : undefined,
          country:    f.country    !== 'all' ? f.country    : undefined,
          minPlayers: f.minPlayers || 0,
          limit:      PAGE_SIZE,
          offset:     p * PAGE_SIZE,
        },
      });
      setServers(data.servers || []);
      setTotal(data.total    || 0);
      setLastUpdated(data.lastUpdated || null);
      if (data.nextForceWipe) setNextForceWipe(data.nextForceWipe);
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError') return;
      setError('Failed to load servers — is the backend running?');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { setPage(0); fetchServers(filters, 0); }, [filters, fetchServers]);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    fetchServers(filters, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) fetchServers(filters, page); }, 120000);
    return () => clearInterval(id);
  }, [filters, page, fetchServers]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const forceWipeHoursAway = nextForceWipe ? differenceInHours(new Date(nextForceWipe), new Date()) : null;
  const forceWipeImminent  = forceWipeHoursAway != null && forceWipeHoursAway >= 0 && forceWipeHoursAway <= 48;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">⏰ Upcoming Wipes</h1>
        <p className="text-dark-300 text-sm mt-1">
          Wipe schedule for tracked servers — monthly wipe times are exact Facepunch force wipe dates
        </p>
      </div>

      <DashboardStats />

      {/* Force wipe alert */}
      {forceWipeImminent && nextForceWipe && (
        <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-rust-900/30 border border-rust-700/50 rounded-xl">
          <span className="text-2xl">⚡</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">
              Force Wipe in {forceWipeHoursAway < 1 ? 'less than an hour' : `${forceWipeHoursAway}h`}
            </p>
            <p className="text-xs text-rust-400 mt-0.5">
              {format(new Date(nextForceWipe), 'EEEE, MMMM d · h:mm a')} — all monthly/official/vanilla servers will wipe
            </p>
          </div>
        </div>
      )}

      {/* Confidence legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4 text-xs text-dark-300">
        <span className="flex items-center gap-1.5">
          <span className="text-rust-400 font-bold leading-none">⚡</span>
          Exact — Facepunch force wipe (1st Thursday)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>
          High — 4+ wipes in history
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>
          Medium — server name/tags
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-dark-300 inline-block"/>
          Low — estimated
        </span>
      </div>

      <FilterBar filters={filters} onChange={setFilters} mode="upcoming" />

      {error ? (
        <div className="text-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button className="btn-primary" onClick={() => fetchServers(filters, page)}>Retry</button>
        </div>
      ) : loading ? (
        <SkeletonGrid count={12} />
      ) : servers.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-dark-200 text-lg font-medium mb-1">No upcoming wipes in this window</p>
          <p className="text-dark-400 text-sm mb-4">Try extending the time window or adjusting filters</p>
          {nextForceWipe && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-dark-700 border border-dark-500 rounded-xl">
              <span className="text-rust-500">⚡</span>
              <span className="text-sm text-dark-200">
                Next force wipe:{' '}
                <span className="text-white font-semibold">
                  {format(new Date(nextForceWipe), 'MMMM d · h:mm a')}
                </span>
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
          <StatsBar total={total} showing={servers.length} label="upcoming wipes" lastUpdated={lastUpdated} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {servers.map(s => <UpcomingServerCard key={s.id} server={s} watchlist={watchlist} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button className="btn-ghost border border-dark-500 disabled:opacity-30" disabled={page===0} onClick={() => setPage(p=>p-1)}>← Prev</button>
              <span className="text-sm text-dark-300 px-4">Page {page+1} of {totalPages}</span>
              <button className="btn-ghost border border-dark-500 disabled:opacity-30" disabled={page>=totalPages-1} onClick={() => setPage(p=>p+1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
