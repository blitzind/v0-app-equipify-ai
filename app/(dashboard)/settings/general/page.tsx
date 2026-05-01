"use client"

import { useState } from "react"
import { Check, User, Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"

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

export default function GeneralPage() {
  const [saved, setSaved] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [form, setForm] = useState({
    firstName: "Alex",
    lastName: "Johnson",
    email: "alex.johnson@acmecorp.com",
    phone: "+1 (415) 555-0192",
    title: "Operations Manager",
  })

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile */}
      <SettingCard title="My profile" description="Your personal information shown across the workspace.">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-xl font-bold shrink-0">
            AJ
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPG or PNG, max 2 MB. Shown on work orders and team pages.</p>
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" className="text-xs h-7">Upload photo</Button>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground">Remove</Button>
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
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email address</label>
            <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className="input-base" />
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

      {/* Password */}
      <SettingCard title="Password" description="Update your login password. You will be asked to verify your current password.">
        <div className="flex flex-col gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Current password</label>
            <input type="password" placeholder="••••••••" className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">New password</label>
            <input type="password" placeholder="••••••••" className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm new password</label>
            <input type="password" placeholder="••••••••" className="input-base" />
          </div>
          <div>
            <Button size="sm" variant="outline">Update password</Button>
          </div>
        </div>
      </SettingCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave}>
          {saved ? <><Check size={14} /> Saved</> : "Save changes"}
        </Button>
      </div>
    </div>
  )
}
