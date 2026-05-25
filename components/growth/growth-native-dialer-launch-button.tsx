"use client"

import Link from "next/link"
import { Headphones } from "lucide-react"
import { Button } from "@/components/ui/button"
import { nativeCallWorkspaceHref } from "@/lib/growth/native-dialer/native-dialer-navigation"

export function GrowthNativeDialerLaunchButton({
  leadId,
  phone,
  label = "Call workspace",
  size = "sm",
  variant = "outline",
  iconOnly = false,
}: {
  leadId: string
  phone?: string | null
  label?: string
  size?: "sm" | "default" | "lg"
  variant?: "default" | "outline" | "ghost" | "secondary"
  iconOnly?: boolean
}) {
  return (
    <Button asChild size={size} variant={variant} className={iconOnly ? "h-8 px-2" : undefined}>
      <Link href={nativeCallWorkspaceHref({ leadId, phone })}>
        <Headphones className={iconOnly ? "size-3.5" : "mr-2 size-4"} />
        {iconOnly ? <span className="sr-only">{label || "Call workspace"}</span> : label}
      </Link>
    </Button>
  )
}
