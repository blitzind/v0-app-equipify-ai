"use client"

import { GrowthNativeDialer } from "@/components/growth/growth-native-dialer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GROWTH_CALL_WORKSPACE_PANEL, formatDisplayPhone } from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import { cn } from "@/lib/utils"

export function GrowthCallWorkspaceDialerCard({
  phone,
  onPhoneChange,
  onDial,
  disabled,
  loading,
  recentSessions,
}: {
  phone: string
  onPhoneChange: (value: string) => void
  onDial: () => void
  disabled?: boolean
  loading?: boolean
  recentSessions: NativeCallWorkspaceSessionPublicView[]
}) {
  return (
    <section className={cn(GROWTH_CALL_WORKSPACE_PANEL, "p-4")}>
      <Tabs defaultValue="dialer" className="gap-3">
        <TabsList className="grid h-9 w-full grid-cols-2">
          <TabsTrigger value="dialer">Dialer</TabsTrigger>
          <TabsTrigger value="recent">Recent Calls</TabsTrigger>
        </TabsList>

        <TabsContent value="dialer" className="mt-0">
          <GrowthNativeDialer
            phone={phone}
            onPhoneChange={onPhoneChange}
            onDial={onDial}
            disabled={disabled}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="recent" className="mt-0">
          {recentSessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No recent calls yet.</p>
          ) : (
            <ul className="max-h-[420px] space-y-1 overflow-auto pr-1">
              {recentSessions.slice(0, 12).map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm dark:border-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{session.companyName ?? session.contactName ?? "Unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDisplayPhone(session.phoneNumber)} · {session.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{session.durationSeconds}s</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
