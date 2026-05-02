"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ArrowRight, ArrowLeft, Building2, User, CreditCard } from "lucide-react"
import { PLANS } from "@/lib/plans"
import { BrandLogoOnLight } from "@/components/brand-logo"

const STEPS = ["Your account", "Workspace", "Choose a plan"]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [billing, setBilling] = useState<"monthly" | "annual">("annual")
  const [selectedPlan, setSelectedPlan] = useState("growth")
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "",
    companyName: "", industry: "", teamSize: "", timezone: "America/New_York",
  })

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else router.push("/")
  }
  function back() { setStep((s) => Math.max(0, s - 1)) }

  const price = (plan: typeof PLANS[0]) =>
    billing === "annual" ? plan.priceAnnual : plan.priceMonthly

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f6f8" }}>
      {/* Top bar */}
      <header className="h-14 flex items-center justify-between px-6 border-b bg-white" style={{ borderColor: "#e5e7eb" }}>
        <BrandLogoOnLight />
        <p className="text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium" style={{ color: "#2563eb" }}>Sign in</Link>
        </p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start py-12 px-4">
        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${i < step ? "bg-blue-600 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-xs mt-1.5 whitespace-nowrap ${i === step ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-24 h-px mx-2 mb-4 transition-colors ${i < step ? "bg-blue-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="w-full" style={{ maxWidth: step === 2 ? 860 : 480 }}>
          {/* Step 0 — Account */}
          {step === 0 && (
            <div className="bg-white rounded-xl border p-8" style={{ borderColor: "#e5e7eb" }}>
              <div className="flex items-center gap-2 mb-6">
                <User size={18} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Create your account</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([["firstName", "First name"], ["lastName", "Last name"]] as const).map(([k, label]) => (
                  <div key={k}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                    <input value={form[k]} onChange={(e) => setField(k, e.target.value)}
                      className="portal-input" placeholder={label} />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email</label>
                <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)}
                  className="portal-input" placeholder="you@company.com" />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={(e) => setField("password", e.target.value)}
                  className="portal-input" placeholder="Min. 8 characters" />
                <p className="text-xs text-gray-400 mt-1">Use at least 8 characters with a mix of letters, numbers, and symbols.</p>
              </div>
              <button onClick={next} className="portal-btn-primary w-full justify-center h-10 mt-6">
                Continue <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Step 1 — Workspace */}
          {step === 1 && (
            <div className="bg-white rounded-xl border p-8" style={{ borderColor: "#e5e7eb" }}>
              <div className="flex items-center gap-2 mb-6">
                <Building2 size={18} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Set up your workspace</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
                  <input value={form.companyName} onChange={(e) => setField("companyName", e.target.value)}
                    className="portal-input" placeholder="Acme Field Services" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
                    <select value={form.industry} onChange={(e) => setField("industry", e.target.value)}
                      className="portal-select">
                      <option value="">Select industry</option>
                      {["HVAC", "Elevators & Lifts", "Industrial Equipment", "Construction", "Material Handling", "Refrigeration", "Other"].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Team size</label>
                    <select value={form.teamSize} onChange={(e) => setField("teamSize", e.target.value)}
                      className="portal-select">
                      <option value="">Select size</option>
                      {["1–5", "6–15", "16–50", "51–200", "200+"].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                  <select value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}
                    className="portal-select">
                    {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "Europe/London"].map((tz) => (
                      <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={back} className="portal-btn-secondary h-10 px-4">
                  <ArrowLeft size={15} /> Back
                </button>
                <button onClick={next} className="portal-btn-primary flex-1 justify-center h-10">
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Plan */}
          {step === 2 && (
            <div>
              <div className="text-center mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={18} className="text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Choose a plan</h2>
                </div>
                <p className="text-sm text-gray-500">Start with a 14-day free trial. No credit card required.</p>
                {/* Billing toggle */}
                <div className="inline-flex items-center gap-1 mt-4 p-1 rounded-lg border bg-white" style={{ borderColor: "#e5e7eb" }}>
                  {(["monthly", "annual"] as const).map((cycle) => (
                    <button key={cycle} onClick={() => setBilling(cycle)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${billing === cycle ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                      {cycle === "monthly" ? "Monthly" : "Annual"}
                      {cycle === "annual" && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Save 20%</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {PLANS.map((plan) => {
                  const selected = selectedPlan === plan.id
                  const monthly = price(plan)
                  return (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                      className={`text-left p-6 rounded-xl border-2 bg-white transition-all relative ${selected ? "border-blue-600 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
                      {plan.badge && (
                        <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-600 text-white">
                          {plan.badge}
                        </span>
                      )}
                      {selected && (
                        <div className="absolute top-4 left-4 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                      <h3 className="font-semibold text-gray-900 mt-4 mb-1">{plan.name}</h3>
                      <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-gray-900">${(monthly / 100).toFixed(0)}</span>
                        <span className="text-sm text-gray-500">/mo</span>
                        {billing === "annual" && (
                          <p className="text-xs text-gray-400 mt-0.5">billed ${((monthly * 12) / 100).toFixed(0)}/yr</p>
                        )}
                      </div>
                      <ul className="space-y-2">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                            <Check size={12} className="text-blue-600 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3 max-w-md mx-auto">
                <button onClick={back} className="portal-btn-secondary h-10 px-5">
                  <ArrowLeft size={15} /> Back
                </button>
                <button onClick={next} className="portal-btn-primary flex-1 justify-center h-10">
                  Start free trial <ArrowRight size={15} />
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 mt-4">
                14-day free trial &bull; Cancel any time &bull; No credit card required
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
