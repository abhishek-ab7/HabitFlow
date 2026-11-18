export default function FinanceLoading() {
  return (
    <div className="container max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="h-10 w-48 rounded-xl bg-muted/50 animate-pulse" />
      <div className="h-12 max-w-md rounded-2xl bg-muted/50 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 h-48 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="lg:col-span-7 h-72 rounded-2xl bg-muted/50 animate-pulse" />
      </div>
    </div>
  );
}
