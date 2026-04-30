"use client"

import { useState, useRef } from "react"
import {
  useEquipmentTypes,
  type EquipmentType,
  ICON_OPTIONS,
  COLOR_PRESETS,
} from "@/lib/equipment-type-store"
import {
  Thermometer, Snowflake, Zap, Droplets, UtensilsCrossed,
  Flame, CircuitBoard, ArrowUpDown, Wrench, Settings, Wind,
  Gauge, Lightbulb, Radio, Cpu, Server, ShieldCheck,
  AlertTriangle, Power, PcCase, Plus, Pencil, Trash2,
  Check, X, GripVertical, Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Thermometer, Snowflake, Zap, Droplets, UtensilsCrossed,
  Flame, CircuitBoard, ArrowUpDown, Wrench, Settings, Wind,
  Gauge, Lightbulb, Radio, Cpu, Server, ShieldCheck,
  AlertTriangle, Power, PcCase,
}

function TypeIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] ?? Wrench
  return <Icon size={size} className={className} />
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center shrink-0"
          style={{ background: c, borderColor: value === c ? "rgba(0,0,0,0.5)" : "transparent" }}
        >
          {value === c && <Check size={10} className="text-white" />}
        </button>
      ))}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-6 h-6 rounded-full border border-border overflow-hidden shrink-0 cursor-pointer"
        style={{ background: value }}
        title="Custom color"
      />
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      <span className="text-xs text-muted-foreground font-mono">{value}</span>
    </div>
  )
}

function IconPicker({ value, onChange }: { value: string; onChange: (i: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ICON_OPTIONS.map((name) => {
        const active = value === name
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            title={name}
            className={cn(
              "w-8 h-8 rounded-md border flex items-center justify-center transition-all",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <TypeIcon name={name} size={14} />
          </button>
        )
      })}
    </div>
  )
}

// ─── Inline editor for an existing type ───────────────────────────────────────

function TypeEditor({
  type,
  onSave,
  onCancel,
}: {
  type: EquipmentType
  onSave: (patch: Partial<Omit<EquipmentType, "id">>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(type.name)
  const [description, setDescription] = useState(type.description)
  const [color, setColor] = useState(type.color)
  const [icon, setIcon] = useState(type.icon)
  const [nameErr, setNameErr] = useState("")

  function handleSave() {
    if (!name.trim()) { setNameErr("Name is required"); return }
    onSave({ name: name.trim(), description: description.trim(), color, icon })
  }

  return (
    <div className="flex flex-col gap-4 py-1">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setNameErr("") }}
          className={cn("input-base w-full", nameErr && "border-destructive")}
          placeholder="e.g. Boilers"
        />
        {nameErr && <p className="text-xs text-destructive mt-1">{nameErr}</p>}
      </div>
      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-base w-full"
          placeholder="Short description of this type"
        />
      </div>
      {/* Icon */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Icon</label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      {/* Color */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {/* Preview */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border w-fit">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ background: color + "22", color }}
        >
          <TypeIcon name={icon} size={14} />
        </div>
        <span className="text-sm font-medium text-foreground">{name || "Preview"}</span>
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSave} className="gap-1.5">
          <Check size={13} /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="gap-1.5">
          <X size={13} /> Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── Add new type form ────────────────────────────────────────────────────────

function AddTypeForm({ onAdd }: { onAdd: () => void }) {
  const { dispatch } = useEquipmentTypes()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(COLOR_PRESETS[0])
  const [icon, setIcon] = useState(ICON_OPTIONS[0] as string)
  const [nameErr, setNameErr] = useState("")

  function reset() {
    setName("")
    setDescription("")
    setColor(COLOR_PRESETS[0])
    setIcon(ICON_OPTIONS[0])
    setNameErr("")
    setOpen(false)
  }

  function handleAdd() {
    if (!name.trim()) { setNameErr("Name is required"); return }
    dispatch({ type: "ADD", payload: { name: name.trim(), description: description.trim(), color, icon } })
    reset()
    onAdd()
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-2 w-full justify-center border-dashed"
        onClick={() => setOpen(true)}
      >
        <Plus size={13} />
        Add equipment type
      </Button>
    )
  }

  return (
    <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 flex flex-col gap-4">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide">New equipment type</p>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setNameErr("") }}
          className={cn("input-base w-full", nameErr && "border-destructive")}
          placeholder="e.g. Boilers"
          autoFocus
        />
        {nameErr && <p className="text-xs text-destructive mt-1">{nameErr}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-base w-full"
          placeholder="Short description"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Icon</label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {/* Preview */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border w-fit">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ background: color + "22", color }}
        >
          <TypeIcon name={icon} size={14} />
        </div>
        <span className="text-sm font-medium text-foreground">{name || "Preview"}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleAdd} className="gap-1.5">
          <Plus size={13} /> Add type
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── Type row card ────────────────────────────────────────────────────────────

function TypeRow({ type }: { type: EquipmentType }) {
  const { dispatch } = useEquipmentTypes()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleSave(patch: Partial<Omit<EquipmentType, "id">>) {
    dispatch({ type: "UPDATE", payload: { id: type.id, ...patch } })
    setEditing(false)
  }

  function handleDelete() {
    dispatch({ type: "DELETE", payload: { id: type.id } })
  }

  return (
    <div className={cn(
      "border border-border rounded-lg bg-card transition-all",
      editing && "border-primary/40 shadow-sm"
    )}>
      {/* Header row — always visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical size={14} className="text-muted-foreground/40 shrink-0 cursor-grab" />

        {/* Icon tile */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: type.color + "1a", color: type.color }}
        >
          <TypeIcon name={type.icon} size={15} />
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground leading-none">{type.name}</span>
            {type.isDefault && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border font-medium">
                Default
              </span>
            )}
          </div>
          {type.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{type.description}</p>
          )}
        </div>

        {/* Usage badge */}
        <div className="flex items-center gap-1 shrink-0">
          <Package size={12} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium tabular-nums">
            {type.usageCount}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!editing && (
            <button
              onClick={() => { setEditing(true); setConfirmDelete(false) }}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => {
                if (type.isDefault) return
                setConfirmDelete(true)
                setEditing(false)
              }}
              disabled={type.isDefault}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                type.isDefault
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "text-muted-foreground hover:text-destructive hover:bg-destructive/8"
              )}
              title={type.isDefault ? "Default types cannot be deleted" : "Delete"}
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="flex items-center gap-1 ml-1">
              <span className="text-xs text-destructive font-medium">Delete?</span>
              <button
                onClick={handleDelete}
                className="w-6 h-6 rounded flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Check size={11} />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline editor */}
      {editing && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <TypeEditor type={type} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentTypesPage() {
  const { types } = useEquipmentTypes()
  const [addedKey, setAddedKey] = useState(0)

  const defaults = types.filter((t) => t.isDefault)
  const custom = types.filter((t) => !t.isDefault)
  const totalEquipment = types.reduce((s, t) => s + t.usageCount, 0)

  return (
    <div className="flex flex-col gap-6">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total types",     value: types.length },
          { label: "Custom types",    value: custom.length },
          { label: "Equipment tagged", value: totalEquipment },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Default types */}
      <SettingCard
        title="Default types"
        description="Built-in equipment categories. You can edit names, icons, and colors but not delete them."
      >
        <div className="flex flex-col gap-2">
          {defaults.map((t) => <TypeRow key={t.id} type={t} />)}
        </div>
      </SettingCard>

      {/* Custom types */}
      <SettingCard
        title="Custom types"
        description="Add your own equipment categories. Custom types can be edited or deleted at any time."
      >
        <div className="flex flex-col gap-2">
          {custom.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No custom types yet. Add one below.
            </p>
          )}
          {custom.map((t) => <TypeRow key={`${t.id}-${addedKey}`} type={t} />)}
          <div className="pt-2">
            <AddTypeForm onAdd={() => setAddedKey((k) => k + 1)} />
          </div>
        </div>
      </SettingCard>

      {/* Usage note */}
      <p className="text-xs text-muted-foreground px-1">
        Equipment types appear in the Add Equipment form, filters, and reports. Changes apply immediately across all views.
      </p>
    </div>
  )
}
