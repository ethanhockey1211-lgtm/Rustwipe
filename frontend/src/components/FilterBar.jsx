export default function FilterBar({ filters, onChange, mode = 'wiped' }) {
  function update(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-end">

        {mode === 'wiped' && (
          <FilterGroup label="Wiped Within">
            <select className="select" value={filters.hours} onChange={e => update('hours', e.target.value)}>
              <option value="2">Last 2 hours</option>
              <option value="6">Last 6 hours</option>
              <option value="12">Last 12 hours</option>
              <option value="24">Last 24 hours</option>
              <option value="48">Last 48 hours</option>
              <option value="168">Last 7 days</option>
            </select>
          </FilterGroup>
        )}

        {mode === 'upcoming' && (
          <FilterGroup label="Wipes Within">
            <select className="select" value={filters.hours} onChange={e => update('hours', e.target.value)}>
              <option value="6">Next 6 hours</option>
              <option value="12">Next 12 hours</option>
              <option value="24">Next 24 hours</option>
              <option value="48">Next 48 hours</option>
              <option value="120">Next 5 days</option>
            </select>
          </FilterGroup>
        )}

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
            <option value="all">All Regions</option>
            <option value="US">🇺🇸 North America</option>
            <option value="GB">🇬🇧 United Kingdom</option>
            <option value="DE">🇩🇪 Germany</option>
            <option value="FR">🇫🇷 France</option>
            <option value="NL">🇳🇱 Netherlands</option>
            <option value="AU">🇦🇺 Australia</option>
            <option value="SG">🇸🇬 Singapore</option>
            <option value="JP">🇯🇵 Japan</option>
          </select>
        </FilterGroup>

        <FilterGroup label="Map Size">
          <select className="select" value={filters.mapSize} onChange={e => update('mapSize', e.target.value)}>
            <option value="all">Any Size</option>
            <option value="small">Small (≤2000)</option>
            <option value="medium">Medium (2001–3500)</option>
            <option value="large">Large (3501–4500)</option>
            <option value="xl">XL (4500+)</option>
          </select>
        </FilterGroup>

        <FilterGroup label="Min Players">
          <select className="select" value={filters.minPlayers} onChange={e => update('minPlayers', e.target.value)}>
            <option value="0">Any</option>
            <option value="10">10+</option>
            <option value="25">25+</option>
            <option value="50">50+</option>
            <option value="100">100+</option>
          </select>
        </FilterGroup>

        <button
          className="ml-auto btn-ghost text-xs"
          onClick={() => onChange(defaultFilters(mode))}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <label className="text-xs text-dark-300 font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

export function defaultFilters(mode = 'wiped') {
  return {
    hours:      mode === 'wiped' ? '24' : '48',
    serverType: 'all',
    country:    'all',
    mapSize:    'all',
    minPlayers: '0',
  };
}
