import type { CalibrationTemplate } from "@/lib/calibration-certificates"
import { isCalibrationRecordComplete } from "@/lib/calibration-certificates"

/** One equipment asset’s certificate state for close-out validation (multi-asset work orders). */
export type CompletionCertificateSlot = {
  equipmentId: string
  equipmentLabel: string
  template: CalibrationTemplate | null
  savedAt: string | null
  values: Record<string, unknown>
}

/** Require a saved, complete certificate row for every asset when a template is assigned on the WO. */
export function certificateGateForCompletionAllAssets(args: {
  calibrationTemplateId: string | null | undefined
  slots: CompletionCertificateSlot[]
}): { ok: boolean; message?: string } {
  const tid = args.calibrationTemplateId?.trim()
  if (!tid) return { ok: true }
  if (args.slots.length === 0) {
    return {
      ok: false,
      message: "Certificate equipment is still loading. Wait a moment and try again.",
    }
  }
  for (const slot of args.slots) {
    if (!slot.savedAt) {
      return {
        ok: false,
        message: `Save the certificate for ${slot.equipmentLabel} before completing this work order.`,
      }
    }
    const tmpl = slot.template
    if (!tmpl) {
      return {
        ok: false,
        message: `Select a certificate template for ${slot.equipmentLabel} and save.`,
      }
    }
    if (!isCalibrationRecordComplete(tmpl, slot.values)) {
      return {
        ok: false,
        message: `Complete all required certificate fields for ${slot.equipmentLabel} before completing this work order.`,
      }
    }
  }
  return { ok: true }
}

export function certificateGateForCompletion(args: {
  calibrationTemplateId: string | null | undefined
  assignedTemplate: CalibrationTemplate | null | undefined
  certificateSavedAt: string | null | undefined
  certificateValues: Record<string, unknown>
}): { ok: boolean; message?: string } {
  const tid = args.calibrationTemplateId?.trim()
  if (!tid) return { ok: true }

  const tmpl = args.assignedTemplate
  if (!tmpl) {
    return {
      ok: false,
      message:
        "A certificate template is assigned but could not be loaded. Refresh the page and try again.",
    }
  }
  if (!args.certificateSavedAt) {
    return {
      ok: false,
      message: "Save the certificate on the Certificate tab before completing this work order.",
    }
  }
  if (!isCalibrationRecordComplete(tmpl, args.certificateValues)) {
    return {
      ok: false,
      message: "Complete all required certificate fields before completing this work order.",
    }
  }
  return { ok: true }
}

export function customerSignatureCaptured(wo: {
  customerSignaturePreviewUrl?: string | null
  customerSignatureCapturedAt?: string | null
}): boolean {
  return Boolean(wo.customerSignaturePreviewUrl?.trim() || wo.customerSignatureCapturedAt)
}
