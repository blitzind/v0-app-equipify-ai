"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import type { WorkOrder } from "@/lib/mock-data"
import type { WorkOrderEquipmentAsset } from "@/lib/work-orders/detail-load"
import type { CompletionCertificateSlot } from "@/lib/work-orders/work-order-completion"
import {
  assignTemplateToWorkOrder,
  createCalibrationRecord,
  isCalibrationRecordComplete,
  listCalibrationTemplates,
  loadLatestCalibrationRecordForEquipment,
  type CalibrationTemplate,
} from "@/lib/calibration-certificates"
import {
  buildCertificatePrefillContextForEquipment,
  certificateFieldMapsEqual,
  seedCertificateValuesForWorkOrder,
} from "@/lib/calibration-templates/prefill-from-work-order"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { CertificateTabContent } from "@/components/work-orders/certificate-tab-content"
import { Badge } from "@/components/ui/badge"

type SlotState = {
  templateId: string
  values: Record<string, unknown>
  baseline: Record<string, unknown>
  savedAt: string | null
  recordId: string | null
  prefillNotice: boolean
}

export type CertificateMultiTabContentProps = {
  organizationId: string | null | undefined
  workOrder: WorkOrder
  equipmentAssets: WorkOrderEquipmentAsset[]
  onCompletionSlotsChange?: (slots: CompletionCertificateSlot[]) => void
  /** When set after certificates finish loading, scroll to that asset card (e.g. from Overview actions). */
  focusEquipmentId?: string | null
  onFocusEquipmentApplied?: () => void
}

function assetLabel(a: WorkOrderEquipmentAsset): string {
  return getEquipmentDisplayPrimary({
    id: a.id,
    name: a.name,
    equipment_code: a.equipmentCode,
    serial_number: a.serialNumber,
    category: a.category,
  })
}

function statusLabel(
  template: CalibrationTemplate | null,
  savedAt: string | null,
  values: Record<string, unknown>,
): "Not Started" | "In Progress" | "Completed" {
  if (!savedAt) return "Not Started"
  if (template && isCalibrationRecordComplete(template, values)) return "Completed"
  return "In Progress"
}

function statusBadgeClass(label: "Not Started" | "In Progress" | "Completed"): string {
  if (label === "Completed") return "border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
  if (label === "In Progress") return "border-amber-500/40 text-amber-800 dark:text-amber-200"
  return "border-border text-muted-foreground"
}

export function CertificateMultiTabContent({
  organizationId,
  workOrder,
  equipmentAssets,
  onCompletionSlotsChange,
  focusEquipmentId,
  onFocusEquipmentApplied,
}: CertificateMultiTabContentProps) {
  const orgId = organizationId?.trim() ?? ""
  const [templates, setTemplates] = useState<CalibrationTemplate[]>([])
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({})
  const [initBusy, setInitBusy] = useState(true)
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null)
  const touchedRef = useRef<Record<string, Set<string>>>({})

  const equipmentKey = equipmentAssets.map((a) => a.id).join(",")

  useEffect(() => {
    if (initBusy || !focusEquipmentId) return
    if (!equipmentAssets.some((a) => a.id === focusEquipmentId)) return
    const el = document.getElementById(`wo-cert-asset-${focusEquipmentId}`)
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    onFocusEquipmentApplied?.()
  }, [focusEquipmentId, initBusy, equipmentAssets, equipmentKey, onFocusEquipmentApplied])

  useEffect(() => {
    if (!orgId || equipmentAssets.length === 0) {
      setInitBusy(false)
      setTemplates([])
      setSlotStates({})
      return
    }
    let cancelled = false
    setInitBusy(true)
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      try {
        const tmplList = await listCalibrationTemplates(supabase, orgId)
        if (cancelled) return
        setTemplates(tmplList)
        const next: Record<string, SlotState> = {}
        for (const asset of equipmentAssets) {
          const record = await loadLatestCalibrationRecordForEquipment(
            supabase,
            orgId,
            workOrder.id,
            asset.id,
          )
          const selectedId =
            record?.templateId ??
            workOrder.calibrationTemplateId ??
            (asset.category
              ? tmplList.find((t) => t.equipmentCategoryId === asset.category)?.id
              : null) ??
            tmplList[0]?.id ??
            ""
          const templateObj = tmplList.find((t) => t.id === selectedId) ?? null
          const ctx = buildCertificatePrefillContextForEquipment(workOrder, asset)
          const seeded = seedCertificateValuesForWorkOrder(
            templateObj,
            record?.values ?? null,
            ctx,
          )
          touchedRef.current[asset.id] = new Set()
          next[asset.id] = {
            templateId: selectedId,
            values: seeded.values,
            baseline: structuredClone(seeded.values),
            savedAt: record?.createdAt ?? null,
            recordId: record?.id ?? null,
            prefillNotice: seeded.hadPrefill,
          }
        }
        if (cancelled) return
        setSlotStates(next)
      } catch {
        if (!cancelled) {
          setTemplates([])
          setSlotStates({})
        }
      } finally {
        if (!cancelled) setInitBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, workOrder.id, workOrder.calibrationTemplateId, equipmentKey, equipmentAssets])

  const emitCompletion = useCallback(() => {
    if (!onCompletionSlotsChange) return
    const slots: CompletionCertificateSlot[] = equipmentAssets.map((asset) => {
      const st = slotStates[asset.id]
      const tmpl = st ? templates.find((t) => t.id === st.templateId) ?? null : null
      return {
        equipmentId: asset.id,
        equipmentLabel: assetLabel(asset),
        template: tmpl,
        savedAt: st?.savedAt ?? null,
        values: st?.values ?? {},
      }
    })
    onCompletionSlotsChange(slots)
  }, [equipmentAssets, onCompletionSlotsChange, slotStates, templates])

  useEffect(() => {
    emitCompletion()
  }, [emitCompletion])

  async function handleTemplateChange(assetId: string, templateId: string) {
    if (!orgId) return
    const st = slotStates[assetId]
    if (!st) return
    if (!certificateFieldMapsEqual(st.values, st.baseline)) {
      if (
        !window.confirm(
          "You have unsaved changes to certificate fields. Switch template and discard them?",
        )
      ) {
        return
      }
    }
    const supabase = createBrowserSupabaseClient()
    try {
      await assignTemplateToWorkOrder(supabase, orgId, workOrder.id, templateId || null)
      const selected = templates.find((t) => t.id === templateId) ?? null
      touchedRef.current[assetId] = new Set()
      const ctx = buildCertificatePrefillContextForEquipment(
        workOrder,
        equipmentAssets.find((a) => a.id === assetId)!,
      )
      const seeded = seedCertificateValuesForWorkOrder(selected, null, ctx)
      setSlotStates((prev) => ({
        ...prev,
        [assetId]: {
          ...prev[assetId],
          templateId,
          values: seeded.values,
          baseline: structuredClone(seeded.values),
          savedAt: null,
          recordId: null,
          prefillNotice: seeded.hadPrefill,
        },
      }))
    } catch {
      /* toast optional — parent may show */
    }
  }

  async function handleSave(assetId: string) {
    if (!orgId) return
    const st = slotStates[assetId]
    if (!st?.templateId) return
    const supabase = createBrowserSupabaseClient()
    setSavingAssetId(assetId)
    try {
      const snapshot = structuredClone(st.values)
      const record = await createCalibrationRecord(
        supabase,
        orgId,
        workOrder.id,
        assetId,
        st.templateId,
        snapshot,
      )
      setSlotStates((prev) => ({
        ...prev,
        [assetId]: {
          ...prev[assetId],
          savedAt: record.createdAt,
          recordId: record.id,
          baseline: snapshot,
        },
      }))
    } finally {
      setSavingAssetId(null)
    }
  }

  const summary = useMemo(() => {
    if (equipmentAssets.length === 0) return "No equipment on this work order."
    return `${equipmentAssets.length} certificate${equipmentAssets.length === 1 ? "" : "s"} — one card per asset. Use Print / PDF or HTML after selecting a template.`
  }, [equipmentAssets.length])

  if (!orgId) {
    return <p className="text-sm text-muted-foreground">Select an organization to manage certificates.</p>
  }

  if (initBusy) {
    return <p className="text-sm text-muted-foreground">Loading certificates…</p>
  }

  if (equipmentAssets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No equipment linked. Add assets on the work order when editing multiple equipment is enabled.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{summary}</p>
      <div className="space-y-4">
        {equipmentAssets.map((asset) => {
          const st = slotStates[asset.id]
          const tmpl = st ? templates.find((t) => t.id === st.templateId) ?? null : null
          const label = statusLabel(tmpl, st?.savedAt ?? null, st?.values ?? {})
          const code = (asset.equipmentCode ?? "").trim() || "—"
          const sn = (asset.serialNumber ?? "").trim() || "—"

          return (
            <div
              key={asset.id}
              id={`wo-cert-asset-${asset.id}`}
              className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden"
            >
              <div className="border-b border-border/80 bg-muted/20 px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground leading-snug">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Asset # <span className="font-mono">{code}</span>
                      <span className="mx-1.5 text-border">·</span>
                      Serial <span className="font-mono">{sn}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Template: <span className="font-medium text-foreground">{tmpl?.name ?? "—"}</span>
                      <span className="mx-2 text-border">·</span>
                      Last saved:{" "}
                      <span className="font-medium text-foreground">
                        {st?.savedAt ? fmtDateTime(st.savedAt) : "—"}
                      </span>
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", statusBadgeClass(label))}>
                    {label}
                  </Badge>
                </div>
              </div>
              <div className="p-3 sm:p-4">
                {st ? (
                  <CertificateTabContent
                    embedded
                    organizationId={orgId}
                    workOrderId={workOrder.id}
                    equipmentScopeId={asset.id}
                    templates={templates}
                    selectedTemplateId={st.templateId}
                    onTemplateChange={(tid) => void handleTemplateChange(asset.id, tid)}
                    values={st.values}
                    onValueChange={(fieldId, value) => {
                      touchedRef.current[asset.id]?.add(fieldId)
                      setSlotStates((prev) => ({
                        ...prev,
                        [asset.id]: {
                          ...prev[asset.id],
                          values: { ...prev[asset.id].values, [fieldId]: value },
                        },
                      }))
                    }}
                    onSave={() => void handleSave(asset.id)}
                    saveBusy={savingAssetId === asset.id}
                    lastSavedAt={st.savedAt}
                    companyName="Equipify Service Co."
                    workOrderLabel={getWorkOrderDisplay(workOrder)}
                    customerName={workOrder.customerName}
                    equipmentName={asset.name}
                    workOrderDescription={workOrder.description}
                    equipmentDetails={
                      workOrder.location ? `Location: ${workOrder.location}` : undefined
                    }
                    serviceLocation={workOrder.location || undefined}
                    equipmentCode={asset.equipmentCode ?? null}
                    equipmentSerialNumber={asset.serialNumber ?? null}
                    calibrationRecordId={st.recordId}
                    serviceDateLabel={
                      workOrder.completedDate
                        ? fmtShort(workOrder.completedDate)
                        : workOrder.scheduledDate
                          ? fmtShort(workOrder.scheduledDate)
                          : null
                    }
                    technicianNotes={workOrder.repairLog.technicianNotes}
                    technicianSignedDateLabel={
                      workOrder.repairLog.signedAt?.trim()
                        ? fmtShort(workOrder.repairLog.signedAt.slice(0, 10))
                        : workOrder.completedDate
                          ? fmtShort(workOrder.completedDate)
                          : null
                    }
                    customerSignedDateLabel={
                      workOrder.customerSignatureCapturedAt
                        ? fmtShort(workOrder.customerSignatureCapturedAt.slice(0, 10))
                        : null
                    }
                    technicianName={workOrder.technicianName}
                    customerSignatureUrl={workOrder.customerSignaturePreviewUrl}
                    customerSignedBy={workOrder.repairLog.signedBy || null}
                    technicianSignatureDataUrl={
                      workOrder.repairLog.signatureDataUrl?.startsWith("data") ||
                      workOrder.repairLog.signatureDataUrl?.startsWith("http")
                        ? workOrder.repairLog.signatureDataUrl
                        : null
                    }
                    completedAtLabel={workOrder.completedDate ? fmtShort(workOrder.completedDate) : null}
                    manageTemplatesHref="/calibration-templates"
                    showPrefillHelper={st.prefillNotice}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading asset certificate…</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmtShort(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtDateTime(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
