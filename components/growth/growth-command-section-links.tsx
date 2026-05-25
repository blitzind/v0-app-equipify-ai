import Link from "next/link"
import type { GrowthCommandNavLink } from "@/lib/growth/command/command-center-navigation"

type GrowthCommandSectionLinksProps = {
  links: readonly GrowthCommandNavLink[]
  className?: string
}

export function GrowthCommandSectionLinks({ links, className }: GrowthCommandSectionLinksProps) {
  if (links.length === 0) return null

  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Open section</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {links.map((link) => (
          <Link key={link.href + link.label} href={link.href} className="text-sm text-indigo-600 hover:underline">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
