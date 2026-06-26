"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function GrowthAiOsOperationsSectionCard({
  title,
  description,
  icon,
  qaSection,
  children,
  className,
  id,
}: {
  title: string
  description?: string
  icon?: ReactNode
  qaSection: string
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <Card className={className} data-qa-section={qaSection} id={id}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
