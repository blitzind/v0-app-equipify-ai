"use client"

import { useState } from "react"
import { useTenant } from "@/lib/tenant-store"
import type { UserRole, TenantUser } from "@/lib/tenant-data"
import {
  UserPlus, MoreHorizontal, Check, X, Mail, Shield,
  ChevronDown, Settings2, UserX, RotateCcw, Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Role definitions ─────────────────────────────────────────────────────────

const ROLES: UserRole[] = ["Owner", "Admin", "Dispatcher", "Technician", "Billing", "Sales", "Read Only"]

const ROLE_META: Record<UserRole, { color: string; bg: string; desc: string }> = {
  Owner:       { color: "#7c3aed", bg: "#f5f3ff", desc: "Full control over workspace, billing, and all settings." },
  Admin:       { color: "#1d4ed8", bg: "#eff6ff", desc: "Manages team, settings, and operations. Cannot transfer ownership." },
  Dispatcher:  { color: "#0369a1", bg: "#f0f9ff", desc: "Creates and assigns work orders, schedules technicians." },
  Technician:  { color: "#b45309", bg: "#fffbeb", desc: "Views and updates assigned work orders and equipment." },
  Billing:     { color: "#15803d", bg: "#f0fdf4", desc: "Manages invoices, payments, and billing settings only." },
  Sales:       { color: "#be185d", bg: "#fdf2f8", desc: "Creates quotes, views customers, and tracks pipeline." },
  "Read Only": { color: "#6b7280", bg: "#f9fafb", desc: "View-only access across the workspace." },
}

// Per-role custom permission keys users can toggle (Enterprise feature display)
const CUSTOM_PERMS = [
  { key: "canViewInsights",      label: "AI Insights" },
  { key: "canAccessPortal",      label: "Customer Portal" },
  { key: "canCreateWorkOrders",  label: "Create Work Orders" },
  { key: "canEditWorkOrders",    label: "Edit Work Orders" },
  { key: "canCreateEquipment",   label: "Add Equipment" },
  { key: "canViewBilling",       label: "View Billing" },
]

// ─── Badges ───────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const { color, bg } = ROLE_META[role]
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: bg }}>{role}</span>
  )
}

function StatusBadge({ status }: { status: TenantUser["status"] }) {
  const map = {
    Active:    { color: "#15803d", bg: "#f0fdf4" },
    Invited:   { color: "#b45309", bg: "#fffbeb" },
    Suspended: { color: "#6b7280", bg: "#f3f4f6" },
  }
  const { color, bg } = map[status]
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color, background: bg }}>{status}</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { workspace, workspaceUsers: users, currentUser, dispatch, plan } = useTenant()

  // Invite panel
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("Technician")
  const [inviteSent, setInviteSent] = useState(false)

  // Menus
  const [menuOpen, setMenuOpen]         = useState<string | null>(null)
  const [customPermsUser, setCustomPermsUser] = useState<string | null>(null)

  // Custom perm overrides (local state — Enterprise simulation)
  const [customOverrides, setCustomOverrides] = useState<Record<string, Record<string, boolean>>>({})

  const seatLimit = plan.seats
  const usedSeats = users.filter((u) => u.status === "Active").length
  const atLimit   = seatLimit !== -1 && usedSeats >= seatLimit

  function sendInvite() {
    if (!inviteEmail.trim()) return
    const newUser: TenantUser = {
      id: `u-inv-${Date.now()}`,
      name: inviteEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      email: inviteEmail,
      role: inviteRole,
      avatar: "",
      joinedAt: new Date().toISOString().split("T")[0],
      lastActive: "—",
      status: "Invited",
    }
    dispatch({ type: "INVITE_USER", payload: newUser })
    setInviteEmail("")
    setInviteSent(true)
    setTimeout(() => { setInviteSent(false); setInviteOpen(false) }, 2000)
  }

  function changeRole(userId: string, role: UserRole) {
    dispatch({ type: "SET_USER_ROLE", payload: { userId, role } })
    setMenuOpen(null)
  }
  function removeUser(userId: string) {
    dispatch({ type: "REMOVE_USER", payload: userId })
    setMenuOpen(null)
    setCustomPermsUser(null)
  }
  function suspendUser(userId: string) {
    dispatch({ type: "SUSPEND_USER", payload: userId })
    setMenuOpen(null)
  }
  function reactivateUser(userId: string) {
    dispatch({ type: "SET_USER_ROLE", payload: { userId, role: users.find(u => u.id === userId)?.role ?? "Read Only" } })
    setMenuOpen(null)
  }

  function toggleCustomPerm(userId: string, key: string) {
    setCustomOverrides(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [key]: !(prev[userId]?.[key] ?? true),
      }
    }))
  }

  const isAdmin = currentUser.role === "Owner" || currentUser.role === "Admin"

  return (
    <div className="flex flex-col gap-6">

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Team members</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {usedSeats} of {seatLimit === -1 ? "unlimited" : seatLimit} seats used
            </p>
          </div>
          <Button onClick={() => setInviteOpen(v => !v)} disabled={atLimit} size="sm">
            <UserPlus size={14} /> Invite member
          </Button>
        </div>

        {/* Seat usage bar */}
        {seatLimit !== -1 && (
          <div className="px-6 py-3 bg-secondary/50 border-b border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Seat usage</span>
              <span className={usedSeats >= seatLimit ? "ds-text-danger font-medium" : ""}>{usedSeats}/{seatLimit}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (usedSeats / seatLimit) * 100)}%`,
                  background: usedSeats >= seatLimit ? "var(--ds-danger-subtle)" : "var(--primary)",
                }} />
            </div>
            {atLimit && (
              <p className="text-xs ds-text-danger mt-1.5">
                Seat limit reached. <a href="/settings/billing" className="underline">Upgrade to add more.</a>
              </p>
            )}
          </div>
        )}

        {/* Invite panel */}
        {inviteOpen && (
          <div className="px-6 py-4 ds-alert-info border-b">
            <p className="text-xs font-medium mb-3 flex items-center gap-1.5">
              <Mail size={12} /> Invite a new team member
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendInvite()}
                placeholder="colleague@company.com"
                className="input-base flex-1 min-w-48"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as UserRole)}
                className="input-base w-40"
              >
                {ROLES.filter(r => r !== "Owner").map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <Button
                onClick={sendInvite}
                className={inviteSent ? "bg-[var(--ds-success-subtle)] hover:bg-[var(--ds-success-subtle)] text-white" : ""}
              >
                {inviteSent ? <><Check size={13} /> Sent!</> : "Send invite"}
              </Button>
              <Button variant="outline" size="icon" onClick={() => setInviteOpen(false)}>
                <X size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* Members table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Member", "Role", "Status", "Last active", ""].map((h) => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <>
                  <tr key={user.id}
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-secondary/30 transition-colors",
                      user.status === "Suspended" && "opacity-60"
                    )}
                  >
                    {/* Member */}
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-primary text-primary-foreground shrink-0">
                          {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground flex items-center gap-1.5">
                            {user.name}
                            {user.id === currentUser.id && (
                              <span className="text-[10px] px-1.5 py-px rounded bg-secondary text-muted-foreground font-normal">You</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-3"><RoleBadge role={user.role} /></td>

                    {/* Status */}
                    <td className="px-6 py-3"><StatusBadge status={user.status} /></td>

                    {/* Last active */}
                    <td className="px-6 py-3 text-xs text-muted-foreground">{user.lastActive}</td>

                    {/* Actions */}
                    <td className="px-6 py-3 text-right">
                      {user.id !== currentUser.id && isAdmin && (
                        <div className="relative inline-flex items-center gap-1">
                          {/* Custom perms toggle */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Custom permissions"
                            onClick={() => setCustomPermsUser(customPermsUser === user.id ? null : user.id)}
                            className={customPermsUser === user.id ? "bg-primary/10 text-primary" : ""}
                          >
                            <Settings2 size={13} />
                          </Button>
                          {/* Kebab menu */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                          >
                            <MoreHorizontal size={14} />
                          </Button>

                          {menuOpen === user.id && (
                            <div
                              className="absolute right-0 top-9 z-50 w-52 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
                              onMouseLeave={() => setMenuOpen(null)}
                            >
                              <div className="px-3 py-2 border-b border-border">
                                <p className="text-xs font-semibold text-muted-foreground">Change role</p>
                              </div>
                              {ROLES.filter(r => r !== "Owner").map(r => (
                                <button key={r} onClick={() => changeRole(user.id, r)}
                                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-secondary transition-colors cursor-default">
                                  <RoleBadge role={r} />
                                  {user.role === r && <Check size={12} className="text-primary" />}
                                </button>
                              ))}
                              <div className="border-t border-border">
                                {user.status === "Suspended" ? (
                                  <button onClick={() => reactivateUser(user.id)}
                                    className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm ds-text-success hover:bg-[var(--ds-success-bg)] transition-colors cursor-default">
                                    <RotateCcw size={12} /> Reactivate
                                  </button>
                                ) : (
                                  <button onClick={() => suspendUser(user.id)}
                                    className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm ds-text-warning hover:bg-[var(--ds-warning-bg)] transition-colors cursor-default">
                                    <UserX size={12} /> Deactivate
                                  </button>
                                )}
                                <button onClick={() => removeUser(user.id)}
                                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm ds-text-danger hover:bg-[var(--ds-danger-bg)] transition-colors cursor-default">
                                  <X size={12} /> Remove from workspace
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Custom permissions panel */}
                  {customPermsUser === user.id && (
                    <tr key={`${user.id}-perms`} className="bg-secondary/20 border-b border-border">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                              <Settings2 size={12} className="text-primary" />
                              Custom permission overrides for{" "}
                              <span className="text-foreground">{user.name}</span>
                              <span className="text-[10px] px-1.5 py-px rounded bg-[#7c3aed]/10 text-[#7c3aed] font-medium ml-1">Enterprise</span>
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {CUSTOM_PERMS.map(({ key, label }) => {
                                const on = customOverrides[user.id]?.[key] ?? true
                                return (
                                  <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                    <button
                                      role="switch"
                                      aria-checked={on}
                                      onClick={() => toggleCustomPerm(user.id, key)}
                                      className={cn(
                                        "relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors",
                                        on ? "bg-primary" : "bg-border"
                                      )}
                                    >
                                      <span className={cn(
                                        "inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                                        on ? "translate-x-3" : "translate-x-0"
                                      )} />
                                    </button>
                                    <span className="text-xs text-foreground">{label}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                          <button
                            onClick={() => setCustomPermsUser(null)}
                            className="ds-btn-icon-ghost shrink-0"
                            aria-label="Close"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role definitions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Shield size={14} /> Role definitions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            What each role can access in your workspace. Visit{" "}
            <a href="/settings/permissions" className="underline text-primary">Permissions</a>{" "}
            to see the full matrix.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-x divide-border flex-wrap">
          {ROLES.map((role) => {
            const { color, bg, desc } = ROLE_META[role]
            const count = users.filter(u => u.role === role).length
            return (
              <div key={role} className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>{role}</span>
                  <span className="text-xs text-muted-foreground">{count} member{count !== 1 ? "s" : ""}</span>
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
