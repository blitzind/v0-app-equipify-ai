import { AlertTriangle } from "lucide-react"
import { repeatRepairs } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"

export function RepeatRepairs() {
  return (
    <div className="bg-card rounded-xl border border-destructive/30 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="text-sm font-semibold text-foreground">Repeat Repair Alerts</h2>
        </div>
        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
          {repeatRepairs.length} flagged
        </Badge>
      </div>
      <ul className="divide-y divide-border">
        {repeatRepairs.map((item, i) => (
          <li key={i} className="px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.equipment}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.customer}</p>
                <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{item.issue}&rdquo;</p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
                  {item.repairs}x
                </span>
                <p className="text-[10px] text-muted-foreground mt-1">Last: {item.lastRepair}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
