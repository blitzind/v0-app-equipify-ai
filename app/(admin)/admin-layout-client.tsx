"use client"

import type { ReactNode } from "react"

/** Reserved for client-only admin shell wiring; layout composes children directly. */
export function AdminLayoutClient({ children }: { children: ReactNode }) {
  return <>{children}</>
}
