import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import ForceWipeBanner from './components/ForceWipeBanner.jsx';
import JustWiped from './pages/JustWiped.jsx';
import UpcomingWipes from './pages/UpcomingWipes.jsx';
import Alerts from './pages/Alerts.jsx';
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
            <Route path="/server/:id"   element={<ServerDetail />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="border-t border-dark-600 py-4 text-center text-dark-400 text-xs">
          RustWipe · Data from{' '}
          <a href="https://www.battlemetrics.com" target="_blank" rel="noopener noreferrer"
            className="text-rust-500 hover:text-rust-400">BattleMetrics</a>
          {' '}· Auto-refreshes every 5 min · Force wipe = first Thursday each month
        </footer>
      </div>
    </BrowserRouter>
  );
}
