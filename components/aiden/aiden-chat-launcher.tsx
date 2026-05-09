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

/** Floating launcher — not tied to sidebar/RBAC; visible whenever the dashboard shell renders. */
export function AidenChatLauncher() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-11 rounded-full border border-border px-3 shadow-lg gap-2 bg-card hover:bg-muted/80"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <MessageCircle className="size-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden />
          <span className="flex items-center gap-0 text-sm font-medium">
            Ask <AidenWordmark size="sm" />
          </span>
        </Button>
      </div>
      {open ? <AidenChatPanel open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
