export default function StatsBar({ total, showing, label, lastUpdated }) {
  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-dark-200">
          Showing <span className="text-white font-semibold">{showing}</span>
          {total != null && total !== showing && (
            <> of <span className="text-white font-semibold">{total}</span></>
          )}{' '}
          {label}
        </span>
      </div>
      {updatedStr && (
        <span className="text-xs text-dark-400">Updated {updatedStr}</span>
      )}
    </div>
  );
}
