import { useCountdown } from '../hooks/useCountdown.js';

export default function CountdownTimer({ targetDate, className = '', variant = 'inline' }) {
  const t = useCountdown(targetDate);

  if (!t) return <span className={`text-dark-300 text-sm ${className}`}>Calculating…</span>;
  if (t.expired) return <span className={`text-rust-400 font-bold text-sm ${className}`}>Wiped!</span>;

  if (variant === 'blocks') {
    return <BlockCountdown t={t} className={className} />;
  }

  const parts = [];
  if (t.days > 0)    parts.push(`${t.days}d`);
  if (t.hours > 0)   parts.push(`${t.hours}h`);
  if (t.minutes > 0) parts.push(`${t.minutes}m`);
  if (t.days === 0)  parts.push(`${String(t.seconds).padStart(2,'0')}s`);

  const urgency = t.days === 0 && t.hours < 2
    ? 'text-red-400'
    : t.days === 0 && t.hours < 6
      ? 'text-amber-400'
      : 'text-green-400';

  return (
    <span className={`font-mono font-bold text-sm tabular-nums ${urgency} ${className}`}>
      {parts.join(' ')}
    </span>
  );
}

function BlockCountdown({ t, className }) {
  const urgency = t.days === 0 && t.hours < 2 ? 'text-red-400'
    : t.days === 0 && t.hours < 6 ? 'text-amber-400'
    : 'text-gradient';

  const units = t.days > 0
    ? [{ v: t.days, l: 'Days' }, { v: t.hours, l: 'Hours' }, { v: t.minutes, l: 'Min' }, { v: t.seconds, l: 'Sec' }]
    : [{ v: t.hours, l: 'Hours' }, { v: t.minutes, l: 'Min' }, { v: t.seconds, l: 'Sec' }];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {units.map(({ v, l }, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className="text-dark-500 font-bold text-lg mb-2">:</span>}
          <div className="flex flex-col items-center w-10">
            <span className={`text-xl font-bold font-mono tabular-nums leading-none ${urgency}`}>
              {String(v).padStart(2, '0')}
            </span>
            <span className="text-[9px] text-dark-400 uppercase tracking-widest mt-0.5">{l}</span>
          </div>
        </span>
      ))}
    </div>
  );
}
