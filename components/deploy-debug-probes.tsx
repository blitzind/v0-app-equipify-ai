"use client"

/**
 * Temporary deployment / source-of-truth probes.
 * Enable with NEXT_PUBLIC_AIDEN_LAUNCHER_DEBUG=true at build time (e.g. Vercel).
 * Remove this file and call sites after confirming production matches expected deployment.
 */

const SHOW = process.env.NEXT_PUBLIC_AIDEN_LAUNCHER_DEBUG === "true"

const GIT_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? ""
const VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV ?? ""

/** Banner + fixed inline-style button — proves (dashboard)/layout.tsx tree mounted and JS executed. */
export function AidenDeployLayoutProbe() {
  if (!SHOW) return null
  return (
    <>
      <div className="shrink-0 border-b-4 border-amber-500 bg-amber-300 px-3 py-2 text-center text-sm font-bold text-amber-950">
        AIden Debug Build Active
        {GIT_SHA ? ` · ${GIT_SHA.slice(0, 7)}` : " · sha unavailable"}
        {VERCEL_ENV ? ` · ${VERCEL_ENV}` : ""}
      </div>
      <button
        type="button"
        style={{
          position: "fixed",
          right: 24,
          bottom: 120,
          zIndex: 99999,
          background: "red",
          color: "white",
          padding: 16,
          border: "none",
          borderRadius: 8,
          cursor: "default",
          fontWeight: 700,
        }}
      >
        AIden Debug
      </button>
    </>
  )
}

/** Topbar marker — proves AppTopbar from PageShell is from same deployment as probes file. */
export function AidenDeployTopbarBadge() {
  if (!SHOW) return null
  return (
    <span className="hidden md:inline-flex shrink-0 max-w-[min(280px,40vw)] items-center truncate rounded-md border-2 border-fuchsia-700 bg-fuchsia-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-fuchsia-950">
      AIden Debug Build Active
      {GIT_SHA ? ` ${GIT_SHA.slice(0, 7)}` : ""}
    </span>
  )
}
