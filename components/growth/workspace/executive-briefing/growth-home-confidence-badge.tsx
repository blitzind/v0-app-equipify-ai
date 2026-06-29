"use client"

type Props = {
  percent: number | null | undefined
  label?: string | null
  className?: string
}

export function GrowthHomeConfidenceBadge({ percent, label, className = "" }: Props) {
  if (percent == null || !Number.isFinite(percent)) return null

  const tone =
    percent >= 85
      ? "text-emerald-700 dark:text-emerald-300"
      : percent >= 70
        ? "text-amber-700 dark:text-amber-300"
        : "text-rose-700 dark:text-rose-300"

  return (
    <span className={`inline-flex items-center gap-2 text-sm ${tone} ${className}`}>
      <span className="font-semibold tabular-nums">{percent}%</span>
      {label ? <span>{label}</span> : null}
    </span>
  )
}
