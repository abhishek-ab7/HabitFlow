export default function FinanceLoading() {
  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="h-12 w-72 rounded-xl bg-muted/50 animate-pulse" />
      <div className="h-20 w-full rounded-xl bg-muted/50 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
      <div className="h-96 w-full rounded-xl bg-muted/50 animate-pulse" />
    </div>
  );
}
