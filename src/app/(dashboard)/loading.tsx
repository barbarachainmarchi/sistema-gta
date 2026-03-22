export default function Loading() {
  return (
    <div className="flex-1 p-6 space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-48 rounded-md bg-white/[0.06]" />
      <div className="h-4 w-72 rounded bg-white/[0.04]" />
      <div className="h-px bg-border mt-4" />
      {/* Content skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-8 w-full rounded-md bg-white/[0.04]" />
        <div className="h-8 w-full rounded-md bg-white/[0.04]" />
        <div className="h-8 w-3/4 rounded-md bg-white/[0.04]" />
      </div>
    </div>
  )
}
