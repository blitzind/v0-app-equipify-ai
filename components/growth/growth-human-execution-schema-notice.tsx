"use client"

type GrowthHumanExecutionSchemaMeta = {
  schemaReady?: boolean
  probeUncertain?: boolean
  failureReason?: string | null
  setupMessage?: string
  envHint?: string | null
  supabaseProjectRef?: string | null
}

export function GrowthHumanExecutionSchemaNotice({
  meta,
  className,
}: {
  meta: GrowthHumanExecutionSchemaMeta
  className?: string
}) {
  const message = meta.setupMessage?.trim()
  if (!message) return null

  const isWarning = meta.schemaReady === true && meta.probeUncertain
  const boxClass = isWarning
    ? "border-amber-200 bg-amber-50/80 text-amber-950"
    : "border-destructive/30 bg-destructive/5 text-destructive"

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${boxClass} ${className ?? ""}`}>
      <p>{message}</p>
      {meta.envHint?.trim() && !message.includes(meta.envHint.trim()) ? (
        <p className="mt-1 text-xs opacity-90">{meta.envHint}</p>
      ) : null}
      {meta.supabaseProjectRef ? (
        <p className="mt-1 text-xs opacity-75">Supabase project: {meta.supabaseProjectRef}</p>
      ) : null}
    </div>
  )
}

export type { GrowthHumanExecutionSchemaMeta }
