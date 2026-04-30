"use client"

import { useState, useRef } from "react"
import { useTenant } from "@/lib/tenant-store"
import { Upload, Check, Globe, Palette, Building2 } from "lucide-react"

const TIMEZONES = ["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Asia/Tokyo"]
const DATE_FORMATS = ["MM/DD/YYYY","DD/MM/YYYY","YYYY-MM-DD"]
const ACCENT_PRESETS = ["#2563eb","#0f766e","#7c3aed","#dc2626","#d97706","#16a34a","#0284c7","#db2777"]

function SettingCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
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

export default function WorkspacePage() {
  const { workspace, dispatch, plan } = useTenant()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: workspace.name,
    companyEmail: workspace.companyEmail,
    companyPhone: workspace.companyPhone,
    companyAddress: workspace.companyAddress,
    timezone: workspace.timezone,
    dateFormat: workspace.dateFormat,
  })
  const fileRef = useRef<HTMLInputElement>(null)

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    dispatch({ type: "SET_WORKSPACE", payload: { ...form } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      dispatch({ type: "SET_LOGO", payload: ev.target?.result as string })
    }
    reader.readAsDataURL(file)
  }

  const isGrowthOrAbove = plan.id !== "starter"

  return (
    <div className="space-y-6">
      {/* General */}
      <SettingCard title="General" description="Basic workspace information shown across the platform.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Workspace name</label>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company email</label>
            <input type="email" value={form.companyEmail} onChange={(e) => setField("companyEmail", e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company phone</label>
            <input value={form.companyPhone} onChange={(e) => setField("companyPhone", e.target.value)} className="input-base" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company address</label>
            <input value={form.companyAddress} onChange={(e) => setField("companyAddress", e.target.value)} className="input-base" />
          </div>
        </div>
      </SettingCard>

      {/* Localization */}
      <SettingCard title="Localization" description="Date format and timezone applied across all users in this workspace.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Timezone</label>
            <select value={form.timezone} onChange={(e) => setField("timezone", e.target.value)} className="input-base">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date format</label>
            <select value={form.dateFormat} onChange={(e) => setField("dateFormat", e.target.value)} className="input-base">
              {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </SettingCard>

      {/* White-label branding */}
      <SettingCard
        title="White-label branding"
        description={isGrowthOrAbove ? "Upload your logo and choose an accent color for your workspace and customer portal." : undefined}>
        {!isGrowthOrAbove ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Globe size={14} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Available on Growth and Enterprise</p>
              <p className="text-xs text-muted-foreground">Upload a custom logo and set your brand color. <a href="/settings/billing" className="text-primary underline">Upgrade your plan</a></p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Logo upload */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Company logo</p>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary"
                  style={{ cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
                  {workspace.logoUrl
                    ? <img src={workspace.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    : <Upload size={20} className="text-muted-foreground" />}
                </div>
                <div>
                  <button onClick={() => fileRef.current?.click()}
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                    <Upload size={13} /> Upload logo
                  </button>
                  <p className="text-xs text-muted-foreground mt-1">PNG or SVG, max 2MB. Recommended: 200×200px.</p>
                  {workspace.logoUrl && (
                    <button onClick={() => dispatch({ type: "SET_LOGO", payload: "" })}
                      className="text-xs text-red-500 hover:underline mt-1">Remove</button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>

            {/* Accent color */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Palette size={13} className="text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Brand accent color</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_PRESETS.map((c) => (
                  <button key={c} onClick={() => dispatch({ type: "SET_COLOR", payload: c })}
                    className="w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{ background: c, borderColor: workspace.primaryColor === c ? "#0f172a" : "transparent" }}>
                    {workspace.primaryColor === c && <Check size={12} className="text-white" />}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-1">
                  <input type="color" value={workspace.primaryColor}
                    onChange={(e) => dispatch({ type: "SET_COLOR", payload: e.target.value })}
                    className="w-7 h-7 rounded-full border border-border cursor-pointer p-0 bg-transparent"
                    title="Custom color" />
                  <span className="text-xs text-muted-foreground font-mono">{workspace.primaryColor}</span>
                </div>
              </div>
              {/* Preview */}
              <div className="mt-4 p-4 rounded-lg border border-border bg-secondary">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Building2 size={11} /> Brand preview</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: workspace.primaryColor }}>
                    {workspace.name[0]}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{workspace.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ background: workspace.primaryColor }}>Growth</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SettingCard>

      {/* Danger zone */}
      <SettingCard title="Danger zone">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Delete workspace</p>
            <p className="text-xs text-muted-foreground">Permanently delete this workspace and all its data. This action cannot be undone.</p>
          </div>
          <button className="px-3 h-8 text-sm font-medium border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors">
            Delete workspace
          </button>
        </div>
      </SettingCard>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave}
          className="flex items-center gap-1.5 h-9 px-5 text-sm font-medium rounded-md text-white transition-colors"
          style={{ background: saved ? "#16a34a" : "#2563eb" }}>
          {saved ? <><Check size={14} /> Saved</> : "Save changes"}
        </button>
      </div>
    </div>
  )
}
