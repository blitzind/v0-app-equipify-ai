"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import type { OrganizationDocumentBranding } from "@/lib/organization/document-branding"
import {
  DOCUMENT_LOGO_MAX_HEIGHT_PX,
  DOCUMENT_LOGO_MAX_WIDTH_PX,
  sanitizeCssAccentColor,
} from "@/lib/organization/document-branding"

export type OrganizationDocumentHeaderVariant = "default" | "minimal" | "bold"

type Props = {
  branding: OrganizationDocumentBranding
  variant?: OrganizationDocumentHeaderVariant
  /** Right-side column (e.g. document title + meta). */
  rightColumn?: React.ReactNode
  className?: string
}

/**
 * Customer-facing document header: document logo → app logo → organization name,
 * plus optional address / phone / email / website. Matches print/PDF HTML templates.
 */
export function OrganizationDocumentHeader({
  branding,
  variant = "default",
  rightColumn,
  className,
}: Props) {
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => {
    setLogoFailed(false)
  }, [branding.preferredLogoUrl])

  const orgName = branding.organizationName.trim() || "Organization"
  const showLogo = Boolean(branding.preferredLogoUrl?.trim()) && !logoFailed
  const addressLines = branding.companyAddress
    ? branding.companyAddress.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : []

  const accent = sanitizeCssAccentColor(branding.accentColor ?? null)
  const isBold = variant === "bold"
  const isMinimal = variant === "minimal"

  const bandStyle =
    isBold && accent ?
      { backgroundColor: accent }
    : undefined

  return (
    <div
      className={cn(
        "px-8 py-6",
        isBold && "text-white",
        isBold && !accent && "bg-[color:var(--primary)]",
        isMinimal && "border-b border-gray-200",
        !isBold && !isMinimal && "border-b-2",
        !isBold && !isMinimal && accent && "border-[color:var(--doc-accent,var(--primary))]",
        !isBold && !isMinimal && !accent && "border-[color:var(--primary)]",
        className,
      )}
      style={
        {
          ...(accent ? ({ ["--doc-accent" as string]: accent } as CSSProperties) : {}),
          ...bandStyle,
        } as CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={cn("mb-1", isBold && !accent ? "text-white" : "text-gray-900")}>
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic org branding URL
              <img
                src={branding.preferredLogoUrl!}
                alt=""
                width={DOCUMENT_LOGO_MAX_WIDTH_PX}
                height={DOCUMENT_LOGO_MAX_HEIGHT_PX}
                className="max-h-[48px] max-w-[280px] w-auto h-auto object-contain object-left block"
                style={{ maxHeight: DOCUMENT_LOGO_MAX_HEIGHT_PX, maxWidth: DOCUMENT_LOGO_MAX_WIDTH_PX }}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="text-sm font-bold">{orgName}</span>
            )}
          </div>
          {(addressLines.length > 0 ||
            branding.companyPhone?.trim() ||
            branding.companyEmail?.trim() ||
            branding.companyWebsite?.trim()) && (
            <div
              className={cn(
                "text-[10px] leading-relaxed space-y-0.5",
                isBold ? "text-white/80" : "text-gray-500",
              )}
            >
              {addressLines.map((line, i) => (
                <p key={i} className="m-0">
                  {line}
                </p>
              ))}
              {branding.companyPhone?.trim() ? <p className="m-0">{branding.companyPhone.trim()}</p> : null}
              {branding.companyEmail?.trim() ? <p className="m-0">{branding.companyEmail.trim()}</p> : null}
              {branding.companyWebsite?.trim() ? <p className="m-0">{branding.companyWebsite.trim()}</p> : null}
            </div>
          )}
        </div>
        {rightColumn ?
          <div className="text-right min-w-0">{rightColumn}</div>
        : null}
      </div>
    </div>
  )
}
