import { useState } from 'react';

export default function FilterBar({ filters, onChange, mode = 'wiped' }) {
  const [open, setOpen] = useState(false);

  function update(key, value) { onChange({ ...filters, [key]: value }); }

  // Count active (non-default) filters for the collapse badge
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'sort') return false;
    const def = defaultFilters(mode);
    return v !== def[k];
  }).length;

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl mb-6 overflow-hidden">
      {/* Toggle header (mobile) / always-visible header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 sm:hidden text-sm font-medium text-dark-200"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          Filters
          {activeCount > 0 && (
            <span className="badge bg-rust-600 text-white border-0 text-[10px]">{activeCount}</span>
          )}
        </span>
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Filter body — always visible on sm+, toggle on mobile */}
      <div className={`px-4 pb-4 pt-3 ${open ? 'block' : 'hidden sm:block'}`}>
        <div className="flex flex-wrap gap-3 items-end">

          {mode === 'wiped' ? (
            <FilterGroup label="Wiped Within">
              <select className="select" value={filters.hours} onChange={e => update('hours', e.target.value)}>
                <option value="1">Last 1 hour</option>
                <option value="2">Last 2 hours</option>
                <option value="6">Last 6 hours</option>
                <option value="12">Last 12 hours</option>
                <option value="24">Last 24 hours</option>
                <option value="48">Last 48 hours</option>
                <option value="168">Last 7 days</option>
              </select>
            </FilterGroup>
          ) : (
            <FilterGroup label="Wipes Within">
              <select className="select" value={filters.hours} onChange={e => update('hours', e.target.value)}>
                <option value="3">Next 3 hours</option>
                <option value="6">Next 6 hours</option>
                <option value="12">Next 12 hours</option>
                <option value="24">Next 24 hours</option>
                <option value="48">Next 48 hours</option>
                <option value="120">Next 5 days</option>
              </select>
            </FilterGroup>
          )}

          <FilterGroup label="Wipe Schedule">
            <select className="select" value={filters.schedule} onChange={e => update('schedule', e.target.value)}>
              <option value="all">Any Schedule</option>
              <option value="daily">Daily</option>
              <option value="3day">3-Day</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </FilterGroup>

          <FilterGroup label="Server Type">
            <select className="select" value={filters.serverType} onChange={e => update('serverType', e.target.value)}>
              <option value="all">All Types</option>
              <option value="official">Official</option>
              <option value="vanilla">Vanilla</option>
              <option value="community">Community</option>
              <option value="modded">Modded</option>
            </select>
          </FilterGroup>

          <FilterGroup label="Region">
            <select className="select" value={filters.country} onChange={e => update('country', e.target.value)}>
              <option value="all">🌐 All Regions</option>
              <optgroup label="North America">
                <option value="US">🇺🇸 United States</option>
                <option value="CA">🇨🇦 Canada</option>
              </optgroup>
              <optgroup label="Europe">
                <option value="GB">🇬🇧 United Kingdom</option>
                <option value="DE">🇩🇪 Germany</option>
                <option value="FR">🇫🇷 France</option>
                <option value="NL">🇳🇱 Netherlands</option>
                <option value="SE">🇸🇪 Sweden</option>
                <option value="FI">🇫🇮 Finland</option>
                <option value="PL">🇵🇱 Poland</option>
                <option value="RU">🇷🇺 Russia</option>
                <option value="UA">🇺🇦 Ukraine</option>
              </optgroup>
              <optgroup label="Asia Pacific">
                <option value="AU">🇦🇺 Australia</option>
                <option value="SG">🇸🇬 Singapore</option>
                <option value="JP">🇯🇵 Japan</option>
                <option value="KR">🇰🇷 South Korea</option>
                <option value="HK">🇭🇰 Hong Kong</option>
              </optgroup>
              <optgroup label="Other">
                <option value="BR">🇧🇷 Brazil</option>
                <option value="ZA">🇿🇦 South Africa</option>
              </optgroup>
            </select>
          </FilterGroup>

          {mode === 'wiped' && (
            <FilterGroup label="Map Size">
              <select className="select" value={filters.mapSize} onChange={e => update('mapSize', e.target.value)}>
                <option value="all">Any Size</option>
                <option value="small">Small (≤ 2000)</option>
                <option value="medium">Medium (2001–3500)</option>
                <option value="large">Large (3501–4500)</option>
                <option value="xl">XL (4500+)</option>
              </select>
            </FilterGroup>
          )}

          <FilterGroup label="Min Players">
            <select className="select" value={filters.minPlayers} onChange={e => update('minPlayers', e.target.value)}>
              <option value="0">Any</option>
              <option value="10">10+</option>
              <option value="25">25+</option>
              <option value="50">50+</option>
              <option value="100">100+</option>
              <option value="200">200+</option>
            </select>
          </FilterGroup>

          <FilterGroup label="Sort By">
            <select className="select" value={filters.sort} onChange={e => update('sort', e.target.value)}>
              {mode === 'wiped' ? (
                <>
                  <option value="recent">Most Recently Wiped</option>
                  <option value="players">Most Players</option>
                  <option value="rank">Highest Ranked</option>
                </>
              ) : (
                <>
                  <option value="soon">Wiping Soonest</option>
                  <option value="players">Most Players</option>
                  <option value="confidence">Highest Confidence</option>
                </>
              )}
            </select>
          </FilterGroup>

          <button
            className="ml-auto btn-ghost text-xs self-end border border-dark-500"
            onClick={() => onChange(defaultFilters(mode))}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <label className="text-[11px] text-dark-300 font-semibold uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

export function defaultFilters(mode = 'wiped') {
  return {
    hours:      mode === 'wiped' ? '24' : '48',
    schedule:   'all',
    serverType: 'all',
    country:    'all',
    mapSize:    'all',
    minPlayers: '0',
    sort:       mode === 'wiped' ? 'recent' : 'soon',
  };
}
