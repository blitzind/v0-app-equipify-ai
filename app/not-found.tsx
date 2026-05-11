import Link from "next/link"

import { Button } from "@/components/ui/button"
import { FAILURE_COPY } from "@/lib/failure-states/copy"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-16 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold tracking-tight text-balance">{FAILURE_COPY.notFoundTitle}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {FAILURE_COPY.notFoundDescription}
        </p>
      </div>
      <Button asChild>
        <Link href="/">{FAILURE_COPY.goDashboard}</Link>
      </Button>
    </div>
  )
}
