"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Bot } from "lucide-react"
import { Button } from "@/components/ui/button"

const AidenChatPanel = dynamic(
  () => import("@/components/aiden/aiden-chat-panel").then((mod) => mod.AidenChatPanel),
  { ssr: false },
)

export function AidenChatLauncher() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40">
        <Button
          type="button"
          size="sm"
          className="h-10 rounded-full px-4 shadow-lg"
          onClick={() => setOpen(true)}
        >
          <Bot size={16} />
          Ask AIden
        </Button>
      </div>
      {open ? <AidenChatPanel open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
