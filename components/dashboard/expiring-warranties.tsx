import { ShieldAlert } from "lucide-react"
import { expiringWarranties } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function ExpiringWarranties() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[oklch(0.72_0.17_70)]" />
          <h2 className="text-sm font-semibold text-foreground">Expiring Warranties</h2>
        </div>
        <button className="text-xs font-medium text-primary hover:underline transition-colors">Manage</button>
      </div>
      {expiringWarranties.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <ShieldAlert className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No warranties expiring soon</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {expiringWarranties.map((item, i) => {
            const urgent = item.daysLeft <= 15
            return (
              <li
                key={i}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer group transition-colors duration-100"
                style={{ backgroundColor: "var(--card)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in oklch, var(--primary) 3%, var(--card))")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold shrink-0 ds-tabular",
                  "transition-transform duration-150 group-hover:scale-105",
                  urgent
                    ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
                    : "bg-[oklch(0.75_0.16_70)]/10 text-[oklch(0.50_0.12_70)]"
                )}>
                  {item.daysLeft}d
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.equipment}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.customer}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Expires</p>
                  <p className={cn("text-xs font-semibold ds-tabular mt-0.5", urgent ? "text-destructive" : "text-foreground")}>{item.expires}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
