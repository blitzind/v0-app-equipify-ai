"use client"

type Props = {
  percent: number
  label?: string
  className?: string
}

export function GrowthHomeProgressBar({ percent, label, className }: Props) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div className={className}>
      {label ? <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
