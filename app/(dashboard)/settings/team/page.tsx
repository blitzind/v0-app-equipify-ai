"use client"

import { useState } from "react"
import { useTenant } from "@/lib/tenant-store"
import { getPlan } from "@/lib/plans"
import type { UserRole, TenantUser } from "@/lib/tenant-data"
import { UserPlus, MoreHorizontal, Check, X, Mail, Shield, ChevronDown } from "lucide-react"

const ROLES: UserRole[] = ["Admin", "Manager", "Tech", "Read Only"]

const ROLE_META: Record<UserRole, { color: string; bg: string; desc: string }> = {
  Admin:       { color: "#1d4ed8", bg: "#eff6ff", desc: "Full access including billing and workspace settings" },
  Manager:     { color: "#15803d", bg: "#f0fdf4", desc: "Can manage work orders, equipment, and view insights" },
  Tech:        { color: "#b45309", bg: "#fffbeb", desc: "Can update assigned work orders and service records" },
  "Read Only": { color: "#6b7280", bg: "#f9fafb", desc: "View-only access across the workspace" },
}

function RoleBadge({ role }: { role: UserRole }) {
  const { color, bg } = ROLE_META[role]
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
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

export default function TeamPage() {
  const { workspace, workspaceUsers: users, currentUser, dispatch, plan } = useTenant()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("Tech")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)

  const seatLimit = plan.seats
  const usedSeats = users.filter((u) => u.status === "Active").length
  const atLimit = seatLimit !== -1 && usedSeats >= seatLimit

  function sendInvite() {
    if (!inviteEmail) return
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
  }
  function suspendUser(userId: string) {
    dispatch({ type: "SUSPEND_USER", payload: userId })
    setMenuOpen(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Team members</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {usedSeats} of {seatLimit === -1 ? "unlimited" : seatLimit} seats used
            </p>
          </div>
          <button onClick={() => setInviteOpen((v) => !v)}
            disabled={atLimit}
            className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md text-white disabled:opacity-50 transition-colors"
            style={{ background: "#2563eb" }}>
            <UserPlus size={14} /> Invite member
          </button>
        </div>

        {/* Seat usage bar */}
        {seatLimit !== -1 && (
          <div className="px-6 py-3 bg-secondary border-b border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Seat usage</span>
              <span className={usedSeats >= seatLimit ? "text-red-600 font-medium" : ""}>{usedSeats}/{seatLimit}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (usedSeats / seatLimit) * 100)}%`,
                  background: usedSeats >= seatLimit ? "#dc2626" : "#2563eb",
                }} />
            </div>
            {atLimit && (
              <p className="text-xs text-red-600 mt-1.5">
                Seat limit reached. <a href="/settings/billing" className="underline">Upgrade to add more seats.</a>
              </p>
            )}
          </div>
        )}

        {/* Invite form */}
        {inviteOpen && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <p className="text-xs font-medium text-blue-800 mb-3 flex items-center gap-1"><Mail size={12} /> Invite a new team member</p>
            <div className="flex gap-2 flex-wrap">
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com" className="input-base flex-1 min-w-48" />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="input-base w-36">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={sendInvite}
                className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-md text-white"
                style={{ background: inviteSent ? "#16a34a" : "#2563eb" }}>
                {inviteSent ? <><Check size={13} /> Sent!</> : "Send invite"}
              </button>
              <button onClick={() => setInviteOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Members table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Member", "Role", "Status", "Last active", ""].map((h) => (
                <th key={h} className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                      style={{ background: "#2563eb" }}>
                      {user.name.split(" ").map(n => n[0]).join("").slice(0,2)}
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
                <td className="px-6 py-3"><RoleBadge role={user.role} /></td>
                <td className="px-6 py-3"><StatusBadge status={user.status} /></td>
                <td className="px-6 py-3 text-xs text-muted-foreground">{user.lastActive}</td>
                <td className="px-6 py-3 text-right">
                  {user.id !== currentUser.id && currentUser.role === "Admin" && (
                    <div className="relative inline-block">
                      <button onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary transition-colors text-muted-foreground">
                        <MoreHorizontal size={14} />
                      </button>
                      {menuOpen === user.id && (
                        <div className="absolute right-0 top-8 z-50 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                          <div className="px-3 py-2 border-b border-border">
                            <p className="text-xs font-medium text-muted-foreground">Change role</p>
                          </div>
                          {ROLES.map((r) => (
                            <button key={r} onClick={() => changeRole(user.id, r)}
                              className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-secondary transition-colors">
                              <RoleBadge role={r} />
                              {user.role === r && <Check size={12} className="text-blue-600" />}
                            </button>
                          ))}
                          <div className="border-t border-border">
                            <button onClick={() => suspendUser(user.id)}
                              className="w-full text-left px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors">
                              Suspend
                            </button>
                            <button onClick={() => removeUser(user.id)}
                              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                              Remove from workspace
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role definitions */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Shield size={14} /> Role definitions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">What each role can access in your workspace.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y divide-border">
          {ROLES.map((role) => {
            const { color, bg, desc } = ROLE_META[role]
            const count = users.filter(u => u.role === role).length
            return (
              <div key={role} className="p-5">
                <div className="flex items-center justify-between mb-2">
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
