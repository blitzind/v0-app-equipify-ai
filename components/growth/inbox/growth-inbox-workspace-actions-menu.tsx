"use client"

import { useState } from "react"
import { MoreHorizontal, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"

/** Infrequent operator action — kept out of the primary workspace flow. */
export function GrowthInboxWorkspaceActionsMenu() {
  const {
    actionLoading,
    leads,
    newLeadId,
    newSubject,
    setNewLeadId,
    setNewSubject,
    runAction,
    createThread,
  } = useGrowthInboxWorkspace()
  const [createOpen, setCreateOpen] = useState(false)

  async function handleCreateThread() {
    await runAction("create-thread", createThread, "none")
    setCreateOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={Boolean(actionLoading)}>
            <MoreHorizontal className="mr-1.5 size-3.5" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-3.5" />
            Create thread
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create thread</DialogTitle>
            <DialogDescription>
              Manually start a thread for a lead. Most threads arrive from inbound sync or sequences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-actions-inbox-lead">Lead</Label>
              <Select value={newLeadId} onValueChange={setNewLeadId}>
                <SelectTrigger id="workspace-actions-inbox-lead">
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-actions-inbox-subject">Subject</Label>
              <Input
                id="workspace-actions-inbox-subject"
                value={newSubject}
                onChange={(event) => setNewSubject(event.target.value)}
                placeholder="Re: follow-up"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!newLeadId || Boolean(actionLoading)} onClick={() => void handleCreateThread()}>
              <Plus className="mr-1.5 size-3.5" />
              Create thread
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
