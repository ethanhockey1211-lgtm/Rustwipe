import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import FilterBar, { defaultFilters } from '../components/FilterBar.jsx';
import { WipedServerCard } from '../components/ServerCard.jsx';
import StatsBar from '../components/StatsBar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const PAGE_SIZE = 48;

export default function JustWiped() {
  const [filters, setFilters]   = useState(defaultFilters('wiped'));
  const [servers, setServers]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetch = useCallback(async (f, p) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/servers/wiped', {
        params: {
          hours:      f.hours,
          serverType: f.serverType === 'all' ? undefined : f.serverType,
          country:    f.country    === 'all' ? undefined : f.country,
          mapSize:    f.mapSize    === 'all' ? undefined : f.mapSize,
          minPlayers: f.minPlayers || 0,
          limit:      PAGE_SIZE,
          offset:     p * PAGE_SIZE,
        },
      });
      setServers(data.servers || []);
      setTotal(data.total    || 0);
      setLastUpdated(data.lastUpdated || null);
    } catch (err) {
      setError('Failed to load servers. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
    fetch(filters, 0);
  }, [filters]);

  useEffect(() => {
    fetch(filters, page);
  }, [page]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const id = setInterval(() => fetch(filters, page), 120000);
    return () => clearInterval(id);
  }, [filters, page]);

  function handleFilterChange(f) {
    setFilters(f);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          🔥 Just Wiped
        </h1>
        <p className="text-dark-300 text-sm mt-1">
          Rust servers that recently wiped — find your fresh start
        </p>
      </div>

      <FilterBar filters={filters} onChange={handleFilterChange} mode="wiped" />

      {error ? (
        <div className="text-center py-16">
          <p className="text-red-400 mb-2">{error}</p>
          <button className="btn-primary" onClick={() => fetch(filters, page)}>Retry</button>
        </div>
      ) : loading ? (
        <LoadingSpinner />
      ) : servers.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-dark-300 text-lg mb-2">No servers found</p>
          <p className="text-dark-400 text-sm">Try widening your filters or increasing the time window</p>
        </div>
      ) : (
        <>
          <StatsBar
            total={total}
            showing={servers.length}
            label="servers just wiped"
            lastUpdated={lastUpdated}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {servers.map(s => <WipedServerCard key={s.id} server={s} />)}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        className="btn-ghost border border-dark-500 disabled:opacity-30"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        ← Prev
      </button>
      <span className="text-sm text-dark-300 px-4">
        Page {page + 1} of {totalPages}
      </span>
      <button
        className="btn-ghost border border-dark-500 disabled:opacity-30"
        disabled={page >= totalPages - 1}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
