"use client"

import Link from "next/link"
import { Upload, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SettingsImportsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Data imports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bring structured vendor data into Equipify. Imports are scoped to your active workspace.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Price list importer</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload PDF manufacturer price lists (e.g. equipment, accessories, services). AI extracts rows for review—you approve before anything is saved to your catalog.
        </p>
        <Button asChild className="w-fit gap-2 mt-1">
          <Link href="/catalog/import">
            Open import flow <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Manage imported catalog lines under{" "}
        <Link href="/catalog" className="text-primary underline font-medium">
          Catalog
        </Link>
        .
      </p>
    </div>
  )
}
