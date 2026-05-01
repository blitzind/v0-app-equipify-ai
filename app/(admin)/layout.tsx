"use client"

import { AdminProvider } from "@/lib/admin-store"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    </AdminProvider>
  )
}
