"use client"

import { useState } from "react"
import { Copy, Eye, EyeOff, Plus, Trash2, Check, Code2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ApiKey {
  id: string
  name: string
  key: string
  created: string
  lastUsed: string
  scopes: string[]
}

const INITIAL_KEYS: ApiKey[] = [
  {
    id: "k1",
    name: "Production integration",
    key: "eq_live_sk_f8a2b1c3d4e5f6a7b8c9d0e1f2a3b4c5",
    created: "Feb 14, 2026",
    lastUsed: "Today",
    scopes: ["work_orders:read", "work_orders:write", "equipment:read"],
  },
  {
    id: "k2",
    name: "QuickBooks sync service",
    key: "eq_live_sk_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    created: "Mar 3, 2026",
    lastUsed: "2 days ago",
    scopes: ["invoices:read", "invoices:write", "customers:read"],
  },
]

const ALL_SCOPES = [
  "work_orders:read", "work_orders:write",
  "equipment:read",  "equipment:write",
  "customers:read",  "customers:write",
  "invoices:read",   "invoices:write",
  "reports:read",
]

function maskKey(key: string) {
  return key.slice(0, 12) + "••••••••••••••••••••" + key.slice(-4)
}

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

function ApiKeyRow({ apiKey, onDelete }: { apiKey: ApiKey; onDelete: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(apiKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{apiKey.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Created {apiKey.created} &middot; Last used: {apiKey.lastUsed}
          </p>
        </div>
        {!confirmDelete ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={13} />
          </Button>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-destructive font-medium">Delete?</span>
            <button
              onClick={onDelete}
              className="w-6 h-6 rounded flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Check size={11} />
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
            >
              <span className="text-sm leading-none">&times;</span>
            </button>
          </div>
        )}
      </div>

      {/* Key display */}
      <div className="flex items-center gap-2 bg-secondary rounded-md px-3 py-2 font-mono text-xs text-muted-foreground">
        <span className="flex-1 truncate">
          {revealed ? apiKey.key : maskKey(apiKey.key)}
        </span>
        <button
          onClick={() => setRevealed((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title={revealed ? "Hide" : "Reveal"}
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button
          onClick={handleCopy}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Copy"
        >
          {copied ? <Check size={13} className="ds-icon-success" /> : <Copy size={13} />}
        </button>
      </div>

      {/* Scopes */}
      <div className="flex flex-wrap gap-1.5">
        {apiKey.scopes.map((s) => (
          <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ApiPage() {
  const [keys, setKeys] = useState(INITIAL_KEYS)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["work_orders:read"])
  const [newKeyCreated, setNewKeyCreated] = useState<string | null>(null)

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  function createKey() {
    if (!newName.trim()) return
    const key = `eq_live_sk_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
    const newKey: ApiKey = {
      id: `k${Date.now()}`,
      name: newName.trim(),
      key,
      created: "Today",
      lastUsed: "Never",
      scopes: selectedScopes,
    }
    setKeys((prev) => [...prev, newKey])
    setNewKeyCreated(key)
    setNewName("")
    setSelectedScopes(["work_orders:read"])
    setCreateOpen(false)
  }

  function deleteKey(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Base URL */}
      <SettingCard title="API overview" description="Use the Equipify REST API to integrate with your existing tools and workflows.">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Base URL</p>
            <div className="flex items-center gap-2 bg-secondary rounded-md px-3 py-2 font-mono text-xs text-foreground">
              <span>https://api.equipify.ai/v1</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Code2 size={12} /> API Reference <ExternalLink size={10} />
            </a>
            <a
              href="#"
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Changelog <ExternalLink size={10} />
            </a>
            <a
              href="#"
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              SDKs <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </SettingCard>

      {/* API Keys */}
      <SettingCard
        title="API keys"
        description="Keys are shown only once on creation. Store them securely — we cannot recover them."
      >
        <div className="flex flex-col gap-3">
          {keys.map((key) => (
            <ApiKeyRow key={key.id} apiKey={key} onDelete={() => deleteKey(key.id)} />
          ))}

          {/* Create key form */}
          {createOpen ? (
            <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 flex flex-col gap-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">New API key</p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Key name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-base"
                  placeholder="e.g. Zapier automation"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Permissions (scopes)</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SCOPES.map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleScope(scope)}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md border transition-all",
                        selectedScopes.includes(scope)
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {selectedScopes.includes(scope) && <Check size={9} />}
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={createKey} disabled={!newName.trim() || selectedScopes.length === 0}>
                  <Plus size={13} /> Create key
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-dashed justify-center"
              onClick={() => { setCreateOpen(true); setNewKeyCreated(null) }}
            >
              <Plus size={13} /> Create new API key
            </Button>
          )}

          {/* Newly created key banner */}
          {newKeyCreated && (
            <div className="rounded-lg border ds-alert-success p-3 flex flex-col gap-1.5">
              <p className="text-xs font-semibold">Key created — copy it now</p>
              <p className="text-xs text-muted-foreground">This key will not be shown again.</p>
              <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 font-mono text-xs text-foreground border border-border">
                <span className="flex-1 truncate">{newKeyCreated}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(newKeyCreated)}
                  className="text-primary hover:text-primary/70"
                  title="Copy"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingCard>

      {/* Webhooks */}
      <SettingCard title="Webhooks" description="Receive real-time HTTP POST notifications when events occur in your workspace.">
        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted-foreground py-2">No webhooks configured yet.</div>
          <Button variant="outline" size="sm" className="gap-2 border-dashed w-fit">
            <Plus size={13} /> Add webhook endpoint
          </Button>
        </div>
      </SettingCard>
    </div>
  )
}
