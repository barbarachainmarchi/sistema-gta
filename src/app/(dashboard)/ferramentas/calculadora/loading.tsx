export default function Loading() {
  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden animate-pulse">

      {/* Col 1: lista */}
      <aside className="w-[380px] shrink-0 flex flex-col border-r border-border">
        <div className="px-2 pt-2 pb-1.5 border-b border-border space-y-1.5">
          <div className="h-8 rounded bg-white/[0.05]" />
          <div className="flex gap-1">
            {[80, 60, 72, 55].map((w, i) => (
              <div key={i} className="h-5 rounded-full bg-white/[0.04]" style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="flex border-b border-border shrink-0">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-8 bg-white/[0.02]" />
          ))}
        </div>
        <div className="flex-1 overflow-hidden space-y-px pt-1 px-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="h-[42px] rounded bg-white/[0.03]" />
          ))}
        </div>
      </aside>

      {/* Col 2: orçamento */}
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-border bg-white/[0.01]" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-primary/20 border-t-primary/60 animate-spin" />
          <div className="h-3 w-32 rounded bg-white/[0.04]" />
        </div>
      </div>

      {/* Col 3: resumo */}
      <div className="w-[288px] shrink-0 border-l border-border flex flex-col">
        <div className="h-11 border-b border-border bg-white/[0.01]" />
        <div className="flex-1 p-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-white/[0.03]" style={{ width: `${65 + (i % 3) * 15}%` }} />
          ))}
        </div>
      </div>

    </div>
  )
}
