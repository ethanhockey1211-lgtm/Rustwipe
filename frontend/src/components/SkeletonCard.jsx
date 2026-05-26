export default function SkeletonCard() {
  return (
    <div className="card animate-pulse overflow-hidden">
      <div className="h-2 bg-dark-500" />
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-dark-600 rounded w-5/6" />
            <div className="h-3 bg-dark-600 rounded w-2/3" />
          </div>
          <div className="h-6 w-6 bg-dark-600 rounded" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 w-20 bg-dark-600 rounded-full" />
          <div className="h-5 w-14 bg-dark-600 rounded-full" />
          <div className="h-5 w-10 bg-dark-600 rounded-full" />
        </div>
        <div className="h-1.5 bg-dark-600 rounded-full" />
        <div className="h-px bg-dark-500" />
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-2.5 w-12 bg-dark-600 rounded" />
            <div className="h-4 w-20 bg-dark-600 rounded" />
          </div>
          <div className="space-y-1 text-right">
            <div className="h-3 w-24 bg-dark-600 rounded ml-auto" />
            <div className="h-2.5 w-16 bg-dark-600 rounded ml-auto" />
          </div>
        </div>
        <div className="flex gap-1.5 pt-1">
          <div className="flex-1 h-7 bg-dark-600 rounded-lg" />
          <div className="w-8 h-7 bg-dark-600 rounded-lg" />
          <div className="w-8 h-7 bg-dark-600 rounded-lg" />
          <div className="w-10 h-7 bg-dark-600 rounded-lg" />
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
