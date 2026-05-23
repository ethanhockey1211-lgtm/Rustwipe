import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

const EMPTY_FORM = {
  name:       '',
  webhook_url: '',
  filters: {
    country:    'all',
    serverType: 'all',
    schedule:   'all',
    mapSize:    'all',
    gatherRate: 'all',
    teamMax:    'all',
    minPlayers: '0',
    maxCap:     'all',
  },
};

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

export default function Alerts() {
  const [subs, setSubs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(null);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  async function loadSubs() {
    try {
      const { data } = await axios.get('/api/subscriptions');
      setSubs(data.subscriptions || []);
    } catch { /* empty */ } finally { setLoading(false); }
  }

  useEffect(() => { loadSubs(); }, []);

  function updateFilter(key, value) {
    setForm(f => ({ ...f, filters: { ...f.filters, [key]: value } }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  function openEdit(sub) {
    setForm({ name: sub.name, webhook_url: sub.webhook_url, filters: { ...EMPTY_FORM.filters, ...sub.filters } });
    setEditId(sub.id);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editId) {
        await axios.patch(`/api/subscriptions/${editId}`, form);
        setSuccess('Alert updated!');
      } else {
        await axios.post('/api/subscriptions', form);
        setSuccess('Alert created! Wipe notifications will start on the next refresh cycle (≤5 min).');
      }
      setShowForm(false);
      setEditId(null);
      loadSubs();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete alert "${name}"?`)) return;
    await axios.delete(`/api/subscriptions/${id}`);
    loadSubs();
  }

  async function handleToggle(sub) {
    await axios.patch(`/api/subscriptions/${sub.id}`, { active: !sub.active });
    loadSubs();
  }

  async function handleTest(id) {
    setTesting(id);
    setError('');
    setSuccess('');
    try {
      await axios.post(`/api/subscriptions/${id}/test`);
      setSuccess('Test notification sent! Check your Discord channel.');
    } catch (err) {
      setError(err.response?.data?.error || 'Test failed — check your webhook URL');
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🔔 Discord Alerts</h1>
          <p className="text-dark-300 text-sm mt-1">
            Get notified in Discord when servers matching your filters wipe.
          </p>
        </div>
        {!showForm && (
          <button className="btn-primary" onClick={openCreate}>+ New Alert</button>
        )}
      </div>

      {/* Success / error banners */}
      {success && (
        <div className="mb-4 p-3 bg-green-900/40 border border-green-700/50 rounded-xl text-green-300 text-sm flex items-start gap-2">
          <span>✓</span> {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-700/50 rounded-xl text-red-300 text-sm flex items-start gap-2">
          <span>✕</span> {error}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card p-6 mb-6 space-y-5">
          <h2 className="text-lg font-bold text-white">{editId ? 'Edit Alert' : 'Create New Alert'}</h2>

          <div className="space-y-4">
            {/* Name */}
            <Field label="Alert Name">
              <input
                className="input w-full"
                placeholder="e.g. US Max5 Weekly"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </Field>

            {/* Webhook URL */}
            <Field
              label="Discord Webhook URL"
              hint={
                <a
                  href="https://support.discord.com/hc/en-us/articles/228383668"
                  target="_blank" rel="noopener noreferrer"
                  className="text-rust-400 hover:text-rust-300 text-xs"
                >
                  How to create a webhook →
                </a>
              }
            >
              <input
                className="input w-full font-mono text-xs"
                placeholder="https://discord.com/api/webhooks/..."
                value={form.webhook_url}
                onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                required
              />
            </Field>
          </div>

          {/* Filters */}
          <div>
            <h3 className="text-sm font-semibold text-dark-200 mb-3 uppercase tracking-wider">Filters</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

              <FilterSelect label="Region" value={form.filters.country} onChange={v => updateFilter('country', v)}>
                <option value="all">🌐 Any Region</option>
                <optgroup label="North America">
                  <option value="US">🇺🇸 United States</option>
                  <option value="CA">🇨🇦 Canada</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="GB">🇬🇧 UK</option>
                  <option value="DE">🇩🇪 Germany</option>
                  <option value="FR">🇫🇷 France</option>
                  <option value="NL">🇳🇱 Netherlands</option>
                  <option value="SE">🇸🇪 Sweden</option>
                  <option value="FI">🇫🇮 Finland</option>
                  <option value="PL">🇵🇱 Poland</option>
                  <option value="RU">🇷🇺 Russia</option>
                </optgroup>
                <optgroup label="Asia Pacific">
                  <option value="AU">🇦🇺 Australia</option>
                  <option value="SG">🇸🇬 Singapore</option>
                  <option value="JP">🇯🇵 Japan</option>
                  <option value="KR">🇰🇷 South Korea</option>
                </optgroup>
              </FilterSelect>

              <FilterSelect label="Team Max (Max5, etc.)" value={form.filters.teamMax} onChange={v => updateFilter('teamMax', v)}>
                <option value="all">Any team size</option>
                <option value="1">Solo only</option>
                <option value="2">Duo or less</option>
                <option value="3">Trio or less</option>
                <option value="4">Quad or less</option>
                <option value="5">Max 5</option>
                <option value="6">Max 6</option>
                <option value="8">Max 8</option>
                <option value="10">Max 10</option>
              </FilterSelect>

              <FilterSelect label="Server Type" value={form.filters.serverType} onChange={v => updateFilter('serverType', v)}>
                <option value="all">All Types</option>
                <option value="official">Official</option>
                <option value="vanilla">Vanilla</option>
                <option value="community">Community</option>
                <option value="modded">Modded</option>
              </FilterSelect>

              <FilterSelect label="Wipe Schedule" value={form.filters.schedule} onChange={v => updateFilter('schedule', v)}>
                <option value="all">Any Schedule</option>
                <option value="daily">Daily</option>
                <option value="3day">3-Day</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
              </FilterSelect>

              <FilterSelect label="Gather Rate" value={form.filters.gatherRate} onChange={v => updateFilter('gatherRate', v)}>
                <option value="all">Any Rate</option>
                <option value="vanilla">Vanilla (1x)</option>
                <option value="2x">2x</option>
                <option value="3x">3x</option>
                <option value="5x">5x</option>
                <option value="10x">10x+</option>
                <option value="modded">Any Modded</option>
              </FilterSelect>

              <FilterSelect label="Map Size" value={form.filters.mapSize} onChange={v => updateFilter('mapSize', v)}>
                <option value="all">Any Size</option>
                <option value="small">Small (≤ 2000)</option>
                <option value="medium">Medium (2001–3500)</option>
                <option value="large">Large (3501–4500)</option>
                <option value="xl">XL (4500+)</option>
              </FilterSelect>

              <FilterSelect label="Min Players at Wipe" value={form.filters.minPlayers} onChange={v => updateFilter('minPlayers', v)}>
                <option value="0">Any</option>
                <option value="10">10+ players</option>
                <option value="25">25+ players</option>
                <option value="50">50+ players</option>
                <option value="100">100+ players</option>
              </FilterSelect>

              <FilterSelect label="Max Server Cap" value={form.filters.maxCap} onChange={v => updateFilter('maxCap', v)}>
                <option value="all">Any cap</option>
                <option value="50">≤ 50 slots</option>
                <option value="100">≤ 100 slots</option>
                <option value="200">≤ 200 slots</option>
                <option value="500">≤ 500 slots</option>
              </FilterSelect>

            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Alert'}
            </button>
            <button type="button" className="btn-ghost border border-dark-500"
              onClick={() => { setShowForm(false); setEditId(null); setError(''); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Subscription list */}
      {loading ? (
        <div className="text-center py-16 text-dark-300">Loading alerts…</div>
      ) : subs.length === 0 && !showForm ? (
        <EmptyAlerts onNew={openCreate} />
      ) : (
        <div className="space-y-3">
          {subs.map(sub => (
            <SubCard
              key={sub.id}
              sub={sub}
              onEdit={() => openEdit(sub)}
              onDelete={() => handleDelete(sub.id, sub.name)}
              onToggle={() => handleToggle(sub)}
              onTest={() => handleTest(sub.id)}
              testing={testing === sub.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SubCard({ sub, onEdit, onDelete, onToggle, onTest, testing }) {
  const f = sub.filters || {};

  const filterChips = [
    f.country    && f.country    !== 'all' ? `${countryFlag(f.country)} ${f.country}` : null,
    f.teamMax    && f.teamMax    !== 'all' ? `Max ${f.teamMax} team` : null,
    f.serverType && f.serverType !== 'all' ? f.serverType : null,
    f.schedule   && f.schedule   !== 'all' ? f.schedule : null,
    f.gatherRate && f.gatherRate !== 'all' ? f.gatherRate : null,
    f.mapSize    && f.mapSize    !== 'all' ? f.mapSize + ' map' : null,
    f.minPlayers && f.minPlayers !== '0'   ? `${f.minPlayers}+ players` : null,
    f.maxCap     && f.maxCap     !== 'all' ? `≤${f.maxCap} cap` : null,
  ].filter(Boolean);

  return (
    <div className={`card p-4 transition-colors ${sub.active ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sub.active ? 'bg-green-500' : 'bg-dark-400'}`} />
            <h3 className="font-semibold text-white truncate">{sub.name}</h3>
          </div>

          {filterChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {filterChips.map(chip => (
                <span key={chip} className="badge bg-dark-500 text-dark-200 border border-dark-400">{chip}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-dark-400 mb-2">No filters — notifies on ALL wipes</p>
          )}

          <p className="text-xs text-dark-400">
            {sub.last_fired
              ? `Last fired ${formatDistanceToNow(new Date(sub.last_fired), { addSuffix: true })}`
              : 'Never fired yet'}
            {' · '}Created {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <button
            onClick={onTest}
            disabled={testing}
            className="btn-ghost text-xs border border-dark-500 py-1.5"
            title="Send a test notification to this webhook"
          >
            {testing ? '…' : '🧪 Test'}
          </button>
          <button onClick={onEdit}   className="btn-ghost text-xs border border-dark-500 py-1.5">Edit</button>
          <button onClick={onToggle} className={`btn-ghost text-xs border py-1.5 ${sub.active ? 'border-amber-700/50 text-amber-400' : 'border-green-700/50 text-green-400'}`}>
            {sub.active ? 'Pause' : 'Resume'}
          </button>
          <button onClick={onDelete} className="btn-ghost text-xs border border-red-700/50 text-red-400 py-1.5">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyAlerts({ onNew }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-4xl mb-3">🔔</p>
      <h3 className="text-lg font-semibold text-white mb-2">No alerts set up yet</h3>
      <p className="text-dark-300 text-sm mb-5 max-w-sm mx-auto">
        Create an alert to get Discord notifications when Rust servers matching your filters wipe.
        Great for finding fresh Max5 or Solo/Duo servers the moment they wipe.
      </p>

      <div className="bg-dark-700 rounded-xl p-4 text-left mb-5 max-w-md mx-auto">
        <p className="text-sm font-semibold text-white mb-2">How to set up Discord notifications:</p>
        <ol className="text-xs text-dark-300 space-y-1.5 list-decimal list-inside">
          <li>Open your Discord server → Server Settings</li>
          <li>Go to <span className="text-white">Integrations → Webhooks → New Webhook</span></li>
          <li>Choose the channel for wipe notifications</li>
          <li>Click <span className="text-white">Copy Webhook URL</span></li>
          <li>Paste it here and set your filters</li>
        </ol>
      </div>

      <button className="btn-primary" onClick={onNew}>+ Create First Alert</button>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-dark-200 uppercase tracking-wider">{label}</label>
        {hint}
      </div>
      {children}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <div>
      <label className="text-xs text-dark-300 font-medium block mb-1">{label}</label>
      <select className="select w-full" value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}
