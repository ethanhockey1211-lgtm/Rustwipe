import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import FilterBar, { defaultFilters } from '../components/FilterBar.jsx';
import { UpcomingServerCard } from '../components/ServerCard.jsx';
import StatsBar from '../components/StatsBar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { format } from 'date-fns';

const PAGE_SIZE = 48;

export default function UpcomingWipes() {
  const [filters, setFilters]   = useState(defaultFilters('upcoming'));
  const [servers, setServers]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextForceWipe, setNextForceWipe] = useState(null);

  const fetch = useCallback(async (f, p) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/servers/upcoming', {
        params: {
          hours:      f.hours,
          serverType: f.serverType === 'all' ? undefined : f.serverType,
          country:    f.country    === 'all' ? undefined : f.country,
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

  useEffect(() => {
    const id = setInterval(() => fetch(filters, page), 120000);
    return () => clearInterval(id);
  }, [filters, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          ⏰ Upcoming Wipes
        </h1>
        <p className="text-dark-300 text-sm mt-1">
          Servers predicted to wipe soon — plan your next Rust session
        </p>
      </div>

      {/* Confidence legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-dark-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          High confidence — based on 4+ recorded wipes
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          Medium — based on 2–3 wipes or name analysis
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-dark-300 inline-block" />
          Low — best guess from schedule patterns
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} mode="upcoming" />

      {error ? (
        <div className="text-center py-16">
          <p className="text-red-400 mb-2">{error}</p>
          <button className="btn-primary" onClick={() => fetch(filters, page)}>Retry</button>
        </div>
      ) : loading ? (
        <LoadingSpinner message="Predicting upcoming wipes…" />
      ) : servers.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-dark-300 text-lg mb-2">No upcoming wipes found in this window</p>
          <p className="text-dark-400 text-sm">Try extending the time window or checking back later</p>
          {nextForceWipe && (
            <p className="text-dark-400 text-sm mt-1">
              Next force wipe: {format(new Date(nextForceWipe), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      ) : (
        <>
          <StatsBar
            total={total}
            showing={servers.length}
            label="servers predicted to wipe"
            lastUpdated={lastUpdated}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {servers.map(s => <UpcomingServerCard key={s.id} server={s} />)}
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
