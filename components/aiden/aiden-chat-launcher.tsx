"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Sparkles } from "lucide-react"
import { AidenWordmark } from "@/components/aiden/aiden-wordmark"
import { cn } from "@/lib/utils"

const AidenChatPanel = dynamic(
  () => import("@/components/aiden/aiden-chat-panel").then((mod) => mod.AidenChatPanel),
  { ssr: false },
)

/** Floating launcher — not tied to sidebar/RBAC; does not depend on org loading or plan. */
export function AidenChatLauncher() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/*
        z-[95]: above mobile bottom nav (z-[80]/[91]), below Sheet/drawer stacks (z-[100]+).
        bottom-24 on small screens clears the fixed nav + FAB (matches PageShell pb-24); lg+ uses compact inset.
        If you change offsets or button height, update `--aiden-launcher-*` in app/globals.css (Phase 56.6).
        Layout imports this module statically so production never depends on a separate dynamic chunk for the button.
      */}
      <div className="pointer-events-auto fixed bottom-24 right-4 z-[95] sm:right-5 lg:bottom-6 lg:right-6">
        <button
          type="button"
          className={cn(
            "group relative inline-flex h-12 shrink-0 items-center gap-2 rounded-full pl-3 pr-4",
            "bg-gradient-to-br from-sky-500 via-[color:var(--primary)] to-blue-700",
            "text-white shadow-lg",
            "border border-white/25",
            "ring-2 ring-sky-400/55 ring-offset-2 ring-offset-background",
            "shadow-[0_4px_22px_-4px_rgba(14,165,233,0.65),0_2px_12px_-2px_rgba(37,99,235,0.45),0_0_36px_-8px_rgba(56,189,248,0.55)]",
            "transition-all duration-200 hover:brightness-[1.06] hover:shadow-[0_6px_28px_-4px_rgba(14,165,233,0.72),0_4px_16px_-2px_rgba(37,99,235,0.5),0_0_44px_-6px_rgba(56,189,248,0.6)]",
            "active:scale-[0.97] active:brightness-[0.98]",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--primary)]",
          )}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Ask AIden — open Equipify help assistant"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/35 backdrop-blur-[2px] transition-colors group-hover:bg-white/22">
            <Sparkles className="size-[18px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" aria-hidden strokeWidth={2} />
          </span>
          <span className="flex items-baseline gap-1 pr-0.5 text-[15px] font-medium leading-none tracking-tight text-white drop-shadow-sm">
            Ask <AidenWordmark size="sm" tone="inverse" className="text-[15px]" />
          </span>
        </button>
      </div>
      {open ? <AidenChatPanel open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
