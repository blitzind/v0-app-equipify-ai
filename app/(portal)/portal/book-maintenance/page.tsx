"use client"

import Link from "next/link"
import { Calendar } from "lucide-react"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { cn } from "@/lib/utils"

export default function BookMaintenancePage() {
  return (
    <div className="max-w-lg mx-auto pt-12 text-center">
      <div className="portal-card p-10">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-6"
          style={{ background: "var(--portal-accent-muted)" }}
        >
          <Calendar size={32} style={{ color: "var(--portal-accent)" }} />
        </div>
        <h1 className={cn(PAGE_STANDARD_PAGE_TITLE, "mb-2")} style={{ color: "var(--portal-foreground)" }}>
          Appointments are confirmed by your service provider
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--portal-nav-text)" }}>
          You can view confirmed service visits and completed work here. To request a new visit, submit a service
          request and the team will follow up with scheduling details.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/portal/work-orders" className="portal-btn-secondary flex-1 justify-center">
            View Service Visits
          </Link>
          <Link href="/portal/request-repair" className="portal-btn-primary flex-1 justify-center">
            Request Service
          </Link>
        </div>
      </div>
    </div>
  )
}
