import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import FilterBar, { defaultFilters } from '../components/FilterBar.jsx';
import { WipedServerCard } from '../components/ServerCard.jsx';
import { SkeletonGrid } from '../components/SkeletonCard.jsx';
import StatsBar from '../components/StatsBar.jsx';
import DashboardStats from '../components/DashboardStats.jsx';
import { useWatchlist } from '../hooks/useWatchlist.js';

const PAGE_SIZE = 48;

export default function JustWiped() {
  const [tab, setTab]           = useState('all'); // 'all' | 'watchlist'
  const [filters, setFilters]   = useState(defaultFilters('wiped'));
  const [servers, setServers]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef  = useRef(null);
  const firstRun  = useRef(true);
  const watchlist = useWatchlist();

  const fetchServers = useCallback(async (f, p) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true); setError(null);
    try {
      const { data } = await axios.get('/api/servers/wiped', {
        signal: abortRef.current.signal,
        params: {
          hours:      f.hours,
          sort:       f.sort,
          schedule:   f.schedule    !== 'all' ? f.schedule    : undefined,
          serverType: f.serverType  !== 'all' ? f.serverType  : undefined,
          country:    f.country     !== 'all' ? f.country     : undefined,
          mapSize:    f.mapSize     !== 'all' ? f.mapSize     : undefined,
          minPlayers: f.minPlayers  || 0,
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

  // For watchlist tab: batch-fetch the watched servers
  const [watchServers, setWatchServers]     = useState([]);
  const [watchLoading, setWatchLoading]     = useState(false);

  useEffect(() => {
    if (tab !== 'watchlist' || watchlist.ids.length === 0) return;
    setWatchLoading(true);
    axios.get('/api/servers/batch', { params: { ids: watchlist.ids.join(',') } })
      .then(r => setWatchServers(r.data.servers || []))
      .catch(() => setWatchServers([]))
      .finally(() => setWatchLoading(false));
  }, [tab, watchlist.ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">🔥 Just Wiped</h1>
        <p className="text-dark-300 text-sm mt-1">Rust servers that recently wiped — fresh maps, fresh start</p>
      </div>

      <DashboardStats />

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <TabButton active={tab === 'all'}       onClick={() => setTab('all')}>All Servers</TabButton>
        <TabButton active={tab === 'watchlist'} onClick={() => setTab('watchlist')}>
          ★ Watchlist
          {watchlist.list.length > 0 && (
            <span className="ml-1.5 badge bg-amber-900/60 text-amber-300 border-0 text-[10px]">
              {watchlist.list.length}
            </span>
          )}
        </TabButton>
      </div>

      {tab === 'watchlist' ? (
        <WatchlistTab servers={watchServers} loading={watchLoading} watchlist={watchlist} />
      ) : (
        <>
          <FilterBar filters={filters} onChange={setFilters} mode="wiped" />

          {error ? (
            <ErrorState message={error} onRetry={() => fetchServers(filters, page)} />
          ) : loading ? (
            <SkeletonGrid count={12} />
          ) : servers.length === 0 ? (
            <EmptyState hint="Try widening the time window or removing some filters." />
          ) : (
            <>
              <StatsBar total={total} showing={servers.length} label="servers just wiped" lastUpdated={lastUpdated} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {servers.map(s => <WipedServerCard key={s.id} server={s} watchlist={watchlist} />)}
              </div>
              {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

function WatchlistTab({ servers, loading, watchlist }) {
  if (loading) return <SkeletonGrid count={4} />;
  if (watchlist.list.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-4xl mb-3">☆</p>
        <p className="text-dark-200 text-lg font-medium mb-1">Your watchlist is empty</p>
        <p className="text-dark-400 text-sm">Click the ☆ star on any server card to save it here</p>
      </div>
    );
  }
  if (servers.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-dark-400 text-sm">None of your watched servers are currently in the database</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {servers.map(s => <WipedServerCard key={s.id} server={s} watchlist={watchlist} />)}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1 ${
        active ? 'bg-rust-600 text-white' : 'text-dark-300 hover:text-white hover:bg-dark-600'
      }`}
    >
      {children}
    </button>
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
      <button className="btn-ghost border border-dark-500 disabled:opacity-30"
        disabled={page===0} onClick={() => onChange(page-1)}>← Prev</button>
      <span className="text-sm text-dark-300 px-4">Page {page+1} of {totalPages}</span>
      <button className="btn-ghost border border-dark-500 disabled:opacity-30"
        disabled={page>=totalPages-1} onClick={() => onChange(page+1)}>Next →</button>
    </div>
  );
}
