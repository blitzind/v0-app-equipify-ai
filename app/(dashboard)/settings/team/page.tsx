"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { useTenant } from "@/lib/tenant-store"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  UserPlus, MoreHorizontal, Check, X, Mail, Shield,
  UserX, RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_INACTIVE_HOVER_CARD,
} from "@/lib/navigation-chrome"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Toaster } from "@/components/ui/toaster"
import { toast as pushToast } from "@/hooks/use-toast"
import { MEMBERSHIP_ROLES, type MembershipRole } from "@/lib/team/membership"

// ─── Role definitions (DB roles) ──────────────────────────────────────────────

const ROLE_LABEL: Record<MembershipRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  tech: "Technician",
  viewer: "Viewer",
}

const ROLE_META: Record<MembershipRole, { color: string; bg: string; desc: string }> = {
  owner: { color: "#7c3aed", bg: "#f5f3ff", desc: "Full control over workspace, billing, and all settings." },
  admin: { color: "#1d4ed8", bg: "#eff6ff", desc: "Manages team, settings, and operations. Cannot manage owners." },
  manager: { color: "#0369a1", bg: "#f0f9ff", desc: "Creates and assigns work orders, schedules technicians." },
  tech: { color: "#b45309", bg: "#fffbeb", desc: "Views and updates assigned work orders and equipment." },
  viewer: { color: "#6b7280", bg: "#f9fafb", desc: "View-only access across the workspace." },
}

const INVITE_ROLES: { value: MembershipRole; label: string }[] = [
  { value: "admin", label: ROLE_LABEL.admin },
  { value: "manager", label: ROLE_LABEL.manager },
  { value: "tech", label: ROLE_LABEL.tech },
  { value: "viewer", label: ROLE_LABEL.viewer },
]

type TeamMemberRow = {
  userId: string
  role: string
  status: string
  createdAt: string
  updatedAt: string | null
  invitedBy: string | null
  email: string | null
  fullName: string | null
  avatarUrl: string | null
}

type PendingInviteRow = {
  id: string
  email: string
  role: string
  expiresAt: string
  createdAt: string
}

function isMembershipRoleString(r: string): r is MembershipRole {
  return (MEMBERSHIP_ROLES as readonly string[]).includes(r)
}

function displayName(m: TeamMemberRow): string {
  const n = m.fullName?.trim()
  if (n) return n
  const e = m.email?.trim()
  if (e) return e.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return "Member"
}

function initials(m: TeamMemberRow): string {
  const base = m.fullName?.trim() || m.email?.trim() || "?"
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
  }
  return base.slice(0, 2).toUpperCase()
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const r = isMembershipRoleString(role) ? role : "viewer"
  const label = ROLE_LABEL[r]
  const { color, bg } = ROLE_META[r]
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    active: { color: "#15803d", bg: "#f0fdf4", label: "Active" },
    invited: { color: "#b45309", bg: "#fffbeb", label: "Invited" },
    suspended: { color: "#6b7280", bg: "#f3f4f6", label: "Suspended" },
  }
  const s = map[status] ?? { color: "#6b7280", bg: "#f3f4f6", label: status }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { plan } = useTenant()
  const { organizationId } = useActiveOrganization()

  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInviteRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [canManageTeam, setCanManageTeam] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<MembershipRole>("tech")
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const [removeTarget, setRemoveTarget] = useState<TeamMemberRow | null>(null)
  const [removeSubmitting, setRemoveSubmitting] = useState(false)

  const loadTeam = useCallback(async () => {
    if (!organizationId) {
      setMembers([])
      setPendingInvites([])
      setLoading(false)
      return
    }
    setLoadError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/team/members?organizationId=${encodeURIComponent(organizationId)}`)
      const data = (await res.json()) as {
        error?: string
        message?: string
        members?: TeamMemberRow[]
        pendingInvites?: PendingInviteRow[]
        currentUserId?: string
        currentUserRole?: string | null
        canManageTeam?: boolean
      }
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Could not load team.")
      }
      setMembers(data.members ?? [])
      setPendingInvites(data.pendingInvites ?? [])
      setCurrentUserId(data.currentUserId ?? null)
      setCurrentUserRole(data.currentUserRole ?? null)
      setCanManageTeam(Boolean(data.canManageTeam))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load team."
      setLoadError(msg)
      pushToast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  const seatLimit = plan.seats
  const usedSeats = useMemo(() => members.filter((m) => m.status === "active").length, [members])
  const atLimit = seatLimit !== -1 && usedSeats >= seatLimit

  const assignableRoles: MembershipRole[] = useMemo(() => {
    if (currentUserRole === "owner") return [...MEMBERSHIP_ROLES]
    return MEMBERSHIP_ROLES.filter((r) => r !== "owner")
  }, [currentUserRole])

  async function sendInvite() {
    if (!inviteEmail.trim() || !organizationId) return
    setInviteError(null)
    setInviteSending(true)
    try {
      const emailTrimmed = inviteEmail.trim()
      const res = await fetch("/api/invites/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailTrimmed,
          organizationId,
          role: inviteRole,
        }),
      })
      const result = (await res.json()) as { message?: string; error?: string }
      if (!res.ok) {
        setInviteError(result.message ?? "Could not send invitation.")
        pushToast({ title: "Invite failed", description: result.message ?? "Could not send invitation.", variant: "destructive" })
        return
      }

      setInviteEmail("")
      setInviteSent(true)
      pushToast({ title: "Invitation sent", description: `Invite sent to ${emailTrimmed}.` })
      await loadTeam()
      setTimeout(() => {
        setInviteSent(false)
        setInviteOpen(false)
      }, 2000)
    } finally {
      setInviteSending(false)
    }
  }

  async function patchMember(userId: string, body: { role?: MembershipRole; status?: "active" | "suspended" }) {
    if (!organizationId) return { ok: false as const }
    try {
      const res = await fetch(`/api/team/members/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, ...body }),
      })
      const data = (await res.json()) as { message?: string; error?: string; unchanged?: boolean }
      if (!res.ok) {
        pushToast({ title: "Update failed", description: data.message ?? data.error ?? "Request failed.", variant: "destructive" })
        return { ok: false as const }
      }
      await loadTeam()
      return { ok: true as const, unchanged: Boolean(data.unchanged) }
    } catch {
      pushToast({ title: "Update failed", description: "Network error.", variant: "destructive" })
      return { ok: false as const }
    }
  }

  async function changeRole(userId: string, role: MembershipRole) {
    const r = await patchMember(userId, { role })
    if (r.ok && !r.unchanged) pushToast({ title: "Role updated" })
    setMenuOpen(null)
  }

  async function suspendUser(userId: string) {
    const r = await patchMember(userId, { status: "suspended" })
    if (r.ok && !r.unchanged) pushToast({ title: "Member deactivated" })
    setMenuOpen(null)
  }

  async function reactivateUser(userId: string) {
    const r = await patchMember(userId, { status: "active" })
    if (r.ok && !r.unchanged) pushToast({ title: "Member reactivated" })
    setMenuOpen(null)
  }

  async function confirmRemove() {
    if (!removeTarget || !organizationId) return
    setRemoveSubmitting(true)
    try {
      const res = await fetch(`/api/team/members/${encodeURIComponent(removeTarget.userId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      })
      const data = (await res.json()) as { message?: string; error?: string }
      if (!res.ok) {
        pushToast({ title: "Remove failed", description: data.message ?? data.error ?? "Request failed.", variant: "destructive" })
        return
      }
      pushToast({ title: "Member removed" })
      setRemoveTarget(null)
      setMenuOpen(null)
      await loadTeam()
    } catch {
      pushToast({ title: "Remove failed", description: "Network error.", variant: "destructive" })
    } finally {
      setRemoveSubmitting(false)
    }
  }

  function canOpenMenuForMember(m: TeamMemberRow): boolean {
    if (!canManageTeam || m.userId === currentUserId) return false
    if (currentUserRole === "admin" && m.role === "owner") return false
    return true
  }

  return (
    <div className="flex flex-col gap-6">
      <Toaster />

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Team members</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {usedSeats} of {seatLimit === -1 ? "unlimited" : seatLimit} seats used
            </p>
          </div>
          <Button onClick={() => setInviteOpen((v) => !v)} disabled={atLimit || !canManageTeam} size="sm">
            <UserPlus size={14} /> Invite member
          </Button>
        </div>

        {/* Seat usage bar */}
        {seatLimit !== -1 && (
          <div className="px-6 py-3 bg-secondary/50 border-b border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Seat usage</span>
              <span className={usedSeats >= seatLimit ? "ds-text-danger font-medium" : ""}>
                {usedSeats}/{seatLimit}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (usedSeats / seatLimit) * 100)}%`,
                  background: usedSeats >= seatLimit ? "var(--ds-danger-subtle)" : "var(--primary)",
                }}
              />
            </div>
            {atLimit && (
              <p className="text-xs ds-text-danger mt-1.5">
                Seat limit reached.{" "}
                <a href="/settings/billing" className="underline">
                  Upgrade to add more.
                </a>
              </p>
            )}
          </div>
        )}

        {/* Invite panel */}
        {inviteOpen && canManageTeam && (
          <div className="px-6 py-4 ds-alert-info border-b">
            <p className="text-xs font-medium mb-3 flex items-center gap-1.5">
              <Mail size={12} /> Invite a new team member
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendInvite()}
                placeholder="colleague@company.com"
                className="input-base flex-1 min-w-48"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as MembershipRole)}
                className="input-base w-40"
              >
                {INVITE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => void sendInvite()}
                disabled={inviteSending || !organizationId}
                className={inviteSent ? "bg-[var(--ds-success-subtle)] hover:bg-[var(--ds-success-subtle)] text-white" : ""}
              >
                {inviteSent ? (
                  <>
                    <Check size={13} /> Sent!
                  </>
                ) : inviteSending ? (
                  "Sending..."
                ) : (
                  "Send invite"
                )}
              </Button>
              <Button variant="outline" size="icon" onClick={() => setInviteOpen(false)}>
                <X size={14} />
              </Button>
            </div>
            {inviteError && <p className="mt-2 text-xs text-red-600">{inviteError}</p>}
          </div>
        )}

        {/* Loading / error / empty */}
        {loading && (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading team…</div>
        )}
        {!loading && loadError && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-destructive mb-3">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void loadTeam()}>
              Retry
            </Button>
          </div>
        )}
        {!loading && !loadError && !organizationId && (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Select a workspace to manage the team.</div>
        )}
        {!loading && !loadError && organizationId && members.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">No members in this organization yet.</div>
        )}

        {/* Members table */}
        {!loading && !loadError && organizationId && members.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30 dark:bg-card">
                  {["Member", "Role", "Status", "Joined", ""].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((user) => (
                  <Fragment key={user.userId}>
                    <tr
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-secondary/30 transition-colors",
                        user.status === "suspended" && "opacity-60",
                      )}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          {user.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.avatarUrl}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-primary text-primary-foreground shrink-0">
                              {initials(user)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-foreground flex items-center gap-1.5">
                              {displayName(user)}
                              {user.userId === currentUserId && (
                                <span className="text-[10px] px-1.5 py-px rounded bg-secondary text-muted-foreground font-normal">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{user.email ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {canOpenMenuForMember(user) && (
                          <div className="relative inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setMenuOpen(menuOpen === user.userId ? null : user.userId)}
                            >
                              <MoreHorizontal size={14} />
                            </Button>

                            {menuOpen === user.userId && (
                              <div
                                className="absolute right-0 top-9 z-50 w-52 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
                                onMouseLeave={() => setMenuOpen(null)}
                              >
                                <div className="px-3 py-2 border-b border-border">
                                  <p className="text-xs font-semibold text-muted-foreground">Change role</p>
                                </div>
                                {assignableRoles.map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => void changeRole(user.userId, r)}
                                    className={cn(
                                      "w-full flex items-center justify-between px-3 py-1.5 cursor-default",
                                      NAV_PRIMARY_ROW_MOTION,
                                      NAV_ROW_INACTIVE_HOVER_CARD,
                                      "rounded-sm",
                                    )}
                                  >
                                    <RoleBadge role={r} />
                                    {user.role === r && <Check size={12} className="text-primary" />}
                                  </button>
                                ))}
                                <div className="border-t border-border">
                                  {user.status === "suspended" ? (
                                    <button
                                      type="button"
                                      onClick={() => void reactivateUser(user.userId)}
                                      className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm ds-text-success hover:bg-[var(--ds-success-bg)] transition-colors cursor-default"
                                    >
                                      <RotateCcw size={12} /> Reactivate
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => void suspendUser(user.userId)}
                                      className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm ds-text-warning hover:bg-[var(--ds-warning-bg)] transition-colors cursor-default"
                                    >
                                      <UserX size={12} /> Deactivate
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRemoveTarget(user)
                                      setMenuOpen(null)
                                    }}
                                    className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm ds-text-danger hover:bg-[var(--ds-danger-bg)] transition-colors cursor-default"
                                  >
                                    <X size={12} /> Remove from workspace
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pending invitations */}
        {!loading && !loadError && organizationId && (
          <div
            className={cn(
              "border-t border-border px-6 py-4",
              pendingInvites.length > 0 && "bg-secondary/20",
            )}
          >
            <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              <Mail size={12} /> Pending invitations
            </p>
            {pendingInvites.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No pending invitations. Use “Invite member” above to send a link.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Email", "Role", "Expires", ""].map((h) => (
                        <th key={h} className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map((inv) => (
                      <tr key={inv.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 text-foreground">{inv.email}</td>
                        <td className="py-2 pr-4">
                          <RoleBadge role={inv.role} />
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {new Date(inv.expiresAt).toLocaleString()}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">Pending</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `Remove ${displayName(removeTarget)} (${removeTarget.email ?? removeTarget.userId}) from this workspace? This cannot be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void confirmRemove()
              }}
            >
              {removeSubmitting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role definitions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Shield size={14} /> Role definitions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            What each role can access in your workspace. Visit{" "}
            <a href="/settings/permissions" className="underline text-primary">
              Permissions
            </a>{" "}
            to see the full matrix.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 divide-y sm:divide-x divide-border flex-wrap">
          {MEMBERSHIP_ROLES.map((role) => {
            const { color, bg, desc } = ROLE_META[role]
            const count = members.filter((u) => u.role === role).length
            return (
              <div key={role} className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
                    {ROLE_LABEL[role]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {count} member{count !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
