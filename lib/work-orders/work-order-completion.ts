import type { CalibrationTemplate } from "@/lib/calibration-certificates"
import { isCalibrationRecordComplete } from "@/lib/calibration-certificates"

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
