"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function SaveSearchWorkflowDialog({
  open,
  onOpenChange,
  defaultName,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  onSave: (input: { name: string; savePagination: boolean }) => void
  saving?: boolean
}) {
  const [name, setName] = useState(defaultName)
  const [savePagination, setSavePagination] = useState(false)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setSavePagination(false)
    }
  }, [open, defaultName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save search workflow</DialogTitle>
          <DialogDescription>
            Persist filters and search text for one-click restore. Counts refresh from the materialized index.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="saved-search-name">Workflow name</Label>
            <Input
              id="saved-search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Medical Southeast"
              maxLength={120}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={savePagination} onCheckedChange={(v) => setSavePagination(v === true)} />
            Also restore pagination (page + page size)
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onSave({ name: name.trim() || "Saved search", savePagination })}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving…" : "Save workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
