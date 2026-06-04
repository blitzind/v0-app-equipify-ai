"use client"

import { useEffect, useState } from "react"
import { useGrowthInboxQueue } from "@/components/growth/inbox/growth-inbox-queue-context"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const SHORTCUTS = [
  { keys: "J / K", action: "Next / previous thread in queue" },
  { keys: "Enter", action: "Open selected thread" },
  { keys: "A", action: "Assign owner" },
  { keys: "C", action: "Open call workspace" },
  { keys: "R", action: "Jump to reply drafting" },
  { keys: "T", action: "Create follow-up task" },
  { keys: "O", action: "Create opportunity" },
  { keys: "E", action: "Archive thread" },
  { keys: "/", action: "Focus thread search" },
  { keys: "?", action: "Show keyboard shortcuts" },
] as const

type GrowthInboxKeyboardWorkflowProps = {
  onAssign: () => void
  onArchive: () => void
  onCall: () => void
  onReply: () => void
  onCreateTask: () => void
  onCreateOpportunity: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable
}

export function GrowthInboxKeyboardWorkflow({
  onAssign,
  onArchive,
  onCall,
  onReply,
  onCreateTask,
  onCreateOpportunity,
}: GrowthInboxKeyboardWorkflowProps) {
  const { selectedThread } = useGrowthInboxWorkspace()
  const { selectAdjacentThread, focusSearch, visibleThreads, selectThreadByIndex } = useGrowthInboxQueue()
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === "?" && !isTypingTarget(event.target)) {
        event.preventDefault()
        setHelpOpen(true)
        return
      }

      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault()
        focusSearch()
        return
      }

      if (isTypingTarget(event.target)) return
      if (!selectedThread) return

      switch (event.key.toLowerCase()) {
        case "j":
          event.preventDefault()
          selectAdjacentThread("next")
          break
        case "k":
          event.preventDefault()
          selectAdjacentThread("prev")
          break
        case "enter": {
          event.preventDefault()
          const index = visibleThreads.findIndex((thread) => thread.id === selectedThread.id)
          if (index >= 0) selectThreadByIndex(index)
          break
        }
        case "a":
          event.preventDefault()
          onAssign()
          break
        case "c":
          event.preventDefault()
          onCall()
          break
        case "r":
          event.preventDefault()
          onReply()
          break
        case "t":
          event.preventDefault()
          onCreateTask()
          break
        case "o":
          event.preventDefault()
          onCreateOpportunity()
          break
        case "e":
          event.preventDefault()
          onArchive()
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    selectedThread,
    selectAdjacentThread,
    focusSearch,
    visibleThreads,
    selectThreadByIndex,
    onAssign,
    onArchive,
    onCall,
    onReply,
    onCreateTask,
    onCreateOpportunity,
  ])

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inbox keyboard shortcuts</DialogTitle>
          <DialogDescription>Human-driven workflow only — shortcuts navigate and trigger existing actions.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.keys} className="flex justify-between gap-4">
              <span className="font-mono text-xs font-semibold">{shortcut.keys}</span>
              <span className="text-muted-foreground">{shortcut.action}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
