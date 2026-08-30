export default function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-5 w-48 rounded bg-gray-800" />
        <div className="h-3 w-64 rounded bg-gray-800/70" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={`metric-${idx}`} className="h-32 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`card-${idx}`} className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>

      <div className="h-60 rounded-lg bg-gray-900 border border-gray-800" />
    </div>
  );
}
