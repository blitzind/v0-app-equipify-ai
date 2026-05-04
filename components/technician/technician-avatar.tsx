"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const SIZE_CLASSES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "w-10 h-10 text-[13px]",
  lg: "w-14 h-14 text-base",
} as const

type Props = {
  userId: string
  name: string
  initials: string
  avatarUrl?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

/** Circular technician avatar: photo when `avatarUrl` is set, else colored initials (matches Technicians list). */
export function TechnicianAvatar({
  userId,
  name,
  initials,
  avatarUrl,
  size = "md",
  className,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  useEffect(() => {
    setImgFailed(false)
  }, [avatarUrl, userId])

  const sz = SIZE_CLASSES[size]
  const ring = "ring-2 ring-background shrink-0 select-none"

  const AVATAR_COLORS = [
    "bg-[oklch(0.48_0.18_245)]",
    "bg-[oklch(0.44_0.16_160)]",
    "bg-[oklch(0.52_0.20_290)]",
    "bg-[oklch(0.47_0.20_25)]",
    "bg-[oklch(0.50_0.18_55)]",
    "bg-primary",
  ]
  function avatarColor(id: string) {
    const match = id.match(/(\d+)$/)
    const idx = match ? parseInt(match[1], 10) - 1 : id.charCodeAt(0)
    return AVATAR_COLORS[Math.abs(idx) % AVATAR_COLORS.length]
  }

  if (avatarUrl?.trim() && !imgFailed) {
    return (
      <span
        className={cn("relative inline-block overflow-hidden rounded-full", sz, ring, className)}
        aria-label={name}
      >
        <Image
          src={avatarUrl}
          alt=""
          fill
          className="object-cover"
          sizes={
            size === "lg" ? "56px" : size === "sm" ? "32px" : size === "xs" ? "24px" : "40px"
          }
          unoptimized
          onError={() => setImgFailed(true)}
        />
      </span>
    )
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white",
        avatarColor(userId),
        sz,
        ring,
        className,
      )}
      aria-label={name}
    >
      {initials}
    </div>
  )
}
