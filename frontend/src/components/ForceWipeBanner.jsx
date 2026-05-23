import { useEffect, useState } from 'react';
import axios from 'axios';
import { useCountdown } from '../hooks/useCountdown.js';
import { format } from 'date-fns';

export default function ForceWipeBanner() {
  const [forceWipeDate, setForceWipeDate] = useState(null);
  const countdown = useCountdown(forceWipeDate);

  useEffect(() => {
    axios.get('/api/stats').then(({ data }) => {
      setForceWipeDate(data.nextForceWipe);
    }).catch(() => {});
  }, []);

  if (!countdown || countdown.expired) return null;

  const { days, hours, minutes, seconds } = countdown;

  return (
    <div className="bg-gradient-to-r from-dark-700 via-dark-600 to-dark-700 border-b border-rust-700/30">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="text-rust-500 text-lg">⚡</span>
          <span className="text-sm font-bold text-white uppercase tracking-widest">Force Wipe</span>
        </div>

        <div className="flex items-center gap-2">
          <TimeUnit value={days}    label="Days"    />
          <Colon />
          <TimeUnit value={hours}   label="Hours"   />
          <Colon />
          <TimeUnit value={minutes} label="Min"     />
          <Colon />
          <TimeUnit value={seconds} label="Sec"     />
        </div>

        {forceWipeDate && (
          <span className="text-xs text-dark-300 hidden sm:block">
            {format(new Date(forceWipeDate), 'MMM d, yyyy · h:mm a z')}
          </span>
        )}
      </div>
    </div>
  );
}

function TimeUnit({ value, label }) {
  return (
    <div className="flex flex-col items-center w-12">
      <span className="text-xl font-bold font-mono text-gradient tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] text-dark-300 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function Colon() {
  return <span className="text-rust-600 font-bold text-lg mb-3">:</span>;
}
