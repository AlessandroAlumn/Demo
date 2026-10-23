// Shown while a page's data loads (pages can take a moment right after a big time jump).
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" role="status">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-100" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
      </div>
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-gray-100" />
    </div>
  );
}
