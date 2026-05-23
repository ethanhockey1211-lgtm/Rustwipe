import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import axios from 'axios';

const NAV_LINK_CLASS = ({ isActive }) =>
  `px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-150 ${
    isActive
      ? 'bg-rust-600 text-white'
      : 'text-dark-200 hover:text-white hover:bg-dark-600'
  }`;

export default function Header() {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]     = useState(false);
  const navigate = useNavigate();

  async function handleSearch(e) {
    const q = e.target.value;
    setQuery(q);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    try {
      const { data } = await axios.get('/api/servers/search', { params: { q, limit: 8 } });
      setResults(data.servers || []);
      setOpen(true);
    } catch { setResults([]); }
  }

  function countryFlag(code) {
    if (!code || code.length !== 2) return '🌐';
    return code.toUpperCase().replace(/./g, c =>
      String.fromCodePoint(c.charCodeAt(0) + 127397)
    );
  }

  return (
    <header className="bg-dark-700 border-b border-dark-600 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 flex-shrink-0">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="14" fill="#cd3d00"/>
            <path d="M8 20 L14 8 L20 20 L16 20 L14 15 L12 20 Z" fill="white"/>
          </svg>
          <span className="text-lg font-bold text-white tracking-tight">
            Rust<span className="text-rust-500">Wipe</span>
          </span>
        </a>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <NavLink to="/"        className={NAV_LINK_CLASS}>Just Wiped</NavLink>
          <NavLink to="/upcoming" className={NAV_LINK_CLASS}>Upcoming Wipes</NavLink>
        </nav>

        {/* Search */}
        <div className="relative ml-auto w-64">
          <input
            type="text"
            className="input w-full pl-9"
            placeholder="Search servers..."
            value={query}
            onChange={handleSearch}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>

          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-dark-600 border border-dark-500 rounded-xl shadow-2xl overflow-hidden z-50">
              {results.map(s => (
                <a
                  key={s.id}
                  href={`steam://connect/${s.ip}:${s.port}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-dark-500 transition-colors"
                >
                  <span className="text-lg">{countryFlag(s.country)}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{s.name}</div>
                    <div className="text-xs text-dark-300">{s.players}/{s.max_players} players</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
