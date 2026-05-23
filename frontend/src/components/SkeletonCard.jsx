export default function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-2 bg-dark-500 rounded-none" />
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-dark-500 rounded w-5/6" />
            <div className="h-3 bg-dark-500 rounded w-3/4" />
          </div>
          <div className="h-6 w-6 bg-dark-500 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-dark-500 rounded-full" />
          <div className="h-5 w-14 bg-dark-500 rounded-full" />
          <div className="h-5 w-14 bg-dark-500 rounded-full" />
        </div>
        <div className="h-1.5 bg-dark-500 rounded-full w-full" />
        <div className="h-10 bg-dark-500 rounded" />
        <div className="flex gap-2 pt-1">
          <div className="flex-1 h-7 bg-dark-500 rounded-lg" />
          <div className="w-8 h-7 bg-dark-500 rounded-lg" />
          <div className="w-8 h-7 bg-dark-500 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 12 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
