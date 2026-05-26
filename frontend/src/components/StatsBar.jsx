import { formatDistanceToNow } from 'date-fns';

export default function StatsBar({ total, showing, label, lastUpdated }) {
  const agoStr = lastUpdated
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })
    : null;

  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm text-dark-300">
        <span className="text-white font-semibold">{showing.toLocaleString()}</span>
        {total != null && total !== showing && (
          <span className="text-dark-400"> of {total.toLocaleString()}</span>
        )}
        {' '}{label}
      </p>
      {agoStr && (
        <span className="text-xs text-dark-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block live-dot" />
          Updated {agoStr}
        </span>
      )}
    </div>
  );
}
