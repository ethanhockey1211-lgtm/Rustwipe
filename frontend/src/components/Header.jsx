import { NavLink } from 'react-router-dom';
import { useState, useRef } from 'react';
import axios from 'axios';

const NAV = ({ isActive }) =>
  `px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 whitespace-nowrap ${
    isActive ? 'bg-rust-600 text-white' : 'text-dark-200 hover:text-white hover:bg-dark-600'
  }`;

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

export default function Header() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const debounceRef           = useRef(null);

  function handleSearch(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get('/api/servers/search', { params: { q, limit: 8 } });
        setResults(data.servers || []);
        setOpen(true);
      } catch { setResults([]); }
    }, 200);
  }

  return (
    <header className="bg-dark-700 border-b border-dark-600 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">

        {/* Logo */}
        <a href="/" className="flex items-center gap-2 flex-shrink-0">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="14" fill="#cd3d00"/>
            <path d="M8 20 L14 8 L20 20 L16 20 L14 15 L12 20 Z" fill="white"/>
          </svg>
          <span className="text-lg font-bold text-white tracking-tight hidden sm:block">
            Rust<span className="text-rust-500">Wipe</span>
          </span>
        </a>

        {/* Nav */}
        <nav className="flex items-center gap-1 flex-shrink-0">
          <NavLink to="/"         className={NAV}>Just Wiped</NavLink>
          <NavLink to="/upcoming" className={NAV}>Upcoming</NavLink>
          <NavLink to="/feed"     className={NAV}>📡 Feed</NavLink>
          <NavLink to="/alerts"   className={NAV}>🔔 Alerts</NavLink>
        </nav>

        {/* Search */}
        <div className="relative ml-auto w-full max-w-xs">
          <input
            type="text"
            className="input w-full pl-9 pr-3"
            placeholder="Search servers…"
            value={query}
            onChange={handleSearch}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>

          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-dark-600 border border-dark-500 rounded-xl shadow-2xl overflow-hidden z-50">
              {results.map(s => (
                <a
                  key={s.id}
                  href={`steam://connect/${s.ip}:${s.port || 28015}`}
                  onMouseDown={e => e.preventDefault()}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-dark-500 transition-colors"
                >
                  <span className="text-lg leading-none">{countryFlag(s.country)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">{s.name}</div>
                    <div className="text-xs text-dark-300">{s.players}/{s.max_players} players · {s.country}</div>
                  </div>
                  <span className="text-xs text-dark-400 flex-shrink-0">Connect</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
