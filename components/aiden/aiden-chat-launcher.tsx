"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { AidenWordmark } from "@/components/aiden/aiden-wordmark"
import { Button } from "@/components/ui/button"

const AidenChatPanel = dynamic(
  () => import("@/components/aiden/aiden-chat-panel").then((mod) => mod.AidenChatPanel),
  { ssr: false },
)

/** Build-time flag: set NEXT_PUBLIC_AIDEN_LAUNCHER_DEBUG=true to verify dashboard layout render path in prod. */
const LAUNCHER_DEBUG = process.env.NEXT_PUBLIC_AIDEN_LAUNCHER_DEBUG === "true"

/** Floating launcher — not tied to sidebar/RBAC; does not depend on org loading or plan. */
export function AidenChatLauncher() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {LAUNCHER_DEBUG ? (
        <button
          type="button"
          className="fixed bottom-24 right-6 z-[9999] rounded-md bg-red-500 p-4 font-medium text-white shadow-lg"
          aria-label="AIden launcher layout probe (NEXT_PUBLIC_AIDEN_LAUNCHER_DEBUG)"
        >
          AIden Test
        </button>
      ) : null}
      {/*
        z-[95]: above mobile bottom nav (z-[80]/[91]), below Sheet/drawer stacks (z-[100]+).
        bottom-24 on small screens clears the fixed nav + FAB (matches PageShell pb-24); lg+ uses compact inset.
        Layout imports this module statically so production never depends on a separate dynamic chunk for the button.
      */}
      <div className="pointer-events-auto fixed bottom-24 right-4 z-[95] sm:right-5 lg:bottom-6 lg:right-6">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-11 rounded-full border-2 border-sky-500/40 bg-card px-3 shadow-xl gap-2 text-foreground ring-2 ring-sky-500/15 ring-offset-2 ring-offset-background hover:bg-muted/90 hover:border-sky-500/55 dark:border-sky-400/45 dark:ring-sky-400/20"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <MessageCircle className="size-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden />
          <span className="flex items-center gap-0 text-sm font-medium text-foreground">
            Ask <AidenWordmark size="sm" />
          </span>
        </Button>
      </div>
      {open ? <AidenChatPanel open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
