/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A — Curated Equipify Operations seller knowledge seed.
 * Merged into Approved Business Profile; never a parallel runtime store.
 */

import {
  EQUIPIFY_MASTER_KNOWLEDGE_VERSION,
  type EquipifyCanonicalSellerKnowledge,
} from "@/lib/growth/business-profile/equipify-master-knowledge-types"

const CURRENT_PLATFORM_SUMMARY =
  "Multi-tenant field-service operations platform for commercial equipment businesses: customers, assets, work orders, scheduling, maintenance plans, quotes/invoices, inventory/parts, technician workflows, certificates/calibration, customer portal, and platform admin."

export const EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE: EquipifyCanonicalSellerKnowledge = {
  version: EQUIPIFY_MASTER_KNOWLEDGE_VERSION,
  company: {
    mission:
      "Help equipment-service organizations run cleaner revenue and operations workflows — from lead discovery through work orders, dispatch, and customer equipment history.",
    vision:
      "Every equipment-service business operates with the clarity of an elite operator: visible work, accountable teams, and trustworthy customer communication.",
    values: [
      "Evidence before assumptions",
      "Consult before selling",
      "Long-term trust over short-term wins",
      "Outcomes over feature lists",
      "Respect the prospect's time",
    ],
    salesPhilosophy: [
      "Never oversell",
      "Never invent pain or urgency",
      "Never exaggerate capabilities",
      "Recommend against Equipify when the fit is weak",
      "Educate before recommending",
    ],
    businessPhilosophy: [
      "Sell to organizations with real field service or maintenance operations",
      "Ground every conversation in verified operational evidence",
      "Diagnose workflow friction before proposing modules",
      "Treat pricing as a tailored conversation, not a catalog quote",
    ],
    targetCustomer:
      "Organizations that employ technicians to maintain, repair, inspect, install, or service physical equipment — especially those with recurring work orders, field dispatch, preventive maintenance, equipment history, quoting, invoicing, and service-contract needs.",
    poorFitCustomer:
      "Pure retail, ecommerce, marketing agencies, professional services without field operations, software companies without equipment-service operations, restaurants without a service division, general construction without ongoing maintenance, manufacturers with no maintenance or service operation.",
    differentiators: [
      "Built for equipment-centric service operators, not generic CRM workflows",
      "Unified dispatch-to-cash rhythm: work orders, scheduling, quotes, invoices, and customer communication",
      "AI OS layer for revenue operations grounded in verified company evidence",
      "Calibration/certificates and customer portal for regulated or asset-heavy service models",
    ],
    uniqueStrengths: [
      "Deep work-order lifecycle with technician mobile workflows",
      "Maintenance plans and equipment history tied to service delivery",
      "Customer portal for service visibility without exposing dispatch internals",
      "QuickBooks integration for finance handoff",
    ],
    limitations: [
      "Not a generic ERP replacement for complex manufacturing production",
      "Not designed for pure inside-sales SaaS motions without field technicians",
      "Implementation scope varies — timelines depend on data migration and workflow complexity",
      "Pricing requires a tailored conversation; no public list pricing in outreach",
    ],
    whenNotToRecommend: [
      "No technicians or field service personnel",
      "No work orders, dispatch, or recurring service workflows",
      "No equipment or asset servicing motion",
      "Organization is seeking marketing automation only",
      "Prospect needs are entirely outside operations (e.g., pure accounting replacement with no service ops)",
    ],
    implementationPhilosophy:
      "Roll out in phases aligned to operational priority — data setup, workflow configuration, and team training. Start where dispatch-to-cash friction is highest; expand after adoption proves value.",
    businessOutcomes: [
      "Fewer missed preventive maintenance visits",
      "Faster dispatch-to-invoice cycles",
      "Better technician utilization and route clarity",
      "Clearer customer-owned equipment history",
      "Less manual follow-up on service contracts",
    ],
    operationalImprovements: [
      "Replace spreadsheet dispatch boards with live work-order status",
      "Connect quotes to work orders without re-keying",
      "Give technicians mobile access to job context in the field",
      "Release calibration certificates and documents through customer portal when appropriate",
    ],
    currentRoadmapNote:
      "Current platform includes work orders, scheduling, maintenance plans, quotes/invoices, inventory, technician workflows, certificates/calibration, customer portal, QuickBooks export, and AI OS growth operator capabilities.",
    futureRoadmapNote:
      "Future roadmap items must never be represented as current functionality in outreach or demos.",
  },
  products: {
    platformName: "Equipify Operations",
    modules: [
      {
        feature: "Work orders",
        purpose: "Track the full job lifecycle from assignment through completion",
        businessProblemSolved: "Office and field lose alignment on job status, notes, and billing readiness",
        businessOutcome: "One source of truth for every service job",
        whoBenefits: ["Dispatchers", "Technicians", "Service managers", "Customers"],
        whenToIntroduce: "When handoffs between dispatch, field, and billing create delay or rework",
        whenNotToIntroduce: "Before confirming the prospect actually runs dispatched service work",
        relatedCapabilities: ["Scheduling", "Invoices", "Mobile apps"],
        availability: "current",
      },
      {
        feature: "Scheduling / dispatch",
        purpose: "Assign technicians, manage capacity, and avoid double-booking",
        businessProblemSolved: "Manual scheduling creates chaos as technician count grows",
        businessOutcome: "Visible capacity and fewer scheduling conflicts",
        whoBenefits: ["Dispatchers", "Operations managers", "Owners"],
        whenToIntroduce: "When hiring signals or multi-site complexity strain manual dispatch",
        whenNotToIntroduce: "When prospect has no field dispatch motion",
        relatedCapabilities: ["Work orders", "Maintenance plans"],
        availability: "current",
      },
      {
        feature: "Maintenance plans",
        purpose: "Manage recurring preventive maintenance and contract renewals",
        businessProblemSolved: "PM visits slip and contract revenue is hard to forecast",
        businessOutcome: "Predictable recurring service execution",
        whoBenefits: ["Service managers", "Owners", "Dispatchers"],
        whenToIntroduce: "When prospect mentions service agreements, PM schedules, or contract renewals",
        whenNotToIntroduce: "For break-fix-only shops with no recurring model",
        availability: "current",
      },
      {
        feature: "Quotes and invoices",
        purpose: "Connect estimates to completed work and billing",
        businessProblemSolved: "Quotes, work performed, and invoices live in disconnected systems",
        businessOutcome: "Faster quote-to-cash with less re-entry",
        whoBenefits: ["Office managers", "CFOs", "Service managers"],
        whenToIntroduce: "When billing lag or quote rework shows up in discovery",
        whenNotToIntroduce: "Before understanding their current quote-to-invoice path",
        relatedCapabilities: ["Work orders", "QuickBooks integration", "Payments"],
        availability: "current",
      },
      {
        feature: "Customer portal",
        purpose: "Give customers visibility into service visits, documents, and history",
        businessProblemSolved: "Customers call the office for status updates that should be self-serve",
        businessOutcome: "Fewer status calls and stronger customer trust",
        whoBenefits: ["Owners", "Office managers", "Customers"],
        whenToIntroduce: "When high call volume for status updates is a pain point",
        whenNotToIntroduce: "When prospect has no end-customer communication burden",
        availability: "current",
      },
      {
        feature: "Certificates / calibration",
        purpose: "Template-based certificates, calibration records, and controlled release",
        businessProblemSolved: "Regulated or asset-heavy service requires traceable documentation",
        businessOutcome: "Audit-ready certificate workflow tied to work orders",
        whoBenefits: ["Quality managers", "Technicians", "Compliance-focused owners"],
        whenToIntroduce: "Medical equipment, testing labs, or calibration-heavy service contexts",
        whenNotToIntroduce: "Generic break-fix with no documentation requirements",
        availability: "current",
      },
      {
        feature: "AI OS (Growth Operator)",
        purpose: "Evidence-grounded lead discovery, research, and approval-gated outreach preparation",
        businessProblemSolved: "Outbound lacks operational context and creates low-trust first touches",
        businessOutcome: "Seller motions grounded in verified company evidence before outreach",
        whoBenefits: ["Revenue leaders", "Owners scaling outbound"],
        whenToIntroduce: "When prospect is evaluating how to grow service revenue with better qualification",
        whenNotToIntroduce: "When prospect has no service operations to sell into",
        availability: "current",
      },
      {
        feature: "Autonomous revenue orchestration (future)",
        purpose: "Expanded autonomous sales execution beyond approval-gated preparation",
        businessProblemSolved: "N/A — not generally available",
        businessOutcome: "N/A — future capability",
        whoBenefits: [],
        whenToIntroduce: "Never in current sales conversations",
        whenNotToIntroduce: "Never represent as current functionality in sales conversations",
        availability: "future",
      },
    ],
  },
  industries: [
    {
      industry: "HVAC service",
      commonWorkflows: ["Emergency dispatch", "PM season scheduling", "Quote-to-install", "Service agreements"],
      operationalTerminology: ["Truck roll", "Callback", "PM season", "Load calculation", "Dispatch board"],
      typicalEquipment: ["Rooftop units", "Boilers", "Chillers", "Duct systems"],
      commonKpis: ["First-time fix rate", "Utilization", "Callback rate", "Agreement renewal rate"],
      typicalOrgStructure: ["Owner", "Dispatcher", "Lead tech", "Install manager"],
      seasonality: "Peak demand in summer/winter; PM shoulder seasons for maintenance pushes",
      operationalChallenges: ["Seasonal capacity swings", "Route efficiency", "Parts availability"],
      serviceChallenges: ["Callback management", "Skill matching on complex jobs"],
      dispatcherChallenges: ["Last-minute cancellations", "Technician skill routing", "Overtime control"],
      technicianChallenges: ["Incomplete job context in the field", "Paperwork after hours"],
      ownerPriorities: ["Revenue per truck", "Customer retention", "Technician retention"],
      buyingTriggers: ["Hiring technicians", "New service territory", "Replacing legacy FSM"],
      operationalRisks: ["Missed PM revenue", "Dispatch bottlenecks during heat waves"],
      typicalObjections: ["We already use a dispatch board", "Too busy for a switch right now"],
      discoveryOpportunities: ["How PM season is scheduled today", "Where callbacks create rework"],
      conversationStarters: [
        "How do you keep PM season from overwhelming dispatch when weather spikes demand?",
      ],
    },
    {
      industry: "Biomedical and medical equipment service",
      commonWorkflows: ["Depot repair", "On-site clinical service", "Calibration", "Contract coverage"],
      operationalTerminology: ["Uptime", "PM compliance", "Depot turnaround", "Clinical escalation"],
      typicalEquipment: ["Imaging systems", "Patient monitoring", "Lab analyzers", "Sterilization equipment"],
      commonKpis: ["Mean time to repair", "Contract SLA adherence", "First-time fix", "Calibration compliance"],
      typicalOrgStructure: ["Service director", "Depot manager", "Field engineers", "Quality/compliance"],
      operationalChallenges: ["Multi-site coverage", "Regulatory documentation", "Specialized technician skills"],
      serviceChallenges: ["Aging fleet downtime", "Parts lead times", "Cross-training gaps"],
      dispatcherChallenges: ["Priority triage for clinical sites", "Engineer skill matching"],
      technicianChallenges: ["Certificate paperwork", "Incomplete asset history on site"],
      ownerPriorities: ["Contract retention", "SLA performance", "Technician utilization"],
      buyingTriggers: ["Installed-base growth", "New hospital contracts", "Audit findings on documentation"],
      operationalRisks: ["SLA penalties", "Incomplete calibration records"],
      typicalObjections: ["Our OEM tools handle this", "Migration risk is too high"],
      discoveryOpportunities: ["How calibration records tie to work orders", "Depot turnaround tracking"],
      conversationStarters: [
        "Where does equipment history break down between depot, field, and billing today?",
      ],
    },
    {
      industry: "Industrial equipment service",
      commonWorkflows: ["Break-fix dispatch", "Preventive contracts", "Parts consumption", "Multi-site accounts"],
      operationalTerminology: ["MTTR", "Installed base", "Depot repair", "Warranty vs billable"],
      typicalEquipment: ["Compressors", "Pumps", "Forklifts", "Production line machinery"],
      commonKpis: ["Utilization", "Contract margin", "Parts attach rate", "Repeat visits"],
      typicalOrgStructure: ["Operations manager", "Service manager", "Parts manager", "Regional leads"],
      operationalChallenges: ["Multi-site coordination", "Parts inventory accuracy", "Quote complexity"],
      serviceChallenges: ["Long repair cycles", "Specialist availability"],
      dispatcherChallenges: ["Priority conflicts across sites", "Travel time optimization"],
      technicianChallenges: ["Incomplete prior repair history", "Parts staging"],
      ownerPriorities: ["Contract profitability", "Technician productivity", "Customer concentration risk"],
      buyingTriggers: ["Fleet expansion", "ERP/FSM replacement", "New enterprise account wins"],
      operationalRisks: ["Unbilled work", "Repeat visits eroding margin"],
      typicalObjections: ["ERP already covers service", "Too customized to migrate"],
      discoveryOpportunities: ["Quote-to-work-order handoff", "How multi-site jobs are coordinated"],
      conversationStarters: [
        "How do you track profitability on recurring industrial accounts across sites?",
      ],
    },
    {
      industry: "Facilities maintenance",
      commonWorkflows: ["Work order intake", "Vendor coordination", "PM rounds", "Tenant communication"],
      operationalTerminology: ["Work order backlog", "SLA response", "PM rounds", "Building systems"],
      typicalEquipment: ["HVAC", "Elevators", "Fire safety", "Access control", "Generators"],
      commonKpis: ["Response time", "Backlog age", "PM completion rate", "Tenant satisfaction"],
      typicalOrgStructure: ["Facilities director", "Building engineers", "Vendors", "Property managers"],
      operationalChallenges: ["Multi-property visibility", "Vendor vs in-house mix", "After-hours coverage"],
      serviceChallenges: ["Prioritization across properties", "Documentation for audits"],
      dispatcherChallenges: ["Competing urgent requests", "Vendor schedule alignment"],
      technicianChallenges: ["Incomplete asset registers", "Split time across buildings"],
      ownerPriorities: ["Tenant retention", "Operating cost control", "Audit readiness"],
      buyingTriggers: ["Portfolio expansion", "New compliance requirements", "Centralization initiative"],
      operationalRisks: ["Deferred maintenance", "SLA breaches on critical systems"],
      typicalObjections: ["We use a property management system", "Too many buildings to standardize"],
      discoveryOpportunities: ["Work order intake to completion visibility", "PM round execution tracking"],
      conversationStarters: [
        "How do you see open maintenance across properties without chasing each building manager?",
      ],
    },
  ],
  personas: [
    {
      persona: "Owner",
      responsibilities: ["P&L", "Growth", "Customer retention", "Major vendor decisions"],
      successMetrics: ["Revenue growth", "Margin", "Customer churn", "Technician retention"],
      painPoints: ["Limited visibility into operations", "Firefighting instead of planning", "Scaling breaks processes"],
      buyingMotivations: ["Visibility", "Predictable service delivery", "Foundation for growth"],
      objections: ["Too expensive", "Team won't adopt", "Not the right time"],
      preferredLanguage: ["ROI framing", "Risk reduction", "Customer impact"],
      conversationStyle: "Direct, outcome-focused, respectful of time — avoid feature tours",
      desiredBusinessOutcomes: ["Run the business with fewer surprises", "Grow without operational chaos"],
    },
    {
      persona: "COO / VP Operations",
      responsibilities: ["Service delivery", "Capacity planning", "Process consistency", "Cross-functional alignment"],
      successMetrics: ["Utilization", "On-time completion", "Cost per job", "Quality/rework rate"],
      painPoints: ["Siloed systems", "Manual reporting", "Dispatch-to-cash friction"],
      buyingMotivations: ["Operational control", "Standardized workflows", "Measurable improvements"],
      objections: ["Change management burden", "Integration complexity"],
      preferredLanguage: ["Workflow", "Throughput", "Standard work", "Handoffs"],
      conversationStyle: "Process-diagnostic — map current state before recommending",
      desiredBusinessOutcomes: ["Predictable daily operations", "Clear accountability across teams"],
    },
    {
      persona: "Service Manager",
      responsibilities: ["Technician performance", "SLA adherence", "Quality", "Customer escalations"],
      successMetrics: ["First-time fix", "Callback rate", "Technician productivity", "Customer satisfaction"],
      painPoints: ["Incomplete job context", "Technician paperwork burden", "Escalation noise"],
      buyingMotivations: ["Technician efficiency", "Better job visibility", "Fewer repeat visits"],
      objections: ["Technicians resist new tools", "Current system is good enough"],
      preferredLanguage: ["First-time fix", "Job clarity", "Less admin for techs"],
      conversationStyle: "Practical — focus on day-in-the-life improvements",
      desiredBusinessOutcomes: ["Technicians finish more jobs with less rework"],
    },
    {
      persona: "Dispatcher",
      responsibilities: ["Schedule technicians", "Triage urgent jobs", "Customer communication on timing"],
      successMetrics: ["Schedule adherence", "Overtime hours", "Customer wait time", "Double-booking incidents"],
      painPoints: ["Last-minute changes", "Incomplete technician skills data", "Phone tag with field"],
      buyingMotivations: ["Less chaos", "Live status visibility", "Fewer angry customers"],
      objections: ["New system will slow me down", "I know my board"],
      preferredLanguage: ["Chaos reduction", "Live status", "Fewer phone calls"],
      conversationStyle: "Empathetic — acknowledge dispatch pressure before suggesting change",
      desiredBusinessOutcomes: ["A calmer board with fewer surprises"],
    },
    {
      persona: "CFO / Controller",
      responsibilities: ["Cash flow", "Billing accuracy", "System ROI", "Procurement approval"],
      successMetrics: ["DSO", "Invoice accuracy", "Revenue leakage", "Implementation ROI"],
      painPoints: ["Unbilled work", "Disconnected billing", "Hard to quantify software ROI"],
      buyingMotivations: ["Operational control", "Billing integrity", "Audit trail"],
      objections: ["Need clear ROI", "Budget cycle timing", "Integration risk with accounting"],
      preferredLanguage: ["Cash flow", "Leakage", "Audit trail", "Payback"],
      conversationStyle: "Evidence-based — no invented numbers; acknowledge what requires a deeper review",
      desiredBusinessOutcomes: ["Tighter quote-to-cash with fewer revenue leaks"],
    },
    {
      persona: "Technician",
      responsibilities: ["Complete jobs safely", "Document work", "Customer interaction on site"],
      successMetrics: ["Jobs completed", "Callbacks", "Paperwork time", "Customer feedback"],
      painPoints: ["Clunky mobile tools", "Missing job history", "After-hours admin"],
      buyingMotivations: ["Simplicity", "Clear job packets", "Less duplicate entry"],
      objections: ["Another app to learn", "Slow mobile experience"],
      preferredLanguage: ["Simple", "Everything in one place", "Less paperwork"],
      conversationStyle: "Not usually the economic buyer — influence through ease-of-use stories",
      desiredBusinessOutcomes: ["Finish the day without extra admin at home"],
    },
  ],
  competitors: [
    {
      name: "Spreadsheets + generic tools",
      positioning: "Low-cost, flexible, familiar",
      typicalCustomer: "Small teams early in formalizing dispatch",
      strengths: ["No migration", "Familiar", "Low upfront cost"],
      weaknesses: ["Breaks at scale", "No single job history", "Manual billing handoffs"],
      migrationConcerns: ["Fear of losing historical data", "Perceived setup time"],
      whenEquipifyWins: ["Technician count growing", "Billing errors increasing", "Customer status calls rising"],
      whenEquipifyDoesNotWin: ["Team has no recurring service motion and no growth plans"],
      professionalDiscussion:
        "Acknowledge spreadsheets work until scale exposes gaps — compare notes on where handoffs break today.",
    },
    {
      name: "Legacy FSM platforms",
      positioning: "Established field service management with broad feature sets",
      typicalCustomer: "Mature service businesses with existing FSM investment",
      strengths: ["Installed base", "Broad features", "Known vendor relationships"],
      weaknesses: ["Often dated UX", "Weak equipment-history depth", "Limited AI revenue layer"],
      migrationConcerns: ["Data migration", "Retraining", "Contract timing"],
      whenEquipifyWins: ["Replacement project active", "Equipment-centric workflows underserved", "Outreach needs evidence grounding"],
      whenEquipifyDoesNotWin: ["Recent FSM go-live with high satisfaction", "Needs are purely accounting with no ops change"],
      professionalDiscussion:
        "Never criticize by name — ask what still creates friction after go-live and whether equipment history is truly unified.",
    },
    {
      name: "Horizontal CRM",
      positioning: "General sales and account management",
      typicalCustomer: "Teams that started with sales pipeline before operational maturity",
      strengths: ["Familiar to sales teams", "Flexible pipelines"],
      weaknesses: ["Weak dispatch-to-cash", "No technician workflows", "No equipment asset model"],
      migrationConcerns: ["Fear of disrupting sales process"],
      whenEquipifyWins: ["Operations complexity outgrew CRM", "Service delivery is the bottleneck"],
      whenEquipifyDoesNotWin: ["No field service operations", "CRM is solving the actual problem"],
      professionalDiscussion:
        "Position CRM as complementary for some teams — focus conversation on operational execution gaps.",
    },
  ],
  proof: [
    {
      title: "Dispatch-to-cash alignment",
      industry: "Field service",
      operationalImprovement: "Work orders, scheduling, and invoicing connected in one workflow",
      businessOutcome: "Less re-entry between field completion and billing",
      beforeAfter: "Before: status in one place, billing in another. After: completed work flows to invoice readiness.",
      evidenceNote: "Approved qualitative pattern — no specific customer metrics claimed in outreach.",
    },
    {
      title: "PM program execution",
      industry: "HVAC / facilities",
      operationalImprovement: "Maintenance plans tied to scheduling and work orders",
      businessOutcome: "More predictable PM completion and contract renewal conversations",
      evidenceNote: "Approved qualitative pattern — timelines vary by rollout scope.",
    },
    {
      title: "Calibration documentation",
      industry: "Medical / lab service",
      operationalImprovement: "Certificates and calibration records linked to work orders",
      businessOutcome: "Clearer audit trail for regulated service documentation",
      evidenceNote: "Approved qualitative pattern — confirm regulatory context in discovery.",
    },
  ],
  commercial: {
    packagingPhilosophy:
      "Package by team size, modules needed, and rollout scope — not one-size-fits-all SKUs in first conversations.",
    pricingPhilosophy:
      "Value-based conversation after understanding workflows — never quote specific pricing in cold outreach.",
    expansionStrategy:
      "Land where dispatch-to-cash pain is highest; expand into portal, maintenance plans, and certificates as adoption proves value.",
    implementationExpectations:
      "Phased rollout: data setup, workflow configuration, team training. Complexity drives timeline — confirm in discovery.",
    onboardingApproach:
      "Operator-led configuration with role-based training for dispatch, technicians, and back office.",
    securityConversation:
      "Multi-tenant isolation, org-scoped access, and standard SaaS security practices — escalate detailed questionnaires to implementation team.",
    itConversation:
      "Browser-based staff app, mobile apps for technicians, QuickBooks integration — confirm environment in scoping call.",
    procurementExpectations:
      "Expect security review and vendor onboarding for mid-market and enterprise — provide documentation when requested.",
    budgetConversation:
      "Anchor on operational cost of current friction (rework, unbilled work, callbacks) before discussing investment.",
    whenNotToDiscussPricing:
      "In first-touch outreach, redirect to a short workflow conversation: pricing depends on team size, modules, and rollout scope.",
  },
  discovery: {
    principles: [
      "Understand current process before recommending change",
      "Diagnose operational friction with open questions",
      "Understand desired future state in the prospect's words",
      "Quantify business impact only when prospect provides numbers",
      "Understand ownership and decision process without interrogation",
      "Assess urgency from their priorities, not invented deadlines",
      "Gauge implementation readiness honestly",
    ],
    diagnosticOrder: [
      "How work enters the system today",
      "Where handoffs break down",
      "What a good week looks like vs a bad week",
      "Who owns fixing process problems",
      "What would make a change worth the effort",
    ],
  },
  buyingPsychology: [
    { persona: "Owner", whyTheyBuy: "Visibility across the business", messagingInfluence: "Lead with operational clarity and growth foundation" },
    { persona: "Dispatcher", whyTheyBuy: "Less chaos on the board", messagingInfluence: "Acknowledge dispatch pressure; offer calmer workflows" },
    { persona: "Service Manager", whyTheyBuy: "Technician efficiency and fewer callbacks", messagingInfluence: "Focus on job clarity and first-time fix" },
    { persona: "CFO", whyTheyBuy: "Operational control and billing integrity", messagingInfluence: "Discuss leakage and audit trail — no invented ROI" },
    { persona: "Technician", whyTheyBuy: "Simplicity in the field", messagingInfluence: "Ease-of-use proof points only when relevant" },
  ],
  equipifySalesPhilosophy: [
    "Never oversell",
    "Never invent pain",
    "Never invent urgency",
    "Never exaggerate",
    "Evidence before assumptions",
    "Consult before selling",
    "Educate before recommending",
    "Respect the prospect's time",
    "Never force a fit",
    "Recommend against Equipify when appropriate",
    "Long-term trust is more important than a booked meeting",
    "Never represent future roadmap items as current functionality",
    "Never criticize competitors by name",
    "Never fabricate competitor weaknesses",
  ],
}

export function buildEquipifyCanonicalSellerKnowledge(): EquipifyCanonicalSellerKnowledge {
  return EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE
}

export function listCurrentEquipifyCapabilities(
  knowledge: EquipifyCanonicalSellerKnowledge = EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE,
): string[] {
  return knowledge.products.modules
    .filter((row) => row.availability === "current")
    .map((row) => row.feature)
}

export function listFutureEquipifyCapabilities(
  knowledge: EquipifyCanonicalSellerKnowledge = EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE,
): string[] {
  return knowledge.products.modules
    .filter((row) => row.availability === "future")
    .map((row) => row.feature)
}
