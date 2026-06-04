"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"

export function GrowthInboxConversationThreadOps() {
  const {
    selectedThread,
    syncDetail,
    actionLoading,
    messageBody,
    messageDirection,
    setMessageBody,
    setMessageDirection,
    runAction,
    addMessage,
    assignOwner,
    resolveThread,
    archiveThread,
  } = useGrowthInboxWorkspace()
  const [open, setOpen] = useState(false)

  if (!selectedThread) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border/70 bg-muted/10">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/20">
        Thread operations
        <ChevronDown className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-4 pb-4">
        {syncDetail ? (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
            <p className="font-medium">Thread continuity</p>
            <p className="mt-1 text-muted-foreground">
              Provider {syncDetail.providerThreadId?.slice(0, 12) ?? "—"} · matched by {syncDetail.matchedBy ?? "—"} ·
              confidence {syncDetail.confidence}
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="workspace-message-direction">Direction</Label>
          <Select value={messageDirection} onValueChange={(value) => setMessageDirection(value as "inbound" | "outbound")}>
            <SelectTrigger id="workspace-message-direction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-message-body">Preview</Label>
          <Textarea
            id="workspace-message-body"
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            placeholder="Paste reply preview for deterministic classification…"
            rows={2}
          />
        </div>
        <Button type="button" variant="outline" size="sm" disabled={Boolean(actionLoading)} onClick={() => void runAction("add-message", addMessage)}>
          Add Message
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={Boolean(actionLoading)} onClick={() => void runAction("assign", assignOwner)}>
            Assign Owner
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={Boolean(actionLoading)} onClick={() => void runAction("resolve", resolveThread)}>
            Resolve
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={Boolean(actionLoading)} onClick={() => void runAction("archive", archiveThread)}>
            Archive
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
