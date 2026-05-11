export type TechnicianSignatureSource =
  | "fresh_capture"
  | "stored_profile"
  | "generated_label"
  | "unsigned"

export type TechnicianSignatureState = {
  source: TechnicianSignatureSource
  label: string
  caption: string
  imageUrl: string | null
  hasImage: boolean
  fallbackUsed: boolean
  tone: "success" | "warning" | "muted"
}

function usableSignatureImage(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ""
  if (!value) return null
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value
  }
  return null
}

export function resolveTechnicianSignatureState(args: {
  technicianName?: string | null
  freshSignatureDataUrl?: string | null
  storedSignatureUrl?: string | null
  storedSignatureUpdatedAt?: string | null
}): TechnicianSignatureState {
  const fresh = usableSignatureImage(args.freshSignatureDataUrl)
  if (fresh) {
    return {
      source: "fresh_capture",
      label: "Fresh signature captured",
      caption: "This visit signature will be used on generated certificates.",
      imageUrl: fresh,
      hasImage: true,
      fallbackUsed: false,
      tone: "success",
    }
  }

  const stored = usableSignatureImage(args.storedSignatureUrl)
  if (stored) {
    return {
      source: "stored_profile",
      label: "Stored signature available",
      caption: args.storedSignatureUpdatedAt
        ? "Using the technician signature saved on their profile."
        : "Using the technician signature saved on their profile.",
      imageUrl: stored,
      hasImage: true,
      fallbackUsed: true,
      tone: "success",
    }
  }

  const techName = args.technicianName?.trim()
  if (techName && techName.toLowerCase() !== "unassigned") {
    return {
      source: "generated_label",
      label: "Fallback signature label",
      caption: "No signature image is available; the certificate will show a signature-on-file label.",
      imageUrl: null,
      hasImage: false,
      fallbackUsed: true,
      tone: "warning",
    }
  }

  return {
    source: "unsigned",
    label: "No signature available",
    caption: "Assign a technician or add a stored signature before generating signed certificates.",
    imageUrl: null,
    hasImage: false,
    fallbackUsed: true,
    tone: "warning",
  }
}

export function technicianSignatureSourceLabel(source: TechnicianSignatureSource | string | null | undefined): string {
  switch (source) {
    case "fresh_capture":
      return "Fresh visit signature"
    case "stored_profile":
      return "Stored technician signature"
    case "generated_label":
      return "Signature-on-file label"
    case "unsigned":
      return "Unsigned"
    default:
      return "Unknown signature source"
  }
}
