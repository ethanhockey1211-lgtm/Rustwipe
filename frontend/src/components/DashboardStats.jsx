import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DashboardStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    function load() {
      axios.get('/api/stats').then(({ data }) => setStats(data)).catch(() => {});
    }
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatCard
        icon="🖥️"
        value={stats?.totalServers?.toLocaleString()}
        label="Servers Tracked"
      />
      <StatCard
        icon="🔥"
        value={stats?.wipedToday?.toLocaleString()}
        label="Wiped Today"
        accent
      />
      <StatCard
        icon="📅"
        value={stats?.wipedThisWeek?.toLocaleString()}
        label="Wiped This Week"
      />
      <StatCard
        icon="🔄"
        value={
          stats?.lastUpdated
            ? new Date(stats.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : null
        }
        label="Last Refreshed"
      />
    </div>
  );
}

function StatCard({ icon, value, label, accent = false }) {
  return (
    <div className={`card p-3.5 flex items-center gap-3 ${accent ? 'border-rust-700/50' : ''}`}>
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0">
        <div className={`text-xl font-bold leading-none ${accent ? 'text-rust-400' : 'text-white'}`}>
          {value ?? <span className="text-dark-400 text-base">—</span>}
        </div>
        <div className="text-xs text-dark-300 mt-0.5">{label}</div>
      </div>
    </div>
  );
}
