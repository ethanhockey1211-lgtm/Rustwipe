import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import FilterBar, { defaultFilters } from '../components/FilterBar.jsx';
import { UpcomingServerCard } from '../components/ServerCard.jsx';
import { SkeletonGrid } from '../components/SkeletonCard.jsx';
import StatsBar from '../components/StatsBar.jsx';
import DashboardStats from '../components/DashboardStats.jsx';
import { format } from 'date-fns';

const PAGE_SIZE = 48;

export default function UpcomingWipes() {
  const [filters, setFilters]     = useState(defaultFilters('upcoming'));
  const [servers, setServers]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextForceWipe, setNextForceWipe] = useState(null);
  const abortRef = useRef(null);

  const fetchServers = useCallback(async (f, p) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
    fetchServers(filters, 0);
  }, [filters, fetchServers]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchServers(filters, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) fetchServers(filters, page);
    }, 120000);
    return () => clearInterval(id);
  }, [filters, page, fetchServers]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">⏰ Upcoming Wipes</h1>
        <p className="text-dark-300 text-sm mt-1">
          Servers predicted to wipe soon — plan your next Rust session
        </p>
      </div>

      <DashboardStats />

      {/* Confidence legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4 text-xs text-dark-300">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          High — 4+ recorded wipes (very reliable)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          Medium — 2–3 wipes or name/tag analysis
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-dark-300 inline-block" />
          Low — heuristic guess from schedule patterns
        </span>
      </div>

      <FilterBar filters={filters} onChange={setFilters} mode="upcoming" />

      {error ? (
        <ErrorState message={error} onRetry={() => fetchServers(filters, page)} />
      ) : loading ? (
        <SkeletonGrid count={PAGE_SIZE} />
      ) : servers.length === 0 ? (
        <EmptyState nextForceWipe={nextForceWipe} />
      ) : (
        <>
          <StatsBar total={total} showing={servers.length} label="servers predicted to wipe" lastUpdated={lastUpdated} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {servers.map(s => <UpcomingServerCard key={s.id} server={s} />)}
          </div>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
        </>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="text-center py-20">
      <p className="text-red-400 mb-4">{message}</p>
      <button className="btn-primary" onClick={onRetry}>Retry</button>
    </div>
  );
}

function EmptyState({ nextForceWipe }) {
  return (
    <div className="text-center py-24">
      <p className="text-4xl mb-3">📅</p>
      <p className="text-dark-200 text-lg font-medium mb-1">No upcoming wipes in this window</p>
      <p className="text-dark-400 text-sm mb-3">Try extending the time window or adjusting filters</p>
      {nextForceWipe && (
        <p className="text-dark-300 text-sm">
          Next force wipe: <span className="text-white font-semibold">
            {format(new Date(nextForceWipe), 'MMMM d, yyyy · h:mm a')}
          </span>
        </p>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button className="btn-ghost border border-dark-500 disabled:opacity-30" disabled={page === 0}
        onClick={() => onChange(page - 1)}>← Prev</button>
      <span className="text-sm text-dark-300 px-4">Page {page + 1} of {totalPages}</span>
      <button className="btn-ghost border border-dark-500 disabled:opacity-30" disabled={page >= totalPages - 1}
        onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}
