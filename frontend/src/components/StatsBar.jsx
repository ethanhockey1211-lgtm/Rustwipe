export default function StatsBar({ total, showing, label, lastUpdated }) {
  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm text-dark-300">
        Showing{' '}
        <span className="text-white font-semibold">{showing.toLocaleString()}</span>
        {total != null && total !== showing && (
          <> of <span className="text-white font-semibold">{total.toLocaleString()}</span></>
        )}
        {' '}{label}
      </p>
      {updatedStr && (
        <span className="text-xs text-dark-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Live · {updatedStr}
        </span>
      )}
    </div>
  );
}
