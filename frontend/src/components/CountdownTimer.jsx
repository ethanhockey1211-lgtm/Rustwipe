import { useCountdown } from '../hooks/useCountdown.js';

export default function CountdownTimer({ targetDate, className = '' }) {
  const t = useCountdown(targetDate);

  if (!t) return <span className={`text-dark-300 text-sm ${className}`}>Calculating…</span>;
  if (t.expired) return <span className={`text-rust-400 font-bold text-sm ${className}`}>Wiped!</span>;

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
