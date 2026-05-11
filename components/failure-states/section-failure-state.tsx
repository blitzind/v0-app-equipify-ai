"use client"

import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FAILURE_COPY } from "@/lib/failure-states/copy"
import { cn } from "@/lib/utils"

export function SectionFailureState({
  title = FAILURE_COPY.loadData,
  description,
  onRetry,
  retryLabel = FAILURE_COPY.retryAction,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <Empty
      role="alert"
      className={cn(
        "min-h-0 flex-none border border-destructive/25 bg-destructive/5 py-8",
        className,
      )}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </Empty>
  )
}
