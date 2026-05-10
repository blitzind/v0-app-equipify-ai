"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, Moon, Sun, Monitor, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWorkspaceAppearance } from "@/lib/workspace-appearance-context"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"

function SettingCard({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

type ProfileResponse = {
  userId?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  jobTitle?: string
  avatarUrl?: string
  message?: string
}

export default function GeneralPage() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { preference: theme, setPreference: setTheme } = useWorkspaceAppearance()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
  })
  const [avatarUrl, setAvatarUrl] = useState("")

  const loadProfile = useCallback(async () => {
    if (orgStatus !== "ready" || !organizationId) return
    setLoadState("loading")
    try {
      const res = await fetch(
        `/api/session/profile?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" },
      )
      const data = (await res.json()) as ProfileResponse
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not load profile",
          description: data.message ?? `Request failed (${res.status})`,
        })
        setLoadState("error")
        return
      }
      setUserId(data.userId ?? null)
      setForm({
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        title: data.jobTitle ?? "",
      })
      setAvatarUrl(data.avatarUrl ?? "")
      setLoadState("ready")
    } catch {
      toast({ variant: "destructive", title: "Could not load profile", description: "Network error." })
      setLoadState("error")
    }
  }, [organizationId, orgStatus, toast])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function initialsFromForm() {
    const a = form.firstName.trim().slice(0, 1)
    const b = form.lastName.trim().slice(0, 1)
    if (a || b) return `${a}${b}`.toUpperCase()
    const em = form.email.trim()
    return em.length >= 2 ? em.slice(0, 2).toUpperCase() : em.slice(0, 1).toUpperCase() || "?"
  }

  async function handleSave() {
    if (!organizationId || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/session/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          jobTitle: form.title.trim(),
        }),
      })
      const data = (await res.json()) as ProfileResponse & { ok?: boolean }
      if (!res.ok) {
        toast({ variant: "destructive", title: "Save failed", description: data.message ?? "Try again." })
        return
      }
      setForm((f) => ({
        ...f,
        firstName: data.firstName ?? f.firstName,
        lastName: data.lastName ?? f.lastName,
        email: data.email ?? f.email,
        phone: data.phone ?? f.phone,
        title: data.jobTitle ?? f.title,
      }))
      if (data.avatarUrl !== undefined) setAvatarUrl(data.avatarUrl ?? "")
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast({ title: "Saved", description: "Your profile was updated." })
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Network error." })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !organizationId || !userId || uploadingAvatar) return
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Use an image under 5 MB." })
      return
    }
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}/avatar`,
        { method: "POST", body: fd },
      )
      const data = (await res.json()) as { avatarUrl?: string; message?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: data.message ?? "Could not upload photo.",
        })
        return
      }
      if (data.avatarUrl) setAvatarUrl(data.avatarUrl)
      toast({ title: "Photo updated" })
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Network error." })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleRemoveAvatar() {
    if (uploadingAvatar) return
    setUploadingAvatar(true)
    try {
      const res = await fetch("/api/session/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAvatar: true }),
      })
      const data = (await res.json()) as { message?: string; avatarUrl?: string }
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not remove photo", description: data.message ?? "Try again." })
        return
      }
      setAvatarUrl("")
      toast({ title: "Photo removed" })
    } catch {
      toast({ variant: "destructive", title: "Could not remove photo", description: "Network error." })
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (orgStatus !== "ready" || !organizationId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading workspace…
      </div>
    )
  }

  if (loadState === "loading" || loadState === "idle") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading profile…
      </div>
    )
  }

  if (loadState === "error") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <p className="text-sm text-foreground font-medium">Could not load your profile</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void loadProfile()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile */}
      <SettingCard title="My profile" description="Your personal information shown across the workspace.">
        <div className="flex items-center gap-4 mb-6">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover shrink-0 border border-border"
            />
          ) : (
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-lg font-semibold shrink-0">
              {initialsFromForm()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPG or PNG, max 5 MB. Shown on work orders and team pages.</p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                disabled={uploadingAvatar || !userId}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Upload photo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground"
                disabled={uploadingAvatar || !avatarUrl}
                onClick={() => void handleRemoveAvatar()}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">First name</label>
            <input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Last name</label>
            <input value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} className="input-base" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email address</label>
            <input type="email" value={form.email} readOnly className="input-base bg-muted/50 text-muted-foreground cursor-not-allowed" />
            <p className="text-[11px] text-muted-foreground mt-1">Email is managed through your login. Contact support to change it.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone number</label>
            <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} className="input-base" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Job title</label>
            <input value={form.title} onChange={(e) => setField("title", e.target.value)} className="input-base" />
          </div>
        </div>
      </SettingCard>

      {/* Appearance */}
      <SettingCard title="Appearance" description="Choose how Equipify looks for you. This setting is personal and does not affect other team members.">
        <div className="flex items-center gap-3 flex-wrap">
          {([
            { id: "light",  label: "Light",  icon: Sun },
            { id: "dark",   label: "Dark",   icon: Moon },
            { id: "system", label: "System", icon: Monitor },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                theme === id
                  ? "border-primary bg-primary/8 text-primary"
                  : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </SettingCard>

      {/* Password — auth is Supabase; in-app change is not implemented */}
      <SettingCard
        title="Password"
        description="Your password is managed by Supabase Auth. Changing it from Settings is not available yet."
      >
        <p className="text-sm text-muted-foreground max-w-md">
          Use the sign-in page to authenticate. If you need to recover access, work with your workspace administrator or Equipify support — self-serve password reset from the app is planned.
        </p>
        <Button type="button" asChild variant="outline" size="sm" className="mt-4">
          <Link href="/login">Open sign in</Link>
        </Button>
      </SettingCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin mr-2" /> Saving…
            </>
          ) : saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  )
}
