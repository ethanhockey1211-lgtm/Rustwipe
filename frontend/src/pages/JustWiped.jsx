import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import FilterBar, { defaultFilters } from '../components/FilterBar.jsx';
import { WipedServerCard } from '../components/ServerCard.jsx';
import { SkeletonGrid } from '../components/SkeletonCard.jsx';
import StatsBar from '../components/StatsBar.jsx';
import DashboardStats from '../components/DashboardStats.jsx';

const PAGE_SIZE = 48;

export default function JustWiped() {
  const [filters, setFilters]     = useState(defaultFilters('wiped'));
  const [servers, setServers]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef = useRef(null);

  const fetchServers = useCallback(async (f, p) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/servers/wiped', {
        signal: abortRef.current.signal,
        params: {
          hours:      f.hours,
          sort:       f.sort,
          schedule:   f.schedule   !== 'all' ? f.schedule   : undefined,
          serverType: f.serverType !== 'all' ? f.serverType : undefined,
          country:    f.country    !== 'all' ? f.country    : undefined,
          mapSize:    f.mapSize    !== 'all' ? f.mapSize    : undefined,
          minPlayers: f.minPlayers || 0,
          limit:      PAGE_SIZE,
          offset:     p * PAGE_SIZE,
        },
      });
      setServers(data.servers || []);
      setTotal(data.total    || 0);
      setLastUpdated(data.lastUpdated || null);
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError') return;
      setError('Failed to load servers — is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // When filters change: reset page to 0 and fetch
  useEffect(() => {
    setPage(0);
    fetchServers(filters, 0);
  }, [filters, fetchServers]);

  // When page changes (but filters haven't): fetch the new page
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchServers(filters, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 2 min, paused when tab is hidden
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
        <h1 className="text-2xl font-bold text-white">🔥 Just Wiped</h1>
        <p className="text-dark-300 text-sm mt-1">
          Rust servers that recently wiped — find your fresh start
        </p>
      </div>

      <DashboardStats />
      <FilterBar filters={filters} onChange={setFilters} mode="wiped" />

      {error ? (
        <ErrorState message={error} onRetry={() => fetchServers(filters, page)} />
      ) : loading ? (
        <SkeletonGrid count={PAGE_SIZE} />
      ) : servers.length === 0 ? (
        <EmptyState hint="Try widening the time window or removing some filters." />
      ) : (
        <>
          <StatsBar total={total} showing={servers.length} label="servers just wiped" lastUpdated={lastUpdated} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {servers.map(s => <WipedServerCard key={s.id} server={s} />)}
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

function EmptyState({ hint }) {
  return (
    <div className="text-center py-24">
      <p className="text-4xl mb-3">🔍</p>
      <p className="text-dark-200 text-lg font-medium mb-1">No servers found</p>
      <p className="text-dark-400 text-sm">{hint}</p>
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
