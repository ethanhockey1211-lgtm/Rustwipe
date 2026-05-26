import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import ForceWipeBanner from './components/ForceWipeBanner.jsx';
import JustWiped from './pages/JustWiped.jsx';
import UpcomingWipes from './pages/UpcomingWipes.jsx';
import Alerts from './pages/Alerts.jsx';
import Feed from './pages/Feed.jsx';
import ServerDetail from './pages/ServerDetail.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-dark-800 flex flex-col">
        <Header />
        <ForceWipeBanner />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          <Routes>
            <Route path="/"             element={<JustWiped />} />
            <Route path="/upcoming"     element={<UpcomingWipes />} />
            <Route path="/alerts"       element={<Alerts />} />
            <Route path="/feed"         element={<Feed />} />
            <Route path="/server/:id"   element={<ServerDetail />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="border-t border-dark-600/80 py-5 text-center text-dark-400 text-xs space-y-1">
          <div>
            <span className="text-white font-semibold">RustWipe</span>
            {' · '}Server data from{' '}
            <a href="https://www.battlemetrics.com" target="_blank" rel="noopener noreferrer"
              className="text-rust-500 hover:text-rust-400 transition-colors">BattleMetrics</a>
            {' · '}Refreshes every 5 min
          </div>
          <div className="text-dark-500">
            ⚡ Monthly wipe times are exact — Facepunch force wipes every first Thursday of the month at 2 PM ET / 19:00 UTC
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
