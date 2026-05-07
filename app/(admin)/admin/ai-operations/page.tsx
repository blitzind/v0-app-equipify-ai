import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { AiOperationsContent } from "@/components/admin/ai-operations-content"

export default function AiOperationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center h-14 px-6 bg-[#0F172A] border-b border-white/10 gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <BrandLogo className="h-7 w-auto max-h-7" priority />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-200 border border-violet-400/25">
            AI Operations
          </span>
        </div>
        <div className="flex-1" />
        <Link
          href="/admin"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Platform Admin
        </Link>
        <Link
          href="/admin/master-context"
          className="hidden sm:inline-flex text-xs text-slate-400 hover:text-white transition-colors"
        >
          Master Context
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          App <ChevronRight size={12} />
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        <AiOperationsContent />
      </div>
    </div>
  )
}
