"use client"

import { useState } from "react"
import {
  User, Mail, Phone, Briefcase, MapPin, Bell, Plus,
  Pencil, Trash2, Save, X, Check,
} from "lucide-react"
import { customers } from "@/lib/mock-data"
import type { Customer, Contact } from "@/lib/mock-data"

const CUSTOMER_ID = "CUS-001"
const customer = customers.find((c) => c.id === CUSTOMER_ID)!


function ContactCard({
  contact,
  onSave,
  onDelete,
}: {
  contact: Contact
  onSave: (updated: Contact) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Contact>({ ...contact })

  function set(k: keyof Contact, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function save() {
    onSave(form)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="portal-card p-5 space-y-4"
        style={{ borderColor: "var(--portal-accent)", boxShadow: "0 0 0 2px #2563eb1a" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>Name</label>
            <input type="text" className="portal-input" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>Role</label>
            <input type="text" className="portal-input" value={form.role} onChange={e => set("role", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>Email</label>
            <input type="email" className="portal-input" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>Phone</label>
            <input type="tel" className="portal-input" value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="portal-btn-secondary" onClick={() => setEditing(false)}>
            <X size={13} /> Cancel
          </button>
          <button className="portal-btn-primary" onClick={save}>
            <Save size={13} /> Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-card p-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold shrink-0 text-white"
          style={{ background: "var(--portal-accent)" }}>
          {form.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>{form.name}</p>
          <p className="text-xs" style={{ color: "var(--portal-nav-text)" }}>{form.role}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--portal-secondary)" }}>
              <Mail size={11} />{form.email}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--portal-secondary)" }}>
              <Phone size={11} />{form.phone}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-[var(--portal-hover)]">
          <Pencil size={13} style={{ color: "var(--portal-nav-icon)" }} />
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-[var(--portal-danger-muted)]">
          <Trash2 size={13} style={{ color: "var(--portal-danger)" }} />
        </button>
      </div>
    </div>
  )
}

export default function PortalAccountPage() {
  const [contacts, setContacts] = useState<Contact[]>([...customer.contacts])
  const [addingNew, setAddingNew] = useState(false)
  const [newContact, setNewContact] = useState<Contact>({
    name: "", role: "", email: "", phone: "",
  })
  const [saved, setSaved] = useState(false)

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState({
    workOrderUpdates: true,
    invoiceReady: true,
    quoteReady: true,
    serviceReminders: true,
    marketingEmails: false,
    smsAlerts: false,
  })

  function togglePref(k: keyof typeof notifPrefs) {
    setNotifPrefs(p => ({ ...p, [k]: !p[k] }))
  }

  function addContact() {
    setContacts(c => [...c, { ...newContact }])
    setNewContact({ name: "", role: "", email: "", phone: "" })
    setAddingNew(false)
  }

  function showSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--portal-foreground)" }}>Account &amp; Contacts</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--portal-nav-text)" }}>
          Manage your company profile, contacts, and notification preferences
        </p>
      </div>

      {/* Company info */}
      <section className="portal-card p-6">
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--portal-foreground)" }}>Company Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Company Name", value: customer.company, icon: Briefcase },
            { label: "Account Number", value: customer.id, icon: User },
            { label: "Primary Contact", value: customer.contacts[0]?.name ?? "—", icon: User },
            { label: "Primary Email", value: customer.contacts[0]?.email ?? "—", icon: Mail },
            { label: "Primary Phone", value: customer.contacts[0]?.phone ?? "—", icon: Phone },
            { label: "Main Location", value: customer.locations[0] ? `${customer.locations[0].address}, ${customer.locations[0].city}, ${customer.locations[0].state}` : "—", icon: MapPin },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <p className="text-xs mb-1 flex items-center gap-1" style={{ color: "var(--portal-nav-text)" }}>
                <Icon size={11} /> {label}
              </p>
              <p className="text-sm font-medium" style={{ color: "var(--portal-secondary)" }}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t flex items-center gap-2" style={{ borderColor: "var(--portal-border-light)" }}>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "var(--portal-success-muted)", color: "var(--portal-success)" }}>
            {customer.status}
          </span>
          <span className="text-xs" style={{ color: "var(--portal-nav-text)" }}>
            Customer since {new Date(customer.joinedDate).getFullYear()} &bull; {customer.equipmentCount} units registered
          </span>
        </div>
      </section>

      {/* Contacts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Contacts</h2>
          <button
            onClick={() => setAddingNew(true)}
            className="portal-btn-secondary text-xs">
            <Plus size={13} /> Add Contact
          </button>
        </div>

        <div className="space-y-3">
          {contacts.map((c, i) => (
            <ContactCard
              key={c.id || i}
              contact={c}
              onSave={(updated) => setContacts(contacts.map((x, j) => j === i ? updated : x))}
              onDelete={() => setContacts(contacts.filter((_, j) => j !== i))}
            />
          ))}
        </div>

        {addingNew && (
          <div className="portal-card p-5 mt-3 space-y-4"
            style={{ borderColor: "var(--portal-accent)", boxShadow: "0 0 0 2px #2563eb1a" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>New Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { k: "name", label: "Name", type: "text" },
                { k: "role", label: "Role", type: "text" },
                { k: "email", label: "Email", type: "email" },
                { k: "phone", label: "Phone", type: "tel" },
              ].map(({ k, label, type }) => (
                <div key={k}>
                  <label className="block text-xs mb-1" style={{ color: "var(--portal-nav-text)" }}>{label}</label>
                  <input type={type} className="portal-input"
                    value={(newContact as unknown as Record<string, string>)[k]}
                    onChange={e => setNewContact(n => ({ ...n, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button className="portal-btn-secondary" onClick={() => setAddingNew(false)}>
                <X size={13} /> Cancel
              </button>
              <button className="portal-btn-primary" onClick={addContact}
                disabled={!newContact.name || !newContact.email}
                style={{ opacity: !newContact.name || !newContact.email ? 0.5 : 1 }}>
                <Plus size={13} /> Add Contact
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Notification preferences */}
      <section className="portal-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={15} style={{ color: "var(--portal-accent)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--portal-foreground)" }}>Notification Preferences</h2>
        </div>
        <div className="space-y-3">
          {(Object.entries({
            workOrderUpdates: "Work order status updates",
            invoiceReady:     "New invoices ready for review",
            quoteReady:       "New quotes requiring approval",
            serviceReminders: "Upcoming service reminders",
            smsAlerts:        "SMS alerts for critical updates",
            marketingEmails:  "Product updates and newsletters",
          }) as [keyof typeof notifPrefs, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-2 border-b last:border-b-0"
              style={{ borderColor: "var(--portal-border-light)" }}>
              <p className="text-sm" style={{ color: "var(--portal-secondary)" }}>{label}</p>
              <button
                onClick={() => togglePref(key)}
                className="relative w-10 h-5 rounded-full transition-colors"
                style={{ background: notifPrefs[key] ? "var(--portal-accent)" : "var(--portal-border)" }}
                role="switch"
                aria-checked={notifPrefs[key]}>
                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
                  style={{ transform: notifPrefs[key] ? "translateX(20px)" : "translateX(0)" }} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm"
            style={{ color: "var(--portal-success)", opacity: saved ? 1 : 0, transition: "opacity 0.3s" }}>
            <Check size={14} /> Preferences saved
          </div>
          <button className="portal-btn-primary" onClick={showSaved}>
            <Save size={13} /> Save Preferences
          </button>
        </div>
      </section>
    </div>
  )
}
