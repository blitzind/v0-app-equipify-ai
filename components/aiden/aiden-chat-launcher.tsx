"use client"

import { useState } from "react"
import { Bot } from "lucide-react"
import { AidenChatPanel } from "@/components/aiden/aiden-chat-panel"
import { Button } from "@/components/ui/button"

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
      <AidenChatPanel open={open} onOpenChange={setOpen} />
    </>
  )
}
