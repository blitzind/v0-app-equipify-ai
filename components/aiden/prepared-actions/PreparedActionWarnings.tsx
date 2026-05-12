"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function PreparedActionWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null
  return (
    <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
      <AlertTitle className="text-sm">Warnings</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
