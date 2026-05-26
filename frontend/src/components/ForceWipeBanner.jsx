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
  const isImminent = days === 0 && hours < 6;
  const isVeryClose = days === 0 && hours < 1;

  return (
    <div className={`border-b transition-colors ${
      isVeryClose
        ? 'bg-gradient-to-r from-rust-900/80 via-rust-800/60 to-rust-900/80 border-rust-600/60'
        : isImminent
          ? 'bg-gradient-to-r from-rust-900/60 via-dark-700 to-rust-900/60 border-rust-700/40'
          : 'bg-gradient-to-r from-dark-700 via-dark-600 to-dark-700 border-dark-500/60'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-8">

        {/* Label */}
        <div className="flex items-center gap-2">
          <span className={`text-lg ${isImminent ? 'animate-pulse' : ''}`}>⚡</span>
          <div className="text-center sm:text-left">
            <span className="text-xs font-bold text-white uppercase tracking-widest">Facepunch Force Wipe</span>
            {forceWipeDate && (
              <span className="hidden sm:inline text-xs text-dark-300 ml-2">
                · {format(new Date(forceWipeDate), 'MMMM d, yyyy')}
              </span>
            )}
          </div>
        </div>

        {/* Countdown units */}
        <div className="flex items-center gap-1.5">
          <TimeUnit value={days}    label="Days"  dim={days === 0} />
          <Sep />
          <TimeUnit value={hours}   label="Hours" dim={days === 0 && hours === 0} />
          <Sep />
          <TimeUnit value={minutes} label="Min"   dim={false} />
          <Sep />
          <TimeUnit value={seconds} label="Sec"   dim={false} />
        </div>

        {/* Time hint on mobile */}
        {forceWipeDate && (
          <span className="text-[11px] text-dark-300 sm:hidden">
            {format(new Date(forceWipeDate), 'MMM d · h:mm a')}
          </span>
        )}

      </div>
    </div>
  );
}

function TimeUnit({ value, label, dim }) {
  return (
    <div className="flex flex-col items-center w-11">
      <span className={`text-lg font-bold font-mono tabular-nums leading-none ${dim ? 'text-dark-400' : 'text-gradient'}`}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] text-dark-400 uppercase tracking-widest mt-0.5">{label}</span>
    </div>
  );
}

function Sep() {
  return <span className="text-rust-700 font-bold text-base mb-3 select-none">:</span>;
}
