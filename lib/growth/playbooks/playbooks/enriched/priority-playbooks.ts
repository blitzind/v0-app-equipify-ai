/** GS-AI-PLAYBOOK-2A — Priority enriched industry playbooks (reference level). */

import type {
  GrowthIndustryPlaybook,
  GrowthIndustryPlaybookEnrichmentInput,
} from "../../industry-playbook-types"
import { buildEnrichedIndustryPlaybook } from "../_playbook-enrich-helper"
import {
  buildBuyerPersona,
  buildStructuredObjection,
  discoveryByCategory,
  STANDARD_FIELD_SERVICE_COMPETITORS,
} from "./_shared"

/** Avoid enrich-helper videoStorylines trimList crash when storylines are objects. */
function buildPriorityEnrichedPlaybook(
  input: GrowthIndustryPlaybookEnrichmentInput,
): GrowthIndustryPlaybook {
  const storylines = input.storylines ?? []
  const playbook = buildEnrichedIndustryPlaybook({
    ...input,
    storylines: [],
    videoStorylines: [],
    sharePageStorylines: storylines.slice(0, 3),
  })
  return {
    ...playbook,
    storylines,
    videoStorylines: storylines.slice(0, 12),
    sharePageStorylines: storylines.slice(0, 3),
  }
}

export function buildBiomedicalEquipmentEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "Survey-ready HTM", hook: "Surface overdue PM by campus before accreditation without spreadsheets", audience: "HTM director", theme: "compliance" },
    { title: "Recall to resolution", hook: "Close loop from recall notice to corrective work on each serial", audience: "Biomed supervisor", theme: "recall" },
    { title: "Context before the unit", hook: "Full device history on mobile before sensitive clinical areas", audience: "Clinical engineering manager", theme: "clinical" },
    { title: "Loaner pool clarity", hook: "Track loaner deployment against the asset it replaced", audience: "Biomed shop lead", theme: "loaner" },
    { title: "Modality backlog map", hook: "Show which modalities drive overdue PM and repeat rolls", audience: "HTM director", theme: "modality" },
    { title: "Calibration without duplicate logs", hook: "Drive calibration due dates from asset register into work", audience: "Compliance lead", theme: "calibration" },
    { title: "One picture across campuses", hook: "Unify HTM backlog when pools serve multiple hospitals", audience: "IDN operations leader", theme: "multi-site" },
    { title: "Parts that tell a story", hook: "Tie parts usage to failure trends for stocking and renewals", audience: "Biomed operations manager", theme: "parts" },
    { title: "After-hours with context", hook: "Dispatch clinical emergencies with device history not phone trees", audience: "On-call coordinator", theme: "on-call" },
    { title: "EST in rhythm", hook: "Keep electrical safety programs on cadence per portable device", audience: "Quality lead", theme: "est" },
    { title: "OEM cases on the asset", hook: "Preserve manufacturer escalation notes across tech rotations", audience: "Biomed field lead", theme: "oem" },
    { title: "Replace with evidence", hook: "Use service trends for capital replacement with hospital finance", audience: "HTM director", theme: "capital" },
    { title: "Guided checks for float techs", hook: "Modality checklists for PM on unfamiliar devices", audience: "Shop supervisor", theme: "float" },
    { title: "Post-merger asset cleanup", hook: "Consolidate duplicate records and conflicting PM schedules", audience: "HTM integration lead", theme: "merger" },
    { title: "Status nursing can trust", hook: "Give units visibility into biomed ETA on down devices", audience: "Clinical liaison", theme: "nursing" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "biomedical_equipment",
    overview: "Biomedical equipment service organizations and in-house HTM teams maintain regulated clinical devices across hospitals, ambulatory sites, and IDN campuses. Revenue comes from hospital contracts, OEM partnerships, time-and-materials corrective work, and compliance-driven PM tied to Joint Commission, CMS, and manufacturer requirements. Operators range from single-shop biomed departments to multi-campus clinical engineering teams managing thousands of patient-connected assets across imaging, monitoring, sterilization, and life support modalities. Maturity stages span spreadsheet-driven shops, mid-size HTM teams consolidating multi-site visibility, and enterprise programs integrating recall management, loaner pools, and accreditation documentation.",
    operationalPains: [
    "PM due dates for patient-connected devices live in spreadsheets disconnected from work orders",
    "Recall and safety notices not linked to affected serial numbers",
    "Technicians enter clinical units without unified device history on mobile",
    "Loaner pool status invisible during downtime events",
    "Multi-campus HTM backlog risk hidden by modality and building",
    "Electrical safety and calibration documentation rebuilt manually for surveys",
    "Parts usage on biomed repairs not tied to asset cost history",
    "Corrective actions from failed PM inspections lack closed-loop tracking",
    "OEM escalations lose context between biomed and clinical staff",
    "Night and weekend on-call dispatch uses phone trees without asset context",
    "Sterilizer and endoscope PM cadences drift across decentralized shops",
    "Capital planning lacks failure trends from service history",
    "Float techs lack guided checklists for high-risk modalities",
    "Duplicate asset records after mergers create conflicting PM schedules",
    "Accreditation prep requires weeks of manual record gathering",
  ],
    financialPains: [
    "Overtime spikes before Joint Commission survey windows",
    "Repeat truck rolls on same device erode contract margin",
    "Parts inventory carrying cost from untracked biomed stockrooms",
    "Penalty exposure when SLA response misses on critical care assets",
    "Under-billed T&M when parts and labor not captured on closeout",
    "Contract renewals lack modality-level cost-to-serve data",
    "Loaner fleet depreciation without utilization metrics",
    "Reactive staffing during recall surges blows labor budget",
    "Write-offs when warranty-eligible repairs billed incorrectly",
    "Inefficient route density across scattered clinic PM routes",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "HTM Director",
      goals: [
        "Reduce accreditation risk across campuses",
        "Improve PM compliance visibility by modality",
      ],
      kpis: [
        "PM compliance %",
        "Overdue PM by risk tier",
        "Critical device downtime hours",
      ],
      frustrations: [
        "Survey prep consumes weeks of manual record gathering",
        "Backlog hidden until leadership escalates",
      ],
      buyingTriggers: [
        "Joint Commission survey date set",
        "New tower adds hundreds of unmanaged assets",
      ],
      commonObjections: [
        "Hospital CMMS should cover HTM",
        "Clinical workflows are too specialized",
      ],
      successMetrics: [
        "Audit findings reduced",
        "Overdue PM cut before survey window",
      ],
    }),
    buildBuyerPersona({
      title: "Clinical Engineering Manager",
      goals: [
        "Standardize PM across biomed shops",
        "Improve tech productivity on clinical units",
      ],
      kpis: [
        "Jobs closed same day",
        "Repeat failure rate",
        "Technician utilization",
      ],
      frustrations: [
        "Float techs lack modality guidance",
        "Device history not on mobile",
      ],
      buyingTriggers: [
        "Staffing shortage on high-acuity units",
        "New OEM modality onboarding",
      ],
      commonObjections: [
        "Biomed techs resist mobile apps",
        "Too specialized for generic FSM",
      ],
      successMetrics: [
        "First-time fix up on unit",
        "PM closeout time reduced",
      ],
    }),
    buildBuyerPersona({
      title: "Biomed Shop Supervisor",
      goals: [
        "Keep shop and unit PM on schedule",
        "Reduce loaner chaos during downtime",
      ],
      kpis: [
        "Overdue PM in shop",
        "Loaner turnaround time",
        "Tech rework rate",
      ],
      frustrations: [
        "Recall actions not on work orders",
        "Parts room not tied to jobs",
      ],
      buyingTriggers: [
        "Recall surge",
        "Shop expansion or consolidation",
      ],
      commonObjections: [
        "Hospital IT selects tools",
        "Techs already use paper checklists",
      ],
      successMetrics: [
        "Recall closure on time",
        "Loaner pool utilization improved",
      ],
    }),
    buildBuyerPersona({
      title: "Compliance Lead",
      goals: [
        "Maintain traceable documentation for audits",
        "Close corrective actions on time",
      ],
      kpis: [
        "Open corrective actions",
        "Certificate compliance %",
        "Audit prep hours",
      ],
      frustrations: [
        "Certificates scattered across folders",
        "Failed inspections lack closed-loop tracking",
      ],
      buyingTriggers: [
        "Failed audit or customer audit",
        "Regulatory documentation deadline",
      ],
      commonObjections: [
        "Existing QMS handles compliance",
        "Security review blocks new vendors",
      ],
      successMetrics: [
        "Audit prep time reduced",
        "Corrective actions closed on schedule",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do you see overdue PM by campus and modality before survey season?",
    "Where do recall actions live relative to open work orders?",
    "How do loaner deployments tie back to the asset they replaced?"
  ],
  revenue: [
    "How do contract entitlements drive PM scheduling today?",
    "What data informs biomed contract renewals with hospital leadership?",
    "How do you track cost-to-serve by modality or manufacturer?"
  ],
  dispatch: [
    "How are after-hours clinical emergencies prioritized against scheduled PM?",
    "What context does a tech see before entering a patient care area?",
    "How do you assign work when multiple campuses share one biomed pool?"
  ],
  compliance: [
    "How do you prepare Joint Commission or CMS documentation on demand?",
    "Where are electrical safety and calibration certificates stored per device?",
    "How are corrective actions from failed inspections tracked to closure?"
  ],
  technicians: [
    "What slows biomed techs during PM closeout in shop vs on unit?",
    "How do float techs get modality-specific guidance on unfamiliar devices?",
    "Where do techs log parts, meters, and test equipment used on a job?"
  ],
  customer: [
    "How do nursing units request biomed support and track status?",
    "What service history do clinical staff see when a device is down?",
    "How do you communicate ETA for critical device restoration?"
  ],
  reporting: [
    "Which HTM KPIs do you report monthly and where do they come from?",
    "How do you trend repeat failures on high-risk device classes?",
    "Can you produce audit-ready PM compliance by building in minutes?"
  ],
  growth: [
    "How are you scaling HTM coverage as new towers or clinics open?",
    "What blocks adding new OEM service lines to your shop?",
    "How do mergers affect asset register consolidation plans?"
  ],
  contracts: [
    "How are PM frequencies set when OEM and AAMI requirements differ?",
    "Where do contract SLA tiers map to dispatch priority rules?",
    "How do you prove PM completion for contract true-ups?"
  ],
  equipment: [
    "How is your master asset register reconciled after capital installs?",
    "Where do serial numbers, UDI, and location data stay in sync?",
    "How do you track useful life and replacement planning by device class?"
  ]
}),
    proofPoints: [
    "Single clinical asset register with PM schedules and service history per device",
    "Recall notices linked to serial-level assets and corrective work orders",
    "Audit-ready documentation for Joint Commission without spreadsheet rebuilds",
    "Multi-campus backlog visibility by modality, building, and risk tier",
    "Loaner pool tracking with deployment history tied to replaced assets",
    "Calibration and electrical safety due dates drive scheduled work",
    "Parts usage captured on work orders for margin and failure analysis",
    "Mobile job packets with device history before entering clinical areas",
    "Corrective action workflows from failed PM inspections to closure",
    "Contract entitlement-aware scheduling for hospital biomed programs",
    "Repeat failure trending on patient-connected device classes",
    "OEM escalation notes preserved on asset records across tech rotations",
  ],
    capabilityMappings: [
    { capability: "Regulated PM scheduling", painSignal: "Overdue PM on infusion pumps and monitors", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Recall-to-work-order linkage", painSignal: "Recall bulletins not tied to corrective jobs", equipifyModule: "Work Orders" },
    { capability: "Clinical asset register", painSignal: "Duplicate device records after installs", equipifyModule: "Equipment + Service History" },
    { capability: "Audit-ready service history", painSignal: "Manual documentation assembly for surveys", equipifyModule: "Service History + Reports" },
    { capability: "Loaner pool tracking", painSignal: "Loaner status invisible during downtime", equipifyModule: "Equipment + Service History" },
    { capability: "Calibration due management", painSignal: "Calibration intervals outside work orders", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Electrical safety PM", painSignal: "EST due dates missed on portable devices", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Multi-campus backlog views", painSignal: "Directors cannot see risk by site", equipifyModule: "Reports" },
    { capability: "Mobile device context", painSignal: "Techs arrive without prior repair history", equipifyModule: "Mobile Work Orders" },
    { capability: "Parts on biomed jobs", painSignal: "Parts logged after the fact hurting margin", equipifyModule: "Work Orders" },
    { capability: "Corrective action closure", painSignal: "Failed inspection follow-ups lost in email", equipifyModule: "Work Orders" },
    { capability: "Modality-based routing", painSignal: "Wrong skill tech dispatched to imaging PM", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Contract entitlement PM", painSignal: "PM not aligned to hospital contract coverage", equipifyModule: "Service Contracts" },
    { capability: "Repeat failure analytics", painSignal: "Same device class failing without trends", equipifyModule: "Reports" },
    { capability: "OEM escalation history", painSignal: "Manufacturer case notes not on asset", equipifyModule: "Service History + Reports" },
  ],
    recommendedCtas: [
    "Walk through HTM PM and recall tracking for your shop size",
    "See audit-ready device history before survey season",
    "Review loaner pool workflow during downtime events",
    "Compare biomed dispatch to asset-centric scheduling",
    "Explore modality-level backlog views for HTM directors",
    "Map electrical safety and calibration due dates in one register",
    "See corrective action closure from failed PM inspections",
    "Review mobile job context before patient care areas",
    "Discuss contract entitlement scheduling for hospital biomed",
    "Preview repeat failure trends on high-risk device classes",
    "Review OEM escalation history on a single asset record",
    "See parts usage tied to biomed job margin reporting",
    "Walk through multi-campus HTM visibility without exports",
    "Review recall-to-work-order flow with serial matching",
    "See capital planning fed by service history trends",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a hospital CMMS.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior biomed history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our HTM workflows are too specialized.",
      "HTM programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your HTM workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for Joint Commission reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with PM and recall tracking often pays back within one survey cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and PM compliance before accreditation—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for HTM operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many HTM teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "HTM leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "Mention of modality-specific PM backlogs",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Insists hospital ERP must remain sole system of record for all HTM",
  ],
    personalizationOpeners: [
    "HTM teams often tell us PM and recall actions still live outside work orders—is that true for your shop?",
    "Clinical engineering leaders tighten audit-ready documentation before survey season—how are you preparing?",
    "When a pump goes down, nursing asks for ETA before biomed has full device history—sound familiar?",
    "Multi-campus HTM teams struggle to see modality backlog until survey findings—where do you stand?",
    "Loaner tracking during downtime is a common gap from biomed supervisors—is that on your radar?",
    "Recall bulletins that do not link to serial numbers create expensive rework—how do you handle those?",
    "Float biomed techs on unfamiliar modalities is a safety concern many shops mention—your approach?",
    "Hospital renewals go smoother when biomed shows cost-to-serve by modality—do you have that view?",
  ],
    industryVocabulary: [
    "HTM",
    "clinical engineering",
    "biomed shop",
    "UDI",
    "AAMI",
    "Joint Commission",
    "electrical safety test",
    "loaner pool",
    "modality",
    "recall notice",
  ],
    industryMetrics: [
    "PM compliance rate by modality",
    "Overdue PM count by campus",
    "Mean time to restore critical devices",
    "Repeat failure rate by device class",
    "Recall closure cycle time",
    "First-time fix rate on biomed calls",
    "Loaner utilization rate",
    "Parts cost per corrective work order",
  ],
    industryTriggers: [
    "Joint Commission survey scheduled",
    "FDA recall affecting installed base",
    "New hospital tower opening",
    "HTM merger or outsourcing transition",
    "CMMS renewal dissatisfaction",
    "Critical device downtime escalation",
    "New OEM service line launch",
    "Biomed staffing shortage before flu season",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildMedicalEquipmentEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "SLA-first dispatch", hook: "Prioritize imaging emergencies by contract tier without spreadsheet rules", audience: "Service manager", theme: "sla" },
    { title: "One installed base", hook: "Sales and service share the same account equipment register", audience: "Sales director", theme: "installed-base" },
    { title: "Depot meets field", hook: "Depot repair notes visible to field tech on next visit", audience: "Depot supervisor", theme: "depot" },
    { title: "Renewal with evidence", hook: "Show service cost and uptime data before contract negotiations", audience: "Account executive", theme: "renewal" },
    { title: "Repeat failure playbook", hook: "Escalate recurring serial failures with structured follow-up", audience: "Field supervisor", theme: "repeat" },
    { title: "Entitlement PM", hook: "Auto-schedule PM visits from contract coverage", audience: "Operations director", theme: "pm" },
    { title: "Branch SLA heat map", hook: "Surface accounts at SLA risk across branches", audience: "Regional ops lead", theme: "branch" },
    { title: "Quote to job", hook: "Link sales quotes to assets and follow-on work", audience: "Sales ops lead", theme: "quote" },
    { title: "Swap unit clarity", hook: "Track loaner swaps on the customer asset record", audience: "Field coordinator", theme: "swap" },
    { title: "Modality match", hook: "Assign imaging vs DME jobs by skill rules", audience: "Dispatch manager", theme: "skills" },
    { title: "Warranty ready jobs", hook: "Capture labor and parts for OEM warranty claims", audience: "Service admin", theme: "warranty" },
    { title: "Remote support logged", hook: "Attach phone diagnostic outcomes to asset history", audience: "Technical support lead", theme: "remote" },
    { title: "Upsell from history", hook: "Identify end-of-life equipment from service trends", audience: "Sales director", theme: "upsell" },
    { title: "Depot turnaround", hook: "Give account managers shop status on same system", audience: "Customer success lead", theme: "depot" },
    { title: "Customer case hub", hook: "Structured work orders from hospital service requests", audience: "Customer service lead", theme: "customer" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "medical_equipment",
    overview: "Medical equipment dealers and field service organizations support imaging, DME, diagnostic, and clinical devices for provider accounts under OEM agreements, depot repair contracts, and SLA-backed service plans. Revenue mixes new equipment sales, recurring service contracts, parts margin, and depot refurbishment. Teams range from regional imaging service branches to national DME fleets with mixed field and depot workflows. Maturity stages include CRM-heavy shops without unified asset history, growing organizations aligning sales installed base with service dispatch, and multi-branch operators standardizing SLA dispatch and renewal analytics across accounts.",
    operationalPains: [
    "Contract SLA tiers tracked outside dispatch prioritization",
    "Depot and field repair histories split across systems",
    "Sales lacks shared installed base visibility with service",
    "Quote-to-service handoffs lose context on recurring failures",
    "Installed base data stale when renewals approach",
    "PM against contract entitlements scheduled manually",
    "OEM parts returns not linked to asset warranty status",
    "Multi-branch dispatch lacks unified view of SLA risk",
    "Depot turnaround time opaque to field account managers",
    "Escalation paths for repeat failures undocumented on assets",
    "Training on new modality releases not tied to asset register",
    "Remote diagnostic sessions not logged on service history",
    "Swap unit tracking during loaner deployments inconsistent",
    "Field tech skill matching for imaging vs DME ad hoc",
    "Customer portal requests not creating structured work orders",
  ],
    financialPains: [
    "SLA penalties on imaging accounts erode contract margin",
    "Depot labor underutilized while field overtime spikes",
    "Parts obsolescence write-offs on aging installed base",
    "Under-quoted repeat failure jobs hurt gross margin",
    "Renewal discounts given without service cost visibility",
    "Warranty claim leakage when labor not documented",
    "Branch P&L skewed by unallocated depot costs",
    "Emergency response staffing drives quarterly labor variance",
    "Travel cost on low-density rural imaging routes",
    "Revenue recognition delays when service closeout lags",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Sales Director",
      goals: [
        "Win renewals with service proof",
        "Expand installed base revenue",
      ],
      kpis: [
        "Renewal rate",
        "Attach rate on service contracts",
        "Pipeline conversion",
      ],
      frustrations: [
        "No service data before renewal calls",
        "Quotes disconnected from assets",
      ],
      buyingTriggers: [
        "Competitive renewal battle",
        "New vertical expansion",
      ],
      commonObjections: [
        "CRM is enough for sales",
        "Service should fix their own data",
      ],
      successMetrics: [
        "Renewals won with uptime data",
        "Upsell from end-of-life signals",
      ],
    }),
    buildBuyerPersona({
      title: "Compliance Lead",
      goals: [
        "Maintain traceable documentation for audits",
        "Close corrective actions on time",
      ],
      kpis: [
        "Open corrective actions",
        "Certificate compliance %",
        "Audit prep hours",
      ],
      frustrations: [
        "Certificates scattered across folders",
        "Failed inspections lack closed-loop tracking",
      ],
      buyingTriggers: [
        "Failed audit or customer audit",
        "Regulatory documentation deadline",
      ],
      commonObjections: [
        "Existing QMS handles compliance",
        "Security review blocks new vendors",
      ],
      successMetrics: [
        "Audit prep time reduced",
        "Corrective actions closed on schedule",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do depot and field teams share one asset record?",
    "Where do repeat failure escalations get documented?",
    "How do you match tech skills to modality on dispatch?"
  ],
  revenue: [
    "How does sales view installed base before renewal conversations?",
    "What margin data informs service contract pricing?",
    "How are warranty and contract entitlements reconciled on jobs?"
  ],
  dispatch: [
    "How are SLA tiers enforced in daily dispatch decisions?",
    "What happens when emergency calls conflict with PM routes?",
    "How do branches share technician capacity for imaging surges?"
  ],
  compliance: [
    "How do you document service for FDA or OEM audit requests?",
    "Where are ISO or quality records tied to depot repairs?",
    "How is serial traceability maintained on swapped units?"
  ],
  technicians: [
    "What do field techs see on mobile before an imaging call?",
    "How do depot techs hand off notes to field on same asset?",
    "Where are remote diagnostic outcomes stored?"
  ],
  customer: [
    "How do hospitals track open service cases across modalities?",
    "What uptime reporting do key accounts receive today?",
    "How are loaner or swap units communicated to clinical staff?"
  ],
  reporting: [
    "Which SLA KPIs do you report weekly by account?",
    "How do you identify accounts with rising repeat failure rates?",
    "Can you produce installed base reports by contract tier?"
  ],
  growth: [
    "How will new OEM lines affect dispatch and depot capacity?",
    "What blocks expanding depot repair for more modalities?",
    "How do acquisitions merge installed base registers?"
  ],
  contracts: [
    "How are PM visit entitlements translated into scheduled work?",
    "Where do response time commitments map to dispatch rules?",
    "How do you prove SLA attainment for contract renewals?"
  ],
  equipment: [
    "How often is installed base reconciled with customer sites?",
    "Where do configuration and software version data live per asset?",
    "How do you track end-of-service-life equipment for upsell?"
  ]
}),
    proofPoints: [
    "Account-level equipment visibility shared by sales and service",
    "Work orders respect SLA tiers for field and depot paths",
    "Service history informs renewal and upsell conversations",
    "Quotes linked to assets and follow-on work orders",
    "PM schedules aligned to contract coverage and entitlements",
    "Depot turnaround visible to account managers on same asset record",
    "Repeat failure escalation history preserved per serial",
    "Branch-wide SLA risk dashboard for dispatch leads",
    "Warranty and parts usage captured for claim support",
    "Remote diagnostic notes attached to asset service history",
    "Swap and loaner unit tracking tied to customer assets",
    "Modality-based technician assignment rules on dispatch board",
  ],
    capabilityMappings: [
    { capability: "SLA-aware dispatch", painSignal: "Response windows not enforced in scheduling", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Unified installed base", painSignal: "Sales and service see different equipment lists", equipifyModule: "Equipment + Service History" },
    { capability: "Depot and field history", painSignal: "Repair paths split across systems", equipifyModule: "Service History + Reports" },
    { capability: "Contract entitlement PM", painSignal: "PM visits not auto-scheduled from contracts", equipifyModule: "Service Contracts" },
    { capability: "Quote-to-work linkage", painSignal: "Sales quotes disconnected from service jobs", equipifyModule: "Work Orders" },
    { capability: "Repeat failure escalation", painSignal: "Same serial failing without structured follow-up", equipifyModule: "Work Orders" },
    { capability: "Modality skill routing", painSignal: "Imaging jobs assigned to general DME techs", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Depot turnaround tracking", painSignal: "Account managers blind to shop backlog", equipifyModule: "Reports" },
    { capability: "Warranty capture on jobs", painSignal: "Labor and parts not documented for claims", equipifyModule: "Work Orders" },
    { capability: "Remote diagnostic logging", painSignal: "Phone support not on asset history", equipifyModule: "Service History + Reports" },
    { capability: "Swap unit tracking", painSignal: "Loaner swaps not on customer asset record", equipifyModule: "Equipment + Service History" },
    { capability: "Branch SLA dashboard", painSignal: "Multi-branch SLA risk invisible to leadership", equipifyModule: "Reports" },
    { capability: "Renewal analytics", painSignal: "Service cost data missing before renewals", equipifyModule: "Reports" },
    { capability: "Customer case visibility", painSignal: "Open cases scattered across email", equipifyModule: "Work Orders" },
    { capability: "Parts on service jobs", painSignal: "Parts margin unknown on contract work", equipifyModule: "Work Orders" },
  ],
    recommendedCtas: [
    "Review SLA dispatch rules for imaging and DME accounts",
    "See installed base shared between sales and service",
    "Walk through depot-to-field history on one asset",
    "Explore contract entitlement PM scheduling",
    "Map repeat failure escalation on serial-level records",
    "Preview branch SLA risk dashboard for dispatch leads",
    "See quote-to-work-order handoff for service sales",
    "Review warranty and parts capture on completed jobs",
    "Discuss modality-based technician assignment rules",
    "See renewal analytics fed by service cost history",
    "Walk through swap unit tracking for hospital accounts",
    "Review remote diagnostic notes on asset records",
    "Compare depot turnaround visibility for account managers",
    "See PM compliance proof for contract renewals",
    "Explore OEM line expansion without dispatch chaos",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a CRM.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior medical equipment history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our depot and field service workflows are too specialized.",
      "medical equipment service programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your depot and field service workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for OEM quality reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with SLA dispatch and installed base often pays back within one renewal cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and SLA attainment on key accounts—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for medical equipment service operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many medical equipment service teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "medical equipment service leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "Imaging vs DME dispatch complexity acknowledged",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Evaluation owned solely by sales CRM team with no service input",
  ],
    personalizationOpeners: [
    "Medical equipment teams often split depot and field history—is that a gap for you?",
    "When renewals approach, sales and service sometimes see different installed bases—how do you align?",
    "SLA tiers outside dispatch rules cause misses on imaging accounts—sound familiar?",
    "Repeat failures on the same serial without escalation history frustrate service managers—we hear that often.",
    "Contract PM entitlements that do not auto-schedule visits create renewal risk—your experience?",
    "Depot turnaround blind spots make account managers guess on ETA—does that happen here?",
    "Modality skill mismatches on dispatch drive callbacks on imaging calls—how do you prevent that?",
    "Warranty claim leakage when labor is not on the job record is common—how tight is your capture?",
  ],
    industryVocabulary: [
    "installed base",
    "depot repair",
    "DME",
    "imaging service",
    "SLA tier",
    "modality",
    "swap unit",
    "OEM entitlement",
    "uptime",
    "service contract",
  ],
    industryMetrics: [
    "SLA attainment % by account",
    "First-time fix rate by modality",
    "Depot turnaround days",
    "Contract gross margin",
    "Repeat failure rate by serial",
    "PM visits completed vs entitlement",
    "Mean time to respond on critical accounts",
    "Parts margin per service job",
  ],
    industryTriggers: [
    "Major account renewal at risk",
    "New OEM dealership line signed",
    "Depot expansion or consolidation",
    "SLA penalty on imaging account",
    "Acquisition of regional service branch",
    "Hospital RFP for consolidated service",
    "Field tech hiring surge for DME growth",
    "CRM replacement exposing service data gaps",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildCommercialEquipmentEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "PM that schedules itself", hook: "Turn contract entitlements into scheduled visits automatically", audience: "Operations director", theme: "pm" },
    { title: "History before the truck rolls", hook: "Give techs full asset context before repeat failure visits", audience: "Field supervisor", theme: "history" },
    { title: "Contract tier dispatch", hook: "Prioritize national account SLAs without spreadsheet rules", audience: "Dispatch manager", theme: "dispatch" },
    { title: "Parts tell the margin story", hook: "Capture parts on jobs for margin and failure analysis", audience: "Service manager", theme: "parts" },
    { title: "One customer, many sites", hook: "Unified service history for multi-site accounts", audience: "Account manager", theme: "multi-site" },
    { title: "Repeat failure stopper", hook: "Flag recurring assets before assigning another roll", audience: "Dispatcher", theme: "repeat" },
    { title: "Mobile asset register", hook: "Site equipment list on the tech's phone before arrival", audience: "Field tech lead", theme: "mobile" },
    { title: "QBR-ready reporting", hook: "Produce PM compliance reports without manual exports", audience: "Customer success lead", theme: "reporting" },
    { title: "Warranty on the job", hook: "OEM coverage visible when quoting and closing jobs", audience: "Service admin", theme: "warranty" },
    { title: "Route-smart PM", hook: "Plan PM routes by geography not just due date", audience: "Operations planner", theme: "routing" },
    { title: "Closeout to invoice", hook: "Same-day job closeout for T&M cash flow", audience: "Finance ops lead", theme: "billing" },
    { title: "Sales meets service", hook: "Installed base visibility before expansion conversations", audience: "Sales director", theme: "sales" },
    { title: "Emergency vs PM balance", hook: "Keep PM on track when emergencies spike", audience: "Dispatch manager", theme: "balance" },
    { title: "Checklist on the asset", hook: "PM completion recorded on equipment not just the ticket", audience: "Quality lead", theme: "checklist" },
    { title: "Subcontractor in the record", hook: "Merge vendor work into customer asset history", audience: "Operations director", theme: "vendor" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "commercial_equipment",
    overview: "Commercial equipment service teams maintain mixed capital assets—compressors, boilers, material handling, and production support equipment—across customer sites under PM contracts, emergency response agreements, and time-and-materials repair. Revenue blends recurring maintenance contracts, break-fix labor, parts margin, and upsell on fleet expansions. Operators range from regional equipment dealers to multi-trade service companies covering hundreds of sites for national accounts. Maturity stages include spreadsheet PM tracking, growing teams adding dispatch software without asset registers, and established operators unifying contract scheduling, parts capture, and customer reporting.",
    operationalPains: [
    "Technicians arrive without complete asset and prior repair context",
    "PM contracts do not drive scheduling consistently",
    "Emergency and contract work compete in the same dispatch queue",
    "Parts usage logged after the fact hurting margin visibility",
    "Multi-site customers lack a single service history view",
    "Asset tags and serials inconsistent across customer locations",
    "Repeat failures on same asset not flagged before dispatch",
    "Contract tier priority rules live in dispatcher memory",
    "Customer request intake scattered across email and phone",
    "PM checklist completion not tied to asset records",
    "Warranty and OEM coverage not visible on work orders",
    "Subcontractor work not merged into customer asset history",
    "Route planning ignores PM density by geography",
    "Closeout delays block invoicing on T&M jobs",
    "Account managers cannot self-serve service history for QBRs",
  ],
    financialPains: [
    "Repeat truck rolls erode contract gross margin",
    "Parts margin leakage when usage not captured on closeout",
    "Emergency overtime spikes when PM backlog ignored",
    "Under-billed travel on multi-site national accounts",
    "Contract renewals discounted without cost-to-serve data",
    "Inventory carrying cost from untracked van stock",
    "Write-offs on warranty jobs billed to customer",
    "Dispatcher labor scales linearly with call volume",
    "Revenue lag when jobs closed days after completion",
    "Lost upsell when installed base not visible to sales",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
    buildBuyerPersona({
      title: "Dispatch Manager",
      goals: [
        "Prioritize by contract tier and urgency",
        "Reduce windshield time",
      ],
      kpis: [
        "Emergency response time",
        "PM route completion rate",
        "Overtime hours",
      ],
      frustrations: [
        "Emergencies blow up planned routes",
        "No single queue for contract and T&M",
      ],
      buyingTriggers: [
        "Missed SLA on chain account",
        "Dispatcher turnover",
      ],
      commonObjections: [
        "Current dispatch board is good enough",
        "Peak season is bad timing",
      ],
      successMetrics: [
        "On-time PM completion up",
        "Emergency SLA attainment improved",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
    buildBuyerPersona({
      title: "Sales Director",
      goals: [
        "Win renewals with service proof",
        "Expand installed base revenue",
      ],
      kpis: [
        "Renewal rate",
        "Attach rate on service contracts",
        "Pipeline conversion",
      ],
      frustrations: [
        "No service data before renewal calls",
        "Quotes disconnected from assets",
      ],
      buyingTriggers: [
        "Competitive renewal battle",
        "New vertical expansion",
      ],
      commonObjections: [
        "CRM is enough for sales",
        "Service should fix their own data",
      ],
      successMetrics: [
        "Renewals won with uptime data",
        "Upsell from end-of-life signals",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do PM contracts translate into scheduled work today?",
    "What do techs see before a repeat failure visit?",
    "How are emergency calls prioritized against contract PM?"
  ],
  revenue: [
    "How do you report service history back to multi-site accounts?",
    "What margin data informs contract renewals?",
    "Where does sales see installed base before expansion conversations?"
  ],
  dispatch: [
    "How are contract tiers reflected in daily dispatch?",
    "What slows re-prioritization when emergencies hit?",
    "How do you balance route density with SLA windows?"
  ],
  compliance: [
    "How do you document safety or regulatory checks on equipment?",
    "Where are inspection findings stored per asset?",
    "How do OEM warranty requirements attach to jobs?"
  ],
  technicians: [
    "Where is parts usage captured relative to the job?",
    "What mobile context do techs have on unfamiliar sites?",
    "How do techs record meter readings and asset condition?"
  ],
  customer: [
    "How do customers request service and track open jobs?",
    "What reporting do national accounts expect quarterly?",
    "How are downtime events communicated to site managers?"
  ],
  reporting: [
    "Which KPIs do ops report weekly and from where?",
    "How do you identify accounts with rising repeat failures?",
    "Can you produce PM compliance by customer site quickly?"
  ],
  growth: [
    "What breaks when you add a new national account?",
    "How do acquisitions affect your asset register?",
    "What limits adding PM contract volume without headcount?"
  ],
  contracts: [
    "How are PM frequencies set per asset class in contracts?",
    "Where do response time SLAs map to dispatch rules?",
    "How do you prove PM completion for billing true-ups?"
  ],
  equipment: [
    "How is the master asset register maintained per customer site?",
    "Where do serial numbers and model data stay current?",
    "How do you track capital asset age for replacement sales?"
  ]
}),
    proofPoints: [
    "Asset-centric work orders with full service history on every visit",
    "PM plans generate scheduled work from contract entitlements",
    "Dispatch prioritization by contract tier and urgency",
    "Parts tied to jobs for margin and repeat failure analysis",
    "Multi-site customer history in one operational view",
    "Repeat failure flags before assigning repeat visits",
    "Mobile job packets with asset context and PM checklists",
    "Warranty and OEM coverage visible on each work order",
    "Account-ready service reports without manual exports",
    "Route-friendly PM scheduling by geography",
    "Same-day closeout flows supporting faster invoicing",
    "Installed base visibility for sales and service alignment",
  ],
    capabilityMappings: [
    { capability: "PM-driven scheduling", painSignal: "PM contracts not creating scheduled visits", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Asset service history", painSignal: "Techs arrive without prior repair context", equipifyModule: "Service History + Reports" },
    { capability: "Contract-tier dispatch", painSignal: "Emergency and PM compete without priority rules", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Parts on jobs", painSignal: "Parts usage logged after closeout", equipifyModule: "Work Orders" },
    { capability: "Multi-site visibility", painSignal: "National accounts lack unified history", equipifyModule: "Reports" },
    { capability: "Repeat failure alerts", painSignal: "Same asset dispatched without failure context", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Mobile asset context", painSignal: "Field techs lack site equipment register on mobile", equipifyModule: "Mobile Work Orders" },
    { capability: "PM checklist on asset", painSignal: "Checklist completion not on equipment record", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Warranty on work orders", painSignal: "OEM warranty status not visible on job", equipifyModule: "Work Orders" },
    { capability: "Customer service intake", painSignal: "Requests scattered across email", equipifyModule: "Work Orders" },
    { capability: "Invoicing-ready closeout", painSignal: "Job closeout delays billing", equipifyModule: "Work Orders" },
    { capability: "Installed base register", painSignal: "Sales and service see different equipment lists", equipifyModule: "Equipment + Service History" },
    { capability: "Subcontractor history merge", painSignal: "Vendor work missing from customer asset", equipifyModule: "Service History + Reports" },
    { capability: "PM compliance reporting", painSignal: "Manual exports for customer QBRs", equipifyModule: "Reports" },
    { capability: "Route-aware PM planning", painSignal: "PM routes ignore geographic density", equipifyModule: "Work Orders + Dispatch" },
  ],
    recommendedCtas: [
    "Review PM-to-dispatch flow for your contract mix",
    "See asset history on mobile before repeat failure visits",
    "Walk through contract-tier dispatch prioritization",
    "Explore parts capture tied to job margin reporting",
    "See multi-site service history for national accounts",
    "Map repeat failure alerts on your dispatch board",
    "Review PM checklist completion on asset records",
    "See warranty visibility on commercial equipment jobs",
    "Walk through customer-ready PM compliance reports",
    "Explore route-aware PM scheduling by geography",
    "Review same-day closeout for faster invoicing",
    "See installed base shared between sales and service",
    "Compare emergency vs PM queue management",
    "Walk through asset register maintenance per customer site",
    "Review subcontractor work merged into customer history",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a billing system.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior commercial equipment history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our PM contract workflows are too specialized.",
      "commercial equipment service programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your PM contract workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for customer QBR reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with PM scheduling and asset history often pays back within one renewal cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and repeat visit reduction—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for commercial equipment service operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many commercial equipment service teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "commercial equipment service leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "National multi-site account complexity mentioned",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Only wants consumer-style booking with no asset register",
  ],
    personalizationOpeners: [
    "Commercial equipment teams often struggle when PM contracts do not drive scheduled work—is that true for you?",
    "Techs arriving without asset history drives repeat truck rolls—we hear that from ops leaders often.",
    "National accounts usually want unified service history across sites—how do you deliver that today?",
    "When emergencies spike, PM routes often collapse—does your dispatch team feel that?",
    "Parts margin stays hidden when usage is logged after closeout—sound familiar?",
    "Contract tier priority rules living in dispatcher memory do not scale—your experience?",
    "Sales and service misaligned on installed base hurts renewals—how tight is your register?",
    "QBR prep that requires manual exports is a common pain for account teams—is that you?",
  ],
    industryVocabulary: [
    "installed base",
    "PM contract",
    "capital asset",
    "truck roll",
    "contract tier",
    "T&M",
    "multi-site account",
    "asset tag",
    "preventive maintenance",
    "service history",
  ],
    industryMetrics: [
    "First-time fix rate",
    "PM compliance % by customer",
    "Repeat visit rate by asset",
    "Parts margin per job",
    "Mean time to respond",
    "Jobs closed same day",
    "Contract gross margin",
    "Emergency vs PM mix",
  ],
    industryTriggers: [
    "New national account win",
    "Contract renewal at risk",
    "Dispatch coordinator bottleneck",
    "Repeat failure escalation from key customer",
    "Acquisition of regional competitor",
    "Spreadsheet PM tracking failure",
    "CRM or billing system change",
    "Seasonal PM volume spike",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildIndustrialEquipmentEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "Outage scope in one view", hook: "Share shutdown work package status across crews", audience: "Plant maintenance manager", theme: "outage" },
    { title: "Findings become work", hook: "Turn vibration and IR results into assigned jobs", audience: "Reliability engineer", theme: "inspection" },
    { title: "LOTO on the job", hook: "Keep safety documentation attached to each work order", audience: "Safety lead", theme: "safety" },
    { title: "Rebuild history matters", hook: "Track rotating asset rebuild cycles over years", audience: "Maintenance planner", theme: "rebuild" },
    { title: "Plant PM compliance", hook: "Report PM completion by area without spreadsheets", audience: "Operations director", theme: "compliance" },
    { title: "Alert to action", hook: "Assign corrective work from predictive monitoring alerts", audience: "Reliability lead", theme: "predictive" },
    { title: "Bulletin compliance", hook: "Tie OEM safety notices to affected serial numbers", audience: "Compliance lead", theme: "oem" },
    { title: "Run hours drive PM", hook: "Schedule PM from meter readings not calendar guesses", audience: "Planner", theme: "meter" },
    { title: "Restart-ready punch", hook: "Track punch items through turnaround restart", audience: "Turnaround manager", theme: "punch" },
    { title: "Spare when it counts", hook: "Surface critical spare location during failure calls", audience: "Field supervisor", theme: "spares" },
    { title: "Certified dispatch", hook: "Match tech certification to job hazard level", audience: "Ops lead", theme: "certification" },
    { title: "Live turnaround status", hook: "Reflect scope changes in real-time job status", audience: "Shutdown coordinator", theme: "status" },
    { title: "Uptime proof", hook: "Document PM evidence for uptime contract disputes", audience: "Service manager", theme: "uptime" },
    { title: "Contractor in the record", hook: "Merge contractor work into plant asset history", audience: "Maintenance manager", theme: "contractor" },
    { title: "Repeat train failures", hook: "Trend repeat failures on critical equipment trains", audience: "Reliability engineer", theme: "repeat" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "industrial_equipment",
    overview: "Industrial equipment service providers support plants, utilities, OEM field teams, and process facilities with outage-driven PM, safety-critical inspections, and uptime contracts on rotating and fixed assets. Revenue combines turnaround projects, recurring PM agreements, emergency outage response, and parts on critical spares programs. Teams range from single-plant contractors to regional OEM service branches covering multiple facilities. Maturity stages span paper LOTO packets and spreadsheet outage scopes, mid-size teams linking inspections to work orders, and mature programs integrating shutdown planning, asset rebuild tracking, and plant-area compliance reporting.",
    operationalPains: [
    "Outage PM windows coordinated manually across trades",
    "Vibration and inspection findings do not flow into work orders",
    "Safety lockout documentation separate from job records",
    "Multi-crew shutdowns lack shared visibility on scope completion",
    "Spares and rebuild tracking for rotating assets fragmented",
    "Predictive monitoring alerts not creating assigned corrective work",
    "Permit-to-work status not visible on active jobs",
    "OEM bulletin compliance not tied to asset serials",
    "Contractor and internal crew work split across systems",
    "Post-outage punch items lost after restart pressure",
    "Critical spare location unknown during failure events",
    "Plant-area PM compliance reporting requires manual assembly",
    "Technician skill certification not matched to job hazard level",
    "Rotating asset run-hour meters not driving PM schedules",
    "Turnaround scope changes not reflected in live job status",
  ],
    financialPains: [
    "Unplanned downtime cost dwarfs software investment on critical assets",
    "Outage overtime and contractor premiums blow turnaround budget",
    "Repeat bearing failures on same train erode contract margin",
    "Spares inventory obsolescence without usage linkage",
    "Safety incident liability from incomplete job documentation",
    "Penalty clauses on uptime contracts when PM evidence weak",
    "Inefficient crew utilization during compressed outage windows",
    "Travel and per diem on poorly sequenced multi-plant routes",
    "Warranty recovery missed when OEM bulletins not documented",
    "Capital deferral when replacement data not tied to service history",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Plant Maintenance Manager",
      goals: [
        "Execute outage PM on schedule",
        "Link inspection findings to work",
      ],
      kpis: [
        "Outage scope completion %",
        "Safety doc compliance",
        "Unplanned downtime hours",
      ],
      frustrations: [
        "Shutdown scope in multiple spreadsheets",
        "Inspection results not creating work orders",
      ],
      buyingTriggers: [
        "Major turnaround approaching",
        "Safety incident during maintenance",
      ],
      commonObjections: [
        "EAM owns plant assets",
        "Too integrated with OT systems",
      ],
      successMetrics: [
        "Outage PM on window",
        "Inspection findings closed before restart",
      ],
    }),
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Compliance Lead",
      goals: [
        "Maintain traceable documentation for audits",
        "Close corrective actions on time",
      ],
      kpis: [
        "Open corrective actions",
        "Certificate compliance %",
        "Audit prep hours",
      ],
      frustrations: [
        "Certificates scattered across folders",
        "Failed inspections lack closed-loop tracking",
      ],
      buyingTriggers: [
        "Failed audit or customer audit",
        "Regulatory documentation deadline",
      ],
      commonObjections: [
        "Existing QMS handles compliance",
        "Security review blocks new vendors",
      ],
      successMetrics: [
        "Audit prep time reduced",
        "Corrective actions closed on schedule",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do you plan and track outage PM scope?",
    "Where do inspection findings become assigned work?",
    "How is safety documentation attached to jobs?"
  ],
  revenue: [
    "What visibility do supervisors have during shutdowns?",
    "How do uptime contracts map to PM evidence requirements?",
    "How do you track spares and rebuild cycles on critical assets?"
  ],
  dispatch: [
    "How are emergency outage calls prioritized vs planned PM?",
    "How do multi-crew shutdowns share live scope status?",
    "How are certified techs matched to hazard-level jobs?"
  ],
  compliance: [
    "How are LOTO and permit records linked to work orders?",
    "Where do OEM safety bulletins attach to affected assets?",
    "How do you report PM compliance by plant area?"
  ],
  technicians: [
    "What context do techs see on rotating equipment history?",
    "How are run-hour meters captured for PM scheduling?",
    "Where do vibration or IR findings get recorded?"
  ],
  customer: [
    "How do plant owners track open outage scope completion?",
    "What reporting do reliability engineers expect post-turnaround?",
    "How are punch items tracked before restart?"
  ],
  reporting: [
    "Which uptime and PM KPIs do you report per plant?",
    "How do you trend repeat failures on critical trains?",
    "Can you produce audit-ready outage completion records?"
  ],
  growth: [
    "What breaks when you add a new plant account?",
    "How do OEM field expansions affect dispatch capacity?",
    "What limits predictive program scale without better work order linkage?"
  ],
  contracts: [
    "How are outage windows reflected in contract SLAs?",
    "Where do response commitments map to emergency dispatch?",
    "How do you prove PM completion for uptime penalties?"
  ],
  equipment: [
    "How is the plant asset register maintained by area?",
    "Where do serial and rebuild history live for rotating assets?",
    "How do you track critical spare locations and usage?"
  ]
}),
    proofPoints: [
    "Shutdown work packages with shared scope visibility across crews",
    "Inspection-to-work-order linkage for rotating equipment",
    "Safety and job documentation in one auditable record",
    "Asset rebuild and spares history over equipment life",
    "Reporting on PM compliance by plant area",
    "Predictive alert follow-up tracked as structured work",
    "OEM bulletin compliance tied to serial-level assets",
    "Run-hour driven PM schedules on critical rotating assets",
    "Punch item tracking through restart readiness",
    "Critical spare visibility during failure response",
    "Certification-aware technician assignment on hazardous jobs",
    "Turnaround scope changes reflected in live job status",
  ],
    capabilityMappings: [
    { capability: "Outage work packages", painSignal: "Shutdown scope tracked in spreadsheets", equipifyModule: "Work Orders" },
    { capability: "Inspection-to-work linkage", painSignal: "Vibration findings not creating jobs", equipifyModule: "Work Orders" },
    { capability: "LOTO documentation", painSignal: "Safety docs separate from job records", equipifyModule: "Service History + Reports" },
    { capability: "Rotating asset history", painSignal: "Rebuild cycles not on asset register", equipifyModule: "Equipment + Service History" },
    { capability: "Plant-area PM reporting", painSignal: "Compliance reports manually assembled", equipifyModule: "Reports" },
    { capability: "Predictive alert follow-up", painSignal: "Monitoring alerts not assigned work", equipifyModule: "Work Orders" },
    { capability: "OEM bulletin tracking", painSignal: "Safety bulletins not on affected serials", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Run-hour PM scheduling", painSignal: "Meter readings not driving PM due dates", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Multi-crew shutdown visibility", painSignal: "Crews lack shared scope completion view", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Critical spare tracking", painSignal: "Spare location unknown during failures", equipifyModule: "Equipment + Service History" },
    { capability: "Punch item management", painSignal: "Post-outage items lost after restart", equipifyModule: "Work Orders" },
    { capability: "Uptime contract evidence", painSignal: "PM proof weak for penalty disputes", equipifyModule: "Reports" },
    { capability: "Certification-based dispatch", painSignal: "Wrong tech assigned to hazardous job", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Turnaround live status", painSignal: "Scope changes not reflected in job status", equipifyModule: "Reports" },
    { capability: "Contractor work merge", painSignal: "Contractor jobs missing from asset history", equipifyModule: "Service History + Reports" },
  ],
    recommendedCtas: [
    "Review outage PM workflow for your next turnaround",
    "See inspection findings flow into assigned work orders",
    "Walk through LOTO and job documentation in one record",
    "Explore rotating asset rebuild history on the register",
    "See plant-area PM compliance reporting without exports",
    "Map predictive alert follow-up to structured work",
    "Review OEM bulletin compliance tied to serial numbers",
    "See run-hour driven PM on critical rotating assets",
    "Walk through multi-crew shutdown scope visibility",
    "Explore critical spare tracking during failure response",
    "Review punch item tracking through restart readiness",
    "See uptime contract PM evidence for penalty protection",
    "Discuss certification-aware dispatch for hazardous jobs",
    "Walk through turnaround live status for ops leads",
    "Review contractor work merged into plant asset history",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a EAM.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior industrial history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our turnaround workflows are too specialized.",
      "industrial equipment service programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your turnaround workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for safety reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with outage PM and inspection linkage often pays back within one turnaround cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and unplanned downtime reduction—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for industrial equipment service operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many industrial equipment service teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "industrial equipment service leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "Turnaround or outage window named in next 6 months",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Requires full EAM rip-and-replace before pilot",
  ],
    personalizationOpeners: [
    "Industrial service teams often coordinate outage PM in spreadsheets—is that still true for your shutdowns?",
    "Inspection findings that do not become work orders frustrate reliability engineers—we hear that often.",
    "LOTO documentation separate from job records creates audit risk—how do you handle that?",
    "Multi-crew shutdowns without shared scope visibility cause restart delays—sound familiar?",
    "Rotating asset rebuild history scattered across files hurts planning—your experience?",
    "Predictive alerts that stop at email instead of assigned work limit program ROI—on your radar?",
    "Uptime contract disputes when PM evidence is weak are expensive—how strong are your records?",
    "Punch items lost after restart pressure is a common turnaround pain—does that happen here?",
  ],
    industryVocabulary: [
    "turnaround",
    "LOTO",
    "rotating equipment",
    "vibration analysis",
    "run hours",
    "uptime contract",
    "plant area",
    "OEM bulletin",
    "critical spare",
    "predictive maintenance",
  ],
    industryMetrics: [
    "Outage scope completion %",
    "Unplanned downtime hours",
    "PM compliance by plant area",
    "Repeat failure rate on critical trains",
    "Mean time to repair on outages",
    "Safety documentation compliance",
    "Predictive alert closure time",
    "Turnaround labor variance",
  ],
    industryTriggers: [
    "Major turnaround scheduled",
    "Uptime penalty on critical contract",
    "Safety incident during maintenance",
    "OEM bulletin affecting installed base",
    "New plant account win",
    "Predictive monitoring program expansion",
    "EAM replacement evaluation",
    "Reliability engineer mandate for inspection linkage",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildFieldServiceEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "Dispatch without chaos", hook: "Replace phone-and-spreadsheet dispatch with live board", audience: "Operations director", theme: "dispatch" },
    { title: "Context on route", hook: "Asset and customer history on mobile before arrival", audience: "Field supervisor", theme: "mobile" },
    { title: "Stop repeat rolls", hook: "Surface repeat failures before assigning another visit", audience: "Dispatcher", theme: "repeat" },
    { title: "Closeout to cash", hook: "Same-day closeout for faster invoicing on T&M", audience: "Finance ops lead", theme: "billing" },
    { title: "KPIs without exports", hook: "Ops dashboards from live data not spreadsheets", audience: "Operations director", theme: "reporting" },
    { title: "PM from agreements", hook: "Maintenance contracts that schedule themselves", audience: "Service manager", theme: "pm" },
    { title: "Branches in sync", hook: "Multi-branch dispatch visibility for leadership", audience: "Regional ops lead", theme: "multi-branch" },
    { title: "Right tech, right job", hook: "Skill rules on dispatch reduce callbacks", audience: "Dispatch manager", theme: "skills" },
    { title: "Parts on the job", hook: "Capture parts at closeout for margin visibility", audience: "Service admin", theme: "parts" },
    { title: "After-hours clarity", hook: "On-call dispatch with job context not guesswork", audience: "On-call coordinator", theme: "on-call" },
    { title: "Asset evidence", hook: "Photos and notes on equipment history not lost emails", audience: "Field tech lead", theme: "documentation" },
    { title: "One account view", hook: "Service history across trades for account managers", audience: "Account manager", theme: "account" },
    { title: "Seasonal survival", hook: "Capacity visibility before peak season breaks dispatch", audience: "Ops planner", theme: "seasonal" },
    { title: "Renew with proof", hook: "Service KPIs for contract renewal conversations", audience: "Sales director", theme: "renewal" },
    { title: "Owner time back", hook: "Less firefighting dispatch, more growth focus", audience: "Owner-operator", theme: "growth" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "field_service",
    overview: "General field service operators run dispatch-heavy mixed-trade businesses across regions—serving varied equipment types, account tiers, and contract mixes from owner-operators to multi-branch service companies. Revenue combines service contracts, emergency response, installation follow-up, and parts. Maturity spans phone-and-whiteboard dispatch, spreadsheet job tracking, and growing teams adopting mobile work orders while struggling to unify asset history across trades. Equipify fits operators who have outgrown simple scheduling but need asset-centric PM, dispatch, and reporting without enterprise implementation timelines.",
    operationalPains: [
    "Dispatch relies on phone and spreadsheets as volume grows",
    "Technicians lack consistent mobile access to job and asset context",
    "Repeat visits happen because history is not visible on route",
    "Billing and job closeout lag behind completed work",
    "KPI reporting requires manual exports from multiple tools",
    "Contract PM and T&M jobs compete in disconnected queues",
    "New tech onboarding slow without standardized mobile workflows",
    "Customer status updates require dispatcher phone calls",
    "After-hours on-call routing lacks job and asset context",
    "Parts ordering disconnected from open job status",
    "Multi-branch teams lack shared dispatch visibility",
    "Skill-based assignment rules inconsistent across dispatchers",
    "Job photos and notes not tied to asset records",
    "Seasonal demand spikes overwhelm manual scheduling",
    "Account-level service history fragmented by trade or tech",
  ],
    financialPains: [
    "Coordinator headcount scales linearly with call volume",
    "Repeat truck rolls directly erode job gross margin",
    "Delayed invoicing hurts cash flow on high-volume T&M",
    "Overtime spikes during seasonal peaks blow labor budget",
    "Parts margin lost when not captured at job closeout",
    "Under-utilized tech capacity from poor route planning",
    "Contract renewals discounted without service cost proof",
    "Marketing spend wasted when callbacks damage reputation",
    "Tool sprawl subscription cost without unified reporting",
    "Owner time consumed firefighting dispatch instead of growth",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Dispatch Manager",
      goals: [
        "Prioritize by contract tier and urgency",
        "Reduce windshield time",
      ],
      kpis: [
        "Emergency response time",
        "PM route completion rate",
        "Overtime hours",
      ],
      frustrations: [
        "Emergencies blow up planned routes",
        "No single queue for contract and T&M",
      ],
      buyingTriggers: [
        "Missed SLA on chain account",
        "Dispatcher turnover",
      ],
      commonObjections: [
        "Current dispatch board is good enough",
        "Peak season is bad timing",
      ],
      successMetrics: [
        "On-time PM completion up",
        "Emergency SLA attainment improved",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
    buildBuyerPersona({
      title: "Sales Director",
      goals: [
        "Win renewals with service proof",
        "Expand installed base revenue",
      ],
      kpis: [
        "Renewal rate",
        "Attach rate on service contracts",
        "Pipeline conversion",
      ],
      frustrations: [
        "No service data before renewal calls",
        "Quotes disconnected from assets",
      ],
      buyingTriggers: [
        "Competitive renewal battle",
        "New vertical expansion",
      ],
      commonObjections: [
        "CRM is enough for sales",
        "Service should fix their own data",
      ],
      successMetrics: [
        "Renewals won with uptime data",
        "Upsell from end-of-life signals",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How are today's jobs assigned and re-prioritized?",
    "What context does a tech see on mobile before arrival?",
    "How do you identify accounts with repeat truck rolls?"
  ],
  revenue: [
    "What slows job closeout and invoicing?",
    "Which KPIs do you report weekly and where from?",
    "How does contract renewal use service performance data?"
  ],
  dispatch: [
    "How do emergencies get inserted into planned routes?",
    "What visibility do you have across branches?",
    "How are skill-based assignments handled today?"
  ],
  compliance: [
    "How are safety or checklist requirements enforced on jobs?",
    "Where is job documentation stored for disputes?",
    "How do warranty jobs get documented?"
  ],
  technicians: [
    "What causes duplicate data entry after field visits?",
    "How do new techs learn your closeout process?",
    "Where do techs order parts relative to open jobs?"
  ],
  customer: [
    "How do customers get status updates on open jobs?",
    "What service history can account managers share?",
    "How are after-hours requests handled?"
  ],
  reporting: [
    "Can you report first-time fix without spreadsheet math?",
    "How do you track technician utilization?",
    "What margin visibility exists per job or account?"
  ],
  growth: [
    "What breaks when you add a second branch?",
    "How would 20% call volume growth affect dispatch?",
    "What limits new contract types without better PM scheduling?"
  ],
  contracts: [
    "How do maintenance agreements create scheduled visits?",
    "Where do SLA tiers affect dispatch priority?",
    "How do you prove PM completion for billing?"
  ],
  equipment: [
    "Do you maintain an asset register per customer site?",
    "How is equipment history shared across trades?",
    "Where do serial and model details live?"
  ]
}),
    proofPoints: [
    "Dispatch board with live job status and technician assignment",
    "Mobile-friendly work orders with asset and customer context",
    "Repeat failure visibility by account and asset",
    "Job completion flows supporting faster invoicing",
    "Operational dashboards without spreadsheet exports",
    "Contract PM auto-scheduling from maintenance agreements",
    "Multi-branch dispatch visibility for ops leadership",
    "Skill-based assignment rules on dispatch board",
    "Parts capture on jobs for margin reporting",
    "After-hours dispatch with job and asset context",
    "Photo and note documentation tied to asset history",
    "Account-level service history across trades and techs",
  ],
    capabilityMappings: [
    { capability: "Live dispatch board", painSignal: "Jobs assigned via phone and spreadsheets", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Mobile job context", painSignal: "Techs lack asset history on mobile", equipifyModule: "Mobile Work Orders" },
    { capability: "Repeat failure visibility", painSignal: "Repeat visits without prior failure context", equipifyModule: "Reports" },
    { capability: "Fast job closeout", painSignal: "Billing lags days after completion", equipifyModule: "Work Orders" },
    { capability: "Ops dashboards", painSignal: "KPIs require manual multi-tool exports", equipifyModule: "Reports" },
    { capability: "Agreement-driven PM", painSignal: "Maintenance contracts not scheduling visits", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Multi-branch visibility", painSignal: "Branches dispatch in silos", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Skill-based routing", painSignal: "Wrong tech dispatched for job type", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Parts on jobs", painSignal: "Parts margin invisible at closeout", equipifyModule: "Work Orders" },
    { capability: "After-hours context", painSignal: "On-call lacks job and asset details", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Asset documentation", painSignal: "Photos and notes not on asset record", equipifyModule: "Service History + Reports" },
    { capability: "Account service history", painSignal: "History fragmented by trade", equipifyModule: "Service History + Reports" },
    { capability: "Customer status workflow", painSignal: "Status updates require phone calls", equipifyModule: "Work Orders" },
    { capability: "Seasonal capacity view", painSignal: "Peak season overload without visibility", equipifyModule: "Reports" },
    { capability: "Renewal performance data", painSignal: "Renewals without service KPI proof", equipifyModule: "Reports" },
  ],
    recommendedCtas: [
    "See dispatch workflow for mixed-trade field teams",
    "Review mobile job flow with asset context on route",
    "Walk through repeat failure visibility by account",
    "Explore faster closeout and invoicing on T&M work",
    "See operational dashboards without spreadsheet exports",
    "Review maintenance agreement PM scheduling",
    "Compare multi-branch dispatch visibility options",
    "Discuss skill-based assignment on your dispatch board",
    "See parts capture tied to job margin reporting",
    "Walk through after-hours dispatch with full job context",
    "Review asset photo and note history on equipment records",
    "See account-level history across trades and technicians",
    "Explore seasonal capacity planning for ops leads",
    "Review contract renewal proof from service KPIs",
    "Map your current dispatch bottlenecks in a workflow session",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a scheduling app.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior field service history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our dispatch workflows are too specialized.",
      "field service programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your dispatch workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for customer dispute reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with dispatch and mobile closeout often pays back within one peak season cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and first-time fix improvement—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for field service operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many field service teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "field service leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "Named dispatcher or ops leader on evaluation",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Wants residential consumer booking only",
  ],
    personalizationOpeners: [
    "Field service teams often outgrow phone-and-spreadsheet dispatch—is that where you are?",
    "Repeat truck rolls when history is not on the route hurt margin—we hear that constantly.",
    "Closeout and invoicing lag is a cash-flow killer for high-volume shops—your experience?",
    "KPI reporting from multiple tool exports consumes ops leader time—sound familiar?",
    "Maintenance agreements that do not schedule PM visits leave money on the table—true for you?",
    "Multi-branch dispatch in silos makes leadership blind to backlog—how do you cope?",
    "After-hours on-call without job context frustrates techs and customers—on your radar?",
    "Seasonal peaks that break dispatch are a common trigger for change—timing wise?",
  ],
    industryVocabulary: [
    "dispatch board",
    "truck roll",
    "first-time fix",
    "T&M",
    "maintenance agreement",
    "closeout",
    "route",
    "callback",
    "field tech",
    "service contract",
  ],
    industryMetrics: [
    "First-time fix rate",
    "Jobs per tech per day",
    "Average response time",
    "Same-day closeout rate",
    "Repeat visit rate",
    "Technician utilization",
    "Revenue per truck roll",
    "Contract renewal rate",
  ],
    industryTriggers: [
    "Call volume growth outpacing dispatch capacity",
    "New branch opening",
    "Dispatcher turnover or burnout",
    "Contract renewal requiring KPI proof",
    "Mobile rollout failure with prior vendor",
    "Owner-operator hiring first coordinator",
    "Seasonal peak approaching",
    "Customer complaint on repeat visits",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildCalibrationInspectionEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "Due dates drive routes", hook: "Schedule field metrology from instrument due dates not guesses", audience: "Operations director", theme: "scheduling" },
    { title: "Lab meets field", hook: "One asset record for lab and field teams", audience: "Quality manager", theme: "unity" },
    { title: "OOT to action", hook: "Structured workflow when instruments fail calibration", audience: "Compliance lead", theme: "oot" },
    { title: "Certificate on the asset", hook: "Full certificate history on each instrument", audience: "Quality admin", theme: "certificate" },
    { title: "Overdue before the audit", hook: "Proactive overdue reports for customers", audience: "Account manager", theme: "overdue" },
    { title: "Traceability chain", hook: "Standards traceability linked to every job", audience: "Metrology lead", theme: "traceability" },
    { title: "Route-smart cal", hook: "Plan routes by geographic due-date density", audience: "Field supervisor", theme: "routing" },
    { title: "No batch certificate panic", hook: "Automate certificates from completed jobs", audience: "Lab manager", theme: "automation" },
    { title: "ISO audit ready", hook: "Retrieve certificates by asset for audits", audience: "Quality manager", theme: "iso" },
    { title: "Right competency", hook: "Assign techs by scope and competency records", audience: "Ops lead", theme: "competency" },
    { title: "Rush with visibility", hook: "Insert rush jobs without losing route control", audience: "Dispatcher", theme: "rush" },
    { title: "Location current", hook: "Update asset location before route dispatch", audience: "Field coordinator", theme: "location" },
    { title: "Customer intake", hook: "Portal requests become scheduled cal work", audience: "Customer service lead", theme: "intake" },
    { title: "Lab capacity fit", hook: "Align field schedules with lab throughput", audience: "Lab director", theme: "capacity" },
    { title: "Contract intervals", hook: "Cal intervals from contracts into scheduled work", audience: "Service manager", theme: "contract" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "calibration_inspection",
    overview: "Calibration and inspection firms manage traceable standards, certificate renewals, field metrology routes, and compliance programs for ISO, FDA, and customer audit requirements. Revenue blends recurring calibration contracts, inspection services, rush fees, and lab throughput. Teams range from single-lab shops with field routes to multi-site metrology organizations serving manufacturing and life sciences. Maturity stages include certificate spreadsheets, lab LIMS disconnected from field scheduling, and growing firms unifying due-date scheduling, asset registers, and automated certificate delivery.",
    operationalPains: [
    "Certificate due dates live outside the work order system",
    "Field and lab workflows use different tracking methods",
    "Recall of out-of-tolerance instruments is manual",
    "Customer asset registers drift from actual installed base",
    "Batch certificate generation error-prone at month end",
    "Standards traceability chain not linked to field jobs",
    "Route planning ignores geographic density of due dates",
    "Failed cal events lack structured corrective workflows",
    "Customer portal requests not creating scheduled work",
    "ISO audit prep requires manual certificate gathering",
    "Rush jobs disrupt planned routes without visibility",
    "Technician competency records not matched to scope",
    "Asset location changes not updated before route dispatch",
    "Subcontractor cal work not merged into customer history",
    "Customer overdue instrument reports require manual assembly",
  ],
    financialPains: [
    "Rush fees lost when due-date visibility poor",
    "Lab rework cost from certificate errors at month end",
    "Route inefficiency erodes field metrology margin",
    "Customer churn when overdue instruments discovered at audit",
    "Under-billed travel on low-density calibration routes",
    "Wasted lab capacity when field schedules misaligned",
    "Penalty exposure on ISO or customer audit findings",
    "Manual report prep labor scales with customer count",
    "Inventory cost on standards without usage linkage",
    "Revenue leakage when closeout delays billing",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Quality Manager",
      goals: [
        "Maintain traceable calibration records",
        "Automate certificate delivery",
      ],
      kpis: [
        "On-time calibration %",
        "Certificate error rate",
        "Customer overdue instruments",
      ],
      frustrations: [
        "Lab and field use different tracking",
        "Month-end certificate batch errors",
      ],
      buyingTriggers: [
        "Customer audit failure",
        "ISO surveillance audit scheduled",
      ],
      commonObjections: [
        "LIMS handles lab side",
        "Customers resist portal changes",
      ],
      successMetrics: [
        "Overdue calibrations reduced",
        "Certificate rework eliminated",
      ],
    }),
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Compliance Lead",
      goals: [
        "Maintain traceable documentation for audits",
        "Close corrective actions on time",
      ],
      kpis: [
        "Open corrective actions",
        "Certificate compliance %",
        "Audit prep hours",
      ],
      frustrations: [
        "Certificates scattered across folders",
        "Failed inspections lack closed-loop tracking",
      ],
      buyingTriggers: [
        "Failed audit or customer audit",
        "Regulatory documentation deadline",
      ],
      commonObjections: [
        "Existing QMS handles compliance",
        "Security review blocks new vendors",
      ],
      successMetrics: [
        "Audit prep time reduced",
        "Corrective actions closed on schedule",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do you track calibration due dates by customer asset?",
    "How do lab and field teams share the same asset record?",
    "What happens when an instrument fails calibration?"
  ],
  revenue: [
    "How often is the customer asset register reconciled?",
    "How are certificates delivered and archived?",
    "What reporting do customers expect on overdue instruments?"
  ],
  dispatch: [
    "How are field routes planned around due date clusters?",
    "How do rush jobs get inserted into planned routes?",
    "How are tech competencies matched to scope?"
  ],
  compliance: [
    "How do you maintain standards traceability on jobs?",
    "Where are ISO audit records tied to certificates?",
    "How are out-of-tolerance events documented?"
  ],
  technicians: [
    "What slows field cal closeout vs lab processing?",
    "How do techs access asset history on route?",
    "Where are as-found/as-left results stored?"
  ],
  customer: [
    "How do customers request recalibration or pickup?",
    "What portal or report format do they expect?",
    "How are overdue instruments communicated proactively?"
  ],
  reporting: [
    "Can you produce overdue lists by customer in minutes?",
    "How do you track certificate error rates?",
    "Which KPIs do quality leaders review monthly?"
  ],
  growth: [
    "What limits new customer onboarding without asset import?",
    "How do acquisitions affect certificate templates?",
    "What breaks when lab throughput doubles?"
  ],
  contracts: [
    "How are cal intervals set per asset in contracts?",
    "Where do rush SLAs map to dispatch priority?",
    "How do you prove service for contract renewals?"
  ],
  equipment: [
    "How is the customer instrument register maintained?",
    "Where do serial and model data stay current?",
    "How do location changes flow to dispatch?"
  ]
}),
    proofPoints: [
    "Due-date driven scheduling for calibration and inspection routes",
    "Unified asset records for lab and field teams",
    "Failed cal events trigger corrective workflows",
    "Certificate history attached to each asset",
    "Customer reporting on upcoming and overdue due dates",
    "Standards traceability linked to field and lab jobs",
    "Route planning by geographic due-date density",
    "Automated certificate delivery from completed jobs",
    "ISO audit-ready certificate retrieval by asset",
    "Competency-aware technician assignment",
    "Out-of-tolerance recall workflows with customer notification",
    "Subcontractor cal work merged into customer history",
  ],
    capabilityMappings: [
    { capability: "Due-date scheduling", painSignal: "Certificate due dates outside work orders", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Lab-field asset unity", painSignal: "Lab and field use different asset records", equipifyModule: "Equipment + Service History" },
    { capability: "OOT corrective workflow", painSignal: "Out-of-tolerance recall is manual", equipifyModule: "Work Orders" },
    { capability: "Certificate on asset", painSignal: "Certificates not attached to instrument history", equipifyModule: "Service History + Reports" },
    { capability: "Overdue customer reports", painSignal: "Overdue lists manually assembled", equipifyModule: "Reports" },
    { capability: "Standards traceability", painSignal: "Standard chain not linked to jobs", equipifyModule: "Service History + Reports" },
    { capability: "Route-aware planning", painSignal: "Routes ignore geographic due clusters", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Certificate automation", painSignal: "Month-end batch certificate errors", equipifyModule: "Reports" },
    { capability: "ISO audit retrieval", painSignal: "Audit prep requires manual gathering", equipifyModule: "Reports" },
    { capability: "Competency dispatch", painSignal: "Wrong tech assigned to specialized scope", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Rush job visibility", painSignal: "Rush disrupts routes without board visibility", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Location-aware assets", painSignal: "Asset moves not updated before dispatch", equipifyModule: "Equipment + Service History" },
    { capability: "Customer intake workflow", painSignal: "Portal requests not creating work", equipifyModule: "Work Orders" },
    { capability: "Lab throughput alignment", painSignal: "Field schedule misaligned with lab capacity", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Contract interval PM", painSignal: "Cal intervals not driving scheduled work", equipifyModule: "Service Contracts" },
  ],
    recommendedCtas: [
    "See due-date scheduling for field metrology routes",
    "Review lab and field unity on one asset record",
    "Walk through out-of-tolerance corrective workflows",
    "Explore certificate history attached to each instrument",
    "See overdue instrument reporting for customers",
    "Review standards traceability linked to jobs",
    "Map route planning by geographic due-date clusters",
    "See automated certificate delivery from completed jobs",
    "Walk through ISO audit-ready certificate retrieval",
    "Discuss competency-aware technician assignment",
    "Review rush job visibility on your dispatch board",
    "See location updates flowing to route dispatch",
    "Explore customer intake creating scheduled cal work",
    "Review lab throughput alignment with field schedules",
    "See contract intervals driving scheduled calibration",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a LIMS.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior calibration history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our metrology workflows are too specialized.",
      "calibration and inspection programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your metrology workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for ISO 17025 reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with due-date scheduling and certificates often pays back within one audit cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and on-time calibration improvement—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for calibration and inspection operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many calibration and inspection teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "calibration and inspection leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "ISO audit date mentioned",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Lab-only scope with no interest in field scheduling",
  ],
    personalizationOpeners: [
    "Calibration firms often track due dates outside work orders—is that still your reality?",
    "Lab and field teams on different asset records create certificate chaos—we hear that often.",
    "Out-of-tolerance recalls handled manually slow customer notification—sound familiar?",
    "Month-end certificate batch errors are a quality manager headache—your experience?",
    "ISO audit prep that requires manual certificate gathering is costly—how do you cope?",
    "Routes planned without geographic due-date clusters waste field margin—on your radar?",
    "Customer overdue instrument reports assembled manually risk churn—does that happen here?",
    "Standards traceability not linked to field jobs creates audit gaps—how tight is your chain?",
  ],
    industryVocabulary: [
    "traceability",
    "out-of-tolerance",
    "as-found/as-left",
    "NIST traceable",
    "cal interval",
    "certificate of calibration",
    "metrology",
    "ISO 17025",
    "instrument register",
    "due date",
  ],
    industryMetrics: [
    "On-time calibration %",
    "Certificate error rate",
    "Overdue instrument count by customer",
    "Field route utilization",
    "OOT event closure time",
    "Lab turnaround days",
    "Rush job SLA attainment",
    "Customer audit finding rate",
  ],
    industryTriggers: [
    "ISO surveillance audit scheduled",
    "Customer audit failure on overdue instruments",
    "Lab expansion or new field territory",
    "LIMS replacement evaluation",
    "Major customer contract renewal",
    "Certificate error incident at month end",
    "Acquisition of regional cal firm",
    "New life sciences customer onboarding",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildFacilityMaintenanceEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "One FM queue", hook: "Tenant, vendor, and internal work in one system", audience: "Facilities director", theme: "queue" },
    { title: "Rounds that matter", hook: "Building round findings tied to assets", audience: "Building engineer", theme: "rounds" },
    { title: "Vendor SLA proof", hook: "Track vendor SLAs with timestamps on jobs", audience: "FM contract manager", theme: "vendor" },
    { title: "Replace with history", hook: "Capital planning fed by asset service trends", audience: "Portfolio manager", theme: "capital" },
    { title: "Portfolio backlog", hook: "See open work age across all buildings", audience: "Operations director", theme: "portfolio" },
    { title: "Tenant transparency", hook: "Request intake with status tenants can trust", audience: "Property manager", theme: "tenant" },
    { title: "Life safety in rhythm", hook: "Life safety PM in the same queue as tenant work", audience: "Compliance lead", theme: "life-safety" },
    { title: "Vendor scorecards", hook: "Performance scorecards from completed job data", audience: "Procurement lead", theme: "scorecard" },
    { title: "After-hours fairness", hook: "Prioritize after-hours events with clear rules", audience: "Dispatch coordinator", theme: "after-hours" },
    { title: "Billback ready", hook: "Document tenant billbacks on work orders", audience: "Accounting lead", theme: "billback" },
    { title: "Renovation-ready assets", hook: "Update asset locations after space changes", audience: "Building engineer", theme: "renovation" },
    { title: "Inspection follow-up", hook: "Compliance findings become assigned work", audience: "Compliance lead", theme: "inspection" },
    { title: "Vendor meets internal", hook: "Merged history when vendor and internal touch same asset", audience: "Facilities director", theme: "history" },
    { title: "SLA on dispatch", hook: "FM contract SLAs reflected in daily priorities", audience: "Service manager", theme: "sla" },
    { title: "Mobile on site", hook: "Internal techs with building asset history on mobile", audience: "Field supervisor", theme: "mobile" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "facility_maintenance",
    overview: "Facility maintenance teams coordinate building systems, tenant requests, vendor work, and preventive rounds across portfolios—from single-campus operators to national FM providers managing mixed commercial properties. Revenue combines FM contracts, tenant billbacks, vendor markup, and capital project support. Maturity spans email-and-spreadsheet work intake, growing teams adding CMMS without asset linkage, and portfolio operators unifying tenant queues, vendor SLAs, building asset registers, and replacement planning fed by service history.",
    operationalPains: [
    "Tenant requests, vendor jobs, and internal PM sit in separate queues",
    "Building rounds generate paper that never ties to assets",
    "Vendor SLA tracking is reactive instead of proactive",
    "Capital replacement planning lacks service history context",
    "Multi-building portfolios lack unified backlog visibility",
    "After-hours tenant emergencies hard to prioritize fairly",
    "Vendor invoice reconciliation disconnected from work orders",
    "PM for life safety systems tracked outside main queue",
    "Space renovations lose asset location updates",
    "Tenant communication on open work requires manual calls",
    "Seasonal HVAC and weather events overwhelm intake",
    "Vendor performance scorecards assembled manually",
    "Internal tech and vendor work split on asset history",
    "Compliance inspections not driving follow-up work orders",
    "Portfolio acquisitions merge inconsistent asset registers",
  ],
    financialPains: [
    "Tenant satisfaction penalties on FM contracts",
    "Vendor markup lost when jobs not tracked to completion",
    "Overtime on after-hours events erodes contract margin",
    "Capital spend misallocated without failure trend data",
    "Duplicate vendor dispatch on same tenant issue",
    "Billback revenue leakage on untracked tenant-caused work",
    "Coordinator labor scales with portfolio size linearly",
    "SLA penalties on national FM accounts",
    "Energy waste from deferred PM on building systems",
    "Insurance exposure from undocumented life safety PM",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Facilities Director",
      goals: [
        "Unified backlog across buildings",
        "Proactive vendor SLA management",
      ],
      kpis: [
        "Open work order age",
        "Vendor SLA compliance",
        "Tenant satisfaction scores",
      ],
      frustrations: [
        "Tenant requests lost in email",
        "Building rounds not tied to assets",
      ],
      buyingTriggers: [
        "Portfolio acquisition",
        "Tenant complaint escalation",
      ],
      commonObjections: [
        "Property software should handle this",
        "Too many vendors to consolidate",
      ],
      successMetrics: [
        "Backlog age reduced",
        "Vendor penalties avoided",
      ],
    }),
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Dispatch Manager",
      goals: [
        "Prioritize by contract tier and urgency",
        "Reduce windshield time",
      ],
      kpis: [
        "Emergency response time",
        "PM route completion rate",
        "Overtime hours",
      ],
      frustrations: [
        "Emergencies blow up planned routes",
        "No single queue for contract and T&M",
      ],
      buyingTriggers: [
        "Missed SLA on chain account",
        "Dispatcher turnover",
      ],
      commonObjections: [
        "Current dispatch board is good enough",
        "Peak season is bad timing",
      ],
      successMetrics: [
        "On-time PM completion up",
        "Emergency SLA attainment improved",
      ],
    }),
    buildBuyerPersona({
      title: "Compliance Lead",
      goals: [
        "Maintain traceable documentation for audits",
        "Close corrective actions on time",
      ],
      kpis: [
        "Open corrective actions",
        "Certificate compliance %",
        "Audit prep hours",
      ],
      frustrations: [
        "Certificates scattered across folders",
        "Failed inspections lack closed-loop tracking",
      ],
      buyingTriggers: [
        "Failed audit or customer audit",
        "Regulatory documentation deadline",
      ],
      commonObjections: [
        "Existing QMS handles compliance",
        "Security review blocks new vendors",
      ],
      successMetrics: [
        "Audit prep time reduced",
        "Corrective actions closed on schedule",
      ],
    }),
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do tenant requests become tracked work?",
    "How are building rounds documented and followed up?",
    "How do you monitor vendor SLA performance?"
  ],
  revenue: [
    "What data informs capital replacement decisions?",
    "How do you see backlog across buildings?",
    "How are tenant billbacks documented and invoiced?"
  ],
  dispatch: [
    "How are after-hours emergencies prioritized?",
    "How do internal techs and vendors share one queue?",
    "What visibility exists across portfolio buildings?"
  ],
  compliance: [
    "How are life safety PM and inspections tracked?",
    "Where are compliance findings tied to assets?",
    "How do you prepare audit documentation by building?"
  ],
  technicians: [
    "What slows internal tech closeout on tenant jobs?",
    "How do techs access asset history in the field?",
    "Where are vendor job results recorded?"
  ],
  customer: [
    "How do tenants submit and track maintenance requests?",
    "What status communication do property owners expect?",
    "How are recurring tenant issues escalated?"
  ],
  reporting: [
    "Which FM KPIs do you report to ownership monthly?",
    "How do you score vendor performance?",
    "Can you report open work age by building?"
  ],
  growth: [
    "What breaks when you add buildings to the portfolio?",
    "How do acquisitions merge FM processes?",
    "What limits self-perform vs vendor mix optimization?"
  ],
  contracts: [
    "How are FM contract SLAs mapped to work priorities?",
    "Where do response times apply to tenant vs capital work?",
    "How do you prove SLA attainment for renewals?"
  ],
  equipment: [
    "How is the building asset register maintained?",
    "Where do rooftop and mechanical assets stay current?",
    "How do renovations update asset locations?"
  ]
}),
    proofPoints: [
    "Unified queue for tenant, vendor, and internal work",
    "Round findings linked to assets and follow-up jobs",
    "Vendor job tracking with SLA timestamps",
    "Asset history informs replacement planning",
    "Portfolio-level backlog and PM compliance views",
    "Tenant request intake with status visibility",
    "Life safety PM tracked in same operational system",
    "Vendor performance scorecards from completed jobs",
    "After-hours prioritization rules on dispatch board",
    "Billback documentation tied to tenant work orders",
    "Internal and vendor history merged on building assets",
    "Compliance inspection follow-up as structured work",
  ],
    capabilityMappings: [
    { capability: "Unified FM queue", painSignal: "Tenant, vendor, internal work in silos", equipifyModule: "Work Orders" },
    { capability: "Round-to-asset linkage", painSignal: "Building rounds on paper not assets", equipifyModule: "Equipment + Service History" },
    { capability: "Vendor SLA tracking", painSignal: "Vendor SLAs tracked reactively", equipifyModule: "Work Orders" },
    { capability: "Capital planning history", painSignal: "Replacement decisions without service data", equipifyModule: "Reports" },
    { capability: "Portfolio backlog view", painSignal: "Multi-building backlog invisible", equipifyModule: "Reports" },
    { capability: "Tenant intake workflow", painSignal: "Requests lost in email", equipifyModule: "Work Orders" },
    { capability: "Life safety PM", painSignal: "Life safety PM outside main queue", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Vendor scorecards", painSignal: "Vendor performance manually assembled", equipifyModule: "Reports" },
    { capability: "After-hours dispatch", painSignal: "After-hours priorities unclear", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Billback documentation", painSignal: "Tenant billbacks untracked", equipifyModule: "Work Orders" },
    { capability: "Asset register", painSignal: "Building assets stale after renovations", equipifyModule: "Equipment + Service History" },
    { capability: "Compliance follow-up", painSignal: "Inspection findings not creating work", equipifyModule: "Work Orders" },
    { capability: "Internal-vendor history", painSignal: "Split history on same asset", equipifyModule: "Service History + Reports" },
    { capability: "SLA contract mapping", painSignal: "FM contract SLAs not on dispatch rules", equipifyModule: "Service Contracts" },
    { capability: "Mobile building context", painSignal: "Techs lack asset history on site", equipifyModule: "Mobile Work Orders" },
  ],
    recommendedCtas: [
    "See unified queue for tenant, vendor, and internal work",
    "Review building rounds tied to assets and follow-up jobs",
    "Walk through vendor SLA tracking on completed jobs",
    "Explore asset history informing capital replacement",
    "See portfolio backlog visibility across buildings",
    "Review tenant request intake with status tracking",
    "Walk through life safety PM in your main queue",
    "See vendor performance scorecards from job data",
    "Discuss after-hours prioritization on dispatch board",
    "Review billback documentation on tenant work orders",
    "See building asset register maintenance after renovations",
    "Explore compliance inspection follow-up workflows",
    "Walk through internal and vendor history on one asset",
    "See FM contract SLA mapping to dispatch priorities",
    "Review mobile building context for internal techs",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a property management software.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior facilities history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our FM workflows are too specialized.",
      "facility maintenance programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your FM workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for life safety reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with unified queue and vendor SLAs often pays back within one contract renewal cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and SLA compliance improvement—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for facility maintenance operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many facility maintenance teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "facility maintenance leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "Portfolio acquisition or new building onboarding mentioned",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Property software RFP requires full replacement only",
  ],
    personalizationOpeners: [
    "Facility teams often juggle tenant, vendor, and internal work in separate queues—is that your reality?",
    "Building rounds on paper that never tie to assets waste engineer time—we hear that often.",
    "Vendor SLA tracking after the fact hurts FM contract renewals—sound familiar?",
    "Capital replacement without service history leads to misallocated spend—your experience?",
    "Portfolio backlog invisible across buildings frustrates directors—how do you see open work?",
    "After-hours tenant events without clear prioritization burn out coordinators—on your radar?",
    "Life safety PM outside the main queue creates compliance risk—does that happen here?",
    "Vendor scorecards assembled manually do not scale with portfolio growth—true for you?",
  ],
    industryVocabulary: [
    "FM contract",
    "tenant request",
    "building rounds",
    "vendor SLA",
    "life safety",
    "portfolio",
    "billback",
    "work order age",
    "capital replacement",
    "self-perform",
  ],
    industryMetrics: [
    "Open work order age by building",
    "Vendor SLA compliance %",
    "Tenant satisfaction score",
    "PM compliance on life safety",
    "After-hours response time",
    "Billback capture rate",
    "Internal vs vendor mix",
    "Capital deferral rate",
  ],
    industryTriggers: [
    "Portfolio acquisition",
    "Tenant satisfaction SLA miss",
    "National FM contract renewal",
    "Life safety audit finding",
    "CMMS replacement evaluation",
    "New property onboarding surge",
    "Vendor consolidation initiative",
    "Ownership demand for portfolio dashboards",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildCommercialHvacEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "Campus PM rhythm", hook: "Schedule RTU PM across sites without spreadsheet routes", audience: "Mechanical ops manager", theme: "pm" },
    { title: "Complaint to asset", hook: "Link comfort complaints to RTU work orders", audience: "Dispatch manager", theme: "complaint" },
    { title: "Kit on the RTU", hook: "Filter and belt PM kits tied to each unit", audience: "Field supervisor", theme: "kit" },
    { title: "BAS to work order", hook: "Turn BAS alarms into assigned corrective jobs", audience: "Building engineer", theme: "bas" },
    { title: "Refrigerant history", hook: "Refrigerant usage on RTU service records", audience: "Compliance lead", theme: "refrigerant" },
    { title: "Shoulder season ready", hook: "Capacity visibility before PM crunch hits", audience: "Operations director", theme: "seasonal" },
    { title: "Multi-site compliance", hook: "PM dashboards for mechanical contract portfolios", audience: "Service manager", theme: "multi-site" },
    { title: "Startup on file", hook: "Warranty and startup docs on asset records", audience: "Service admin", theme: "warranty" },
    { title: "Compressor trends", hook: "Spot repeat compressor failures by RTU", audience: "Mechanical lead", theme: "repeat" },
    { title: "Dispatch with kits", hook: "PM kit checklist visible on dispatch jobs", audience: "Dispatcher", theme: "dispatch" },
    { title: "Audit to action", hook: "Energy audit findings become assigned work", audience: "Sustainability lead", theme: "audit" },
    { title: "RTU register current", hook: "Update assets after rooftop replacements", audience: "Operations planner", theme: "register" },
    { title: "Agreement PM", hook: "Mechanical contracts that schedule PM visits", audience: "Account manager", theme: "contract" },
    { title: "No-heat priority", hook: "Emergency rules that protect PM routes", audience: "Dispatch manager", theme: "emergency" },
    { title: "PM proof for renewals", hook: "Customer PM reports without manual exports", audience: "Sales director", theme: "renewal" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "commercial_hvac",
    overview: "Commercial HVAC teams maintain rooftop units, BAS-linked comfort systems, and multi-site mechanical contracts for offices, retail, healthcare, and industrial properties. Revenue blends PM agreements, emergency comfort calls, retrofit projects, and parts. Operators range from local mechanical contractors to regional firms with hundreds of RTUs under contract. Maturity stages include seasonal spreadsheet PM, dispatch tools without asset linkage, and growing mechanical ops teams tying BAS alarms, filter PM kits, and campus-level scheduling to unified equipment registers.",
    operationalPains: [
    "RTU PM routes hard to balance across campuses",
    "BAS trends do not tie to assigned corrective work",
    "Filter and belt PM kits not linked to assets",
    "Comfort complaints tracked separately from work orders",
    "Multi-site mechanical contracts lack campus PM visibility",
    "Emergency no-heat/no-cool calls disrupt planned PM routes",
    "Warranty and startup documentation not on asset records",
    "Refrigerant tracking separate from service history",
    "Seasonal PM volume overwhelms manual scheduling",
    "Subcontractor mechanical work not on customer asset history",
    "Energy audit findings not driving follow-up work",
    "RTU asset register stale after rooftop replacements",
    "Dispatcher lacks filter PM kit checklist on jobs",
    "Customer reporting on PM compliance requires exports",
    "Technician notes on airflow issues not trended by asset",
  ],
    financialPains: [
    "Missed PM drives emergency overtime in peak seasons",
    "Filter and belt PM kit waste when not asset-linked",
    "Contract renewals discounted without PM compliance proof",
    "Repeat compressor callbacks erode agreement margin",
    "Travel inefficiency on multi-campus RTU routes",
    "Warranty recovery missed without startup documentation",
    "BAS nuisance callbacks cost labor without root-cause tracking",
    "Under-billed materials on T&M comfort calls",
    "Coordinator overtime during shoulder season PM crunch",
    "Lost retrofit upsell when asset age not visible",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Mechanical Operations Manager",
      goals: [
        "Balance RTU PM across campuses",
        "Tie BAS alarms to corrective work",
      ],
      kpis: [
        "PM completion by site",
        "Comfort callback rate",
        "Filter PM kit usage",
      ],
      frustrations: [
        "BAS trends not creating work orders",
        "RTU routes hard to balance",
      ],
      buyingTriggers: [
        "New multi-site mechanical contract",
        "Energy audit findings",
      ],
      commonObjections: [
        "BAS vendor should dispatch",
        "Seasonal timing is wrong",
      ],
      successMetrics: [
        "Campus PM compliance up",
        "Alarm follow-up tracked to closure",
      ],
    }),
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Dispatch Manager",
      goals: [
        "Prioritize by contract tier and urgency",
        "Reduce windshield time",
      ],
      kpis: [
        "Emergency response time",
        "PM route completion rate",
        "Overtime hours",
      ],
      frustrations: [
        "Emergencies blow up planned routes",
        "No single queue for contract and T&M",
      ],
      buyingTriggers: [
        "Missed SLA on chain account",
        "Dispatcher turnover",
      ],
      commonObjections: [
        "Current dispatch board is good enough",
        "Peak season is bad timing",
      ],
      successMetrics: [
        "On-time PM completion up",
        "Emergency SLA attainment improved",
      ],
    }),
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do you plan RTU PM across multiple sites?",
    "How are comfort complaints tracked to assets?",
    "How do filter and belt PM kits tie to equipment?"
  ],
  revenue: [
    "What PM compliance data supports contract renewals?",
    "How do you identify retrofit upsell from asset age?",
    "Where is refrigerant usage tracked relative to jobs?"
  ],
  dispatch: [
    "How are no-heat/no-cool emergencies prioritized?",
    "How do you balance campus PM routes seasonally?",
    "What visibility exists across mechanical contract sites?"
  ],
  compliance: [
    "How is refrigerant tracking documented per asset?",
    "Where are warranty and startup docs stored?",
    "How do energy audit findings become work?"
  ],
  technicians: [
    "What mobile context do techs have on RTU history?",
    "How are airflow and temperature readings recorded?",
    "Where do techs see PM kit requirements on jobs?"
  ],
  customer: [
    "What PM reporting do property managers expect?",
    "How are comfort downtime events communicated?",
    "How do customers request service across campuses?"
  ],
  reporting: [
    "Can you report RTU PM compliance by site?",
    "How do you trend repeat compressor failures?",
    "Which mechanical KPIs do ops review weekly?"
  ],
  growth: [
    "What breaks when you win a multi-campus contract?",
    "How do BAS integrations affect dispatch workflow?",
    "What limits PM contract growth without better scheduling?"
  ],
  contracts: [
    "How do mechanical PM agreements create scheduled visits?",
    "Where do response SLAs map to emergency dispatch?",
    "How do you prove PM for contract billing?"
  ],
  equipment: [
    "How is the RTU register maintained per customer site?",
    "Where do tonnage, filter size, and belt specs live?",
    "How do rooftop replacements update asset records?"
  ]
}),
    proofPoints: [
    "Campus-level PM scheduling for RTUs and air handlers",
    "Complaint-to-work-order linkage with asset context",
    "PM parts checklist tied to equipment records",
    "BAS alarm follow-up tracked as structured work",
    "Refrigerant history on asset service records",
    "Seasonal capacity visibility for mechanical ops leads",
    "Multi-site contract PM compliance dashboards",
    "Warranty and startup documentation on assets",
    "Repeat compressor failure trending by RTU",
    "Filter and belt PM kit requirements on dispatch jobs",
    "Energy audit follow-up as assigned work orders",
    "Customer-ready PM compliance reports without exports",
  ],
    capabilityMappings: [
    { capability: "Campus RTU PM scheduling", painSignal: "RTU PM routes manually balanced", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Complaint-to-work linkage", painSignal: "Comfort complaints outside work orders", equipifyModule: "Work Orders" },
    { capability: "PM kit on asset", painSignal: "Filter and belt kits not tied to equipment", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "BAS alarm follow-up", painSignal: "BAS trends not creating corrective work", equipifyModule: "Work Orders" },
    { capability: "Refrigerant on asset", painSignal: "Refrigerant logs separate from history", equipifyModule: "Service History + Reports" },
    { capability: "Seasonal capacity view", painSignal: "Shoulder season PM crunch without visibility", equipifyModule: "Reports" },
    { capability: "Multi-site PM dashboard", painSignal: "Campus PM compliance invisible", equipifyModule: "Reports" },
    { capability: "Warranty on asset", painSignal: "Startup docs not on RTU records", equipifyModule: "Equipment + Service History" },
    { capability: "Repeat compressor analytics", painSignal: "Repeat failures not trended by RTU", equipifyModule: "Reports" },
    { capability: "PM kit on dispatch job", painSignal: "Dispatchers lack kit checklist", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Energy audit follow-up", painSignal: "Audit findings not assigned work", equipifyModule: "Work Orders" },
    { capability: "RTU asset register", painSignal: "Rooftop replacements not updating register", equipifyModule: "Equipment + Service History" },
    { capability: "Mechanical contract PM", painSignal: "Agreements not scheduling visits", equipifyModule: "Service Contracts" },
    { capability: "Emergency dispatch rules", painSignal: "No-heat calls blow up PM routes", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Customer PM reporting", painSignal: "PM reports require manual exports", equipifyModule: "Reports" },
  ],
    recommendedCtas: [
    "Review commercial RTU PM scheduling across campuses",
    "See comfort complaints linked to assets and work orders",
    "Walk through PM kit checklists tied to equipment",
    "Explore BAS alarm follow-up as structured work",
    "See refrigerant history on RTU service records",
    "Review seasonal capacity planning for mechanical ops",
    "Walk through multi-site PM compliance dashboards",
    "See warranty and startup docs on asset records",
    "Preview repeat compressor trending by RTU",
    "Discuss PM kit requirements on dispatch jobs",
    "Review energy audit follow-up workflows",
    "See RTU register maintenance after rooftop changes",
    "Explore mechanical agreement PM scheduling",
    "Compare emergency dispatch rules for no-heat calls",
    "See customer-ready PM compliance reporting",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a BAS platform.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior commercial HVAC history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our mechanical PM workflows are too specialized.",
      "commercial HVAC programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your mechanical PM workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for refrigerant reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with RTU PM and complaint linkage often pays back within one shoulder season cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and PM compliance on mechanical contracts—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for commercial HVAC operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many commercial HVAC teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "commercial HVAC leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "Multi-campus contract or RTU count mentioned",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Residential-only shop with no commercial asset model",
  ],
    personalizationOpeners: [
    "Commercial HVAC teams struggle to balance RTU PM across campuses—is that true for you?",
    "BAS alarms that do not create work orders frustrate building engineers—we hear that often.",
    "Filter and belt PM kits not tied to assets cause waste and missed PM—sound familiar?",
    "Comfort complaints tracked outside work orders slow resolution—your experience?",
    "Shoulder season PM volume overwhelming manual scheduling is a common trigger—timing wise?",
    "Multi-site mechanical contracts without PM dashboards hurt renewals—how do you report?",
    "Repeat compressor callbacks without RTU trend visibility erode margin—on your radar?",
    "Refrigerant history separate from service records creates compliance gaps—does that happen here?",
  ],
    industryVocabulary: [
    "RTU",
    "air handler",
    "BAS",
    "PM kit",
    "no-heat/no-cool",
    "tonnage",
    "mechanical contract",
    "refrigerant log",
    "campus PM",
    "comfort call",
  ],
    industryMetrics: [
    "RTU PM compliance by site",
    "Emergency response time",
    "Repeat compressor failure rate",
    "PM kit usage accuracy",
    "Seasonal route completion %",
    "Contract gross margin",
    "BAS callback rate",
    "Customer PM report turnaround",
  ],
    industryTriggers: [
    "Multi-campus mechanical contract win",
    "Shoulder season PM crunch approaching",
    "BAS integration project",
    "Major no-heat event SLA miss",
    "Refrigerant compliance audit",
    "RTU replacement program launch",
    "Mechanical agreement renewal",
    "Dispatch software replacement",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildHvacREnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "Agreements that schedule", hook: "Maintenance agreements generate PM visits automatically", audience: "Service manager", theme: "agreement" },
    { title: "Refrigerant on record", hook: "Refrigerant and warranty context on every job", audience: "Compliance lead", theme: "refrigerant" },
    { title: "Emergency vs PM", hook: "Balance no-cool calls without abandoning PM routes", audience: "Dispatch manager", theme: "balance" },
    { title: "Peak season visibility", hook: "Capacity planning before tune-up season breaks dispatch", audience: "Operations director", theme: "seasonal" },
    { title: "Tune-up checklist", hook: "Standard mobile checklists for consistent PM quality", audience: "Field supervisor", theme: "checklist" },
    { title: "Members first", hook: "Membership tiers reflected in dispatch priority", audience: "Dispatcher", theme: "membership" },
    { title: "Install to service", hook: "Hand off install assets with warranty context", audience: "Install manager", theme: "install" },
    { title: "One customer record", hook: "HVAC and refrigeration history unified", audience: "Service admin", theme: "unity" },
    { title: "Callback trends", hook: "Spot callback patterns by tech and equipment", audience: "Operations lead", theme: "callback" },
    { title: "Entitlement proof", hook: "Track agreement visits against entitlements", audience: "Account manager", theme: "entitlement" },
    { title: "EPA ready jobs", hook: "Refrigerant documentation on completed work", audience: "Compliance admin", theme: "epa" },
    { title: "Dense tune-up routes", hook: "Plan PM routes by density in peak season", audience: "Dispatch planner", theme: "routing" },
    { title: "Warranty before arrival", hook: "Warranty status visible before the truck rolls", audience: "Field tech lead", theme: "warranty" },
    { title: "Closeout to cash", hook: "Same-day closeout on high-volume agreement visits", audience: "Office manager", theme: "billing" },
    { title: "Refrigeration priority", hook: "Prioritize cooler emergencies with clear rules", audience: "Refrigeration manager", theme: "refrigeration" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "hvac_r",
    overview: "HVAC-R contractors service comfort and refrigeration systems for residential-light commercial accounts with seasonal PM spikes, emergency demand, and mixed refrigeration break-fix. Revenue combines maintenance agreements, emergency calls, install warranty service, and refrigerant-related repairs. Teams range from owner-operators with a few techs to regional contractors covering HVAC and refrigeration with shared dispatch. Maturity stages include paper agreements, basic scheduling apps without asset history, and growing shops automating agreement PM, refrigerant logging, and emergency-vs-PM dispatch balance.",
    operationalPains: [
    "Seasonal PM volume overwhelms manual scheduling",
    "Refrigerant and warranty details not on the work order",
    "Emergency calls disrupt planned routes",
    "Maintenance agreements do not auto-generate visits",
    "Technician notes rarely feed asset history consistently",
    "Install warranty callbacks lose original scope context",
    "Refrigeration and comfort jobs split across dispatch views",
    "Filter and tune-up checklists not standardized on mobile",
    "Customer membership tiers not reflected in dispatch priority",
    "Equipment age and model not visible before arrival",
    "Parts warranty eligibility checked manually on site",
    "Route density optimization ignored during peak season",
    "Agreement visit completion not tracked against entitlements",
    "Lead dispatch from sales installs not linked to service assets",
    "After-hours refrigeration emergencies hard to prioritize",
  ],
    financialPains: [
    "Missed agreement PM visits reduce recurring revenue",
    "Peak season overtime blows labor budget",
    "Repeat callback rate erodes agreement profitability",
    "Refrigerant recovery documentation gaps create compliance risk",
    "Parts margin lost when not captured at closeout",
    "Under-utilized tech capacity in shoulder season",
    "Marketing cost per member rises when PM visits missed",
    "Warranty labor not recovered from manufacturers",
    "Inefficient routes during tune-up season hurt margin",
    "Cash flow lag when closeout delays invoicing",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Dispatch Manager",
      goals: [
        "Prioritize by contract tier and urgency",
        "Reduce windshield time",
      ],
      kpis: [
        "Emergency response time",
        "PM route completion rate",
        "Overtime hours",
      ],
      frustrations: [
        "Emergencies blow up planned routes",
        "No single queue for contract and T&M",
      ],
      buyingTriggers: [
        "Missed SLA on chain account",
        "Dispatcher turnover",
      ],
      commonObjections: [
        "Current dispatch board is good enough",
        "Peak season is bad timing",
      ],
      successMetrics: [
        "On-time PM completion up",
        "Emergency SLA attainment improved",
      ],
    }),
    buildBuyerPersona({
      title: "Refrigeration Service Manager",
      goals: [
        "Prioritize cooler outages",
        "Keep leak PM on cadence",
      ],
      kpis: [
        "Emergency response on racks",
        "Leak PM compliance",
        "Repeat compressor failures",
      ],
      frustrations: [
        "Rack history not centralized",
        "Emergency calls overwhelm dispatch",
      ],
      buyingTriggers: [
        "Cold chain customer SLA miss",
        "Refrigerant compliance audit",
      ],
      commonObjections: [
        "Refrigerant logs are separate",
        "Too emergency-heavy for PM software",
      ],
      successMetrics: [
        "Outage MTTR down",
        "Leak PM overdue count reduced",
      ],
    }),
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do you schedule seasonal PM today?",
    "Where do warranty and refrigerant details live on jobs?",
    "How are emergencies prioritized against PM routes?"
  ],
  revenue: [
    "Do service agreements create scheduled work automatically?",
    "How do you track agreement visit completion vs entitlements?",
    "What margin visibility exists per membership tier?"
  ],
  dispatch: [
    "How do refrigeration emergencies get prioritized?",
    "How do you optimize route density during tune-up season?",
    "How are membership tiers reflected in dispatch?"
  ],
  compliance: [
    "How is refrigerant tracking documented on jobs?",
    "Where are EPA compliance records stored?",
    "How are warranty requirements attached to assets?"
  ],
  technicians: [
    "What mobile checklists do techs use on tune-ups?",
    "How is equipment history shared across HVAC and refrigeration?",
    "Where do techs verify parts warranty on site?"
  ],
  customer: [
    "How do members request service and track visits?",
    "What communication do customers get on emergency ETAs?",
    "How are agreement visit reminders handled?"
  ],
  reporting: [
    "Can you report agreement PM completion rates?",
    "How do you track callback rates by tech?",
    "Which seasonal KPIs do ops review weekly?"
  ],
  growth: [
    "What breaks when membership count doubles?",
    "How do new install leads feed service asset records?",
    "What limits adding refrigeration to HVAC dispatch?"
  ],
  contracts: [
    "How are agreement visit entitlements translated to schedules?",
    "Where do response SLAs apply to members vs non-members?",
    "How do you prove PM visits for agreement billing?"
  ],
  equipment: [
    "Do you maintain equipment records per customer location?",
    "Where do model, serial, and install date live?",
    "How do install handoffs create service assets?"
  ]
}),
    proofPoints: [
    "Agreement-driven PM scheduling with entitlement tracking",
    "Asset history with refrigerant and warranty context",
    "Dispatch balancing emergency and PM workload",
    "Seasonal capacity visibility for ops leads",
    "Standardized tune-up checklists on mobile",
    "Membership tier priority on dispatch board",
    "Install-to-service asset handoff with warranty context",
    "Refrigeration and comfort history on one customer record",
    "Callback trending by technician and equipment type",
    "Agreement visit completion reporting for renewals",
    "EPA refrigerant documentation on completed jobs",
    "Route-friendly PM planning during peak season",
  ],
    capabilityMappings: [
    { capability: "Agreement PM scheduling", painSignal: "Maintenance agreements not generating visits", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Refrigerant on job", painSignal: "Refrigerant details not on work orders", equipifyModule: "Service History + Reports" },
    { capability: "Emergency vs PM balance", painSignal: "Emergencies blow up PM routes", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Asset service history", painSignal: "Tech notes not feeding equipment history", equipifyModule: "Equipment + Service History" },
    { capability: "Seasonal capacity view", painSignal: "Peak season overload without visibility", equipifyModule: "Reports" },
    { capability: "Tune-up checklists", painSignal: "Inconsistent PM checklists on mobile", equipifyModule: "Mobile Work Orders" },
    { capability: "Membership dispatch priority", painSignal: "Member tiers not on dispatch rules", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Install handoff assets", painSignal: "Install scope lost on warranty callbacks", equipifyModule: "Equipment + Service History" },
    { capability: "Refrigeration-HVAC unity", painSignal: "Split history across comfort and refrigeration", equipifyModule: "Service History + Reports" },
    { capability: "Callback analytics", painSignal: "Callbacks not trended by tech", equipifyModule: "Reports" },
    { capability: "Entitlement tracking", painSignal: "Agreement visits not tracked vs entitlements", equipifyModule: "Service Contracts" },
    { capability: "EPA documentation", painSignal: "Refrigerant compliance gaps on jobs", equipifyModule: "Service History + Reports" },
    { capability: "Route-aware PM", painSignal: "Tune-up routes ignore density", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Warranty on asset", painSignal: "Warranty checked manually on site", equipifyModule: "Work Orders" },
    { capability: "Fast closeout billing", painSignal: "Closeout delays hurt cash flow", equipifyModule: "Work Orders" },
  ],
    recommendedCtas: [
    "See seasonal PM scheduling for HVAC-R agreements",
    "Review refrigerant and warranty context on work orders",
    "Walk through emergency vs PM dispatch balancing",
    "Explore agreement visit entitlement tracking",
    "See seasonal capacity visibility before peak hits",
    "Review standardized tune-up checklists on mobile",
    "Discuss membership tier priority on dispatch",
    "Walk through install-to-service asset handoff",
    "See refrigeration and comfort history on one record",
    "Preview callback trending by technician",
    "Review EPA refrigerant documentation on jobs",
    "Explore route-aware tune-up planning",
    "See warranty visibility on assets before arrival",
    "Review faster closeout for agreement billing",
    "Map peak season bottlenecks in a workflow session",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a scheduling app.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior HVAC-R history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our maintenance agreement workflows are too specialized.",
      "HVAC-R programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your maintenance agreement workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for EPA refrigerant reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with agreement PM and dispatch balance often pays back within one tune-up season cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and agreement PM completion rate—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for HVAC-R operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many HVAC-R teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "HVAC-R leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "Peak season timing discussed",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "No interest in asset history—dispatch-only",
  ],
    personalizationOpeners: [
    "HVAC-R shops often drown in seasonal PM without agreement-driven scheduling—is that you?",
    "Refrigerant and warranty details missing on work orders create compliance and margin risk—sound familiar?",
    "Emergency calls that blow up PM routes every peak season frustrate dispatchers—we hear that constantly.",
    "Maintenance agreements that do not auto-generate visits leave recurring revenue on the table—your experience?",
    "Tech notes that never feed asset history drive callbacks—how consistent is your documentation?",
    "Install warranty callbacks without original scope context are expensive—on your radar?",
    "Membership tiers not reflected in dispatch priority annoys best customers—does that happen here?",
    "Peak season approaching is when shops evaluate dispatch and PM tools—timing wise for you?",
  ],
    industryVocabulary: [
    "maintenance agreement",
    "tune-up",
    "refrigerant recovery",
    "no-cool",
    "EPA Section 608",
    "membership tier",
    "callback",
    "peak season",
    "entitlement visit",
    "walk-in cooler",
  ],
    industryMetrics: [
    "Agreement PM completion rate",
    "Callback rate by technician",
    "Emergency response time",
    "Seasonal route completion %",
    "Revenue per agreement member",
    "First-time fix rate",
    "Refrigerant compliance audit pass rate",
    "Same-day closeout rate",
  ],
    industryTriggers: [
    "Tune-up season approaching",
    "Agreement membership doubling",
    "EPA audit or refrigerant compliance review",
    "Dispatch software replacement",
    "Adding refrigeration line to HVAC shop",
    "Major callback spike on agreement members",
    "New install volume feeding service backlog",
    "Owner-operator hiring first dispatcher",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export function buildCommercialKitchenEnrichedPlaybook(): GrowthIndustryPlaybook {
  const storylines = [
    { title: "SLA-first line-down", hook: "Dispatch kitchen emergencies by chain SLA tier", audience: "Kitchen operations lead", theme: "sla" },
    { title: "One line history", hook: "Line equipment history across brands and sites", audience: "Chain account manager", theme: "history" },
    { title: "Hood meets refrigeration", hook: "Coordinate PM across ventilation and cold lines", audience: "Operations director", theme: "pm" },
    { title: "Chain register", hook: "Standardized asset data at every location", audience: "Service admin", theme: "register" },
    { title: "Brand-certified dispatch", hook: "Match tech certification to equipment brand", audience: "Dispatch manager", theme: "certification" },
    { title: "Inspection to work", hook: "Health findings become assigned follow-up", audience: "Compliance lead", theme: "inspection" },
    { title: "Swap on downtime", hook: "Document swap units during line-down events", audience: "Field supervisor", theme: "swap" },
    { title: "Corporate SLA report", hook: "Chain SLA and PM compliance by region", audience: "Customer success lead", theme: "reporting" },
    { title: "Parts that fit", hook: "Brand compatibility context on work orders", audience: "Parts manager", theme: "parts" },
    { title: "Repeat line failures", hook: "Trend failures on fryers, ovens, and walk-ins", audience: "Service manager", theme: "repeat" },
    { title: "Franchise and corporate", hook: "Unified intake for franchise and corporate requests", audience: "Customer service lead", theme: "intake" },
    { title: "PM kit on the line", hook: "PM requirements tied to each line asset", audience: "Field tech lead", theme: "kit" },
    { title: "Weekend line-down", hook: "Clear priority rules for night and weekend events", audience: "On-call coordinator", theme: "after-hours" },
    { title: "Renew with downtime data", hook: "Downtime analytics for chain contract renewals", audience: "Sales director", theme: "renewal" },
    { title: "National chain scale", hook: "Onboard new chain locations without dispatch chaos", audience: "Operations director", theme: "growth" },
  ]
  return buildPriorityEnrichedPlaybook({
    industryId: "commercial_kitchen",
    overview: "Commercial kitchen equipment service teams support restaurants, chains, foodservice distributors, and institutional kitchens with downtime-sensitive SLAs, multi-brand line equipment, and PM for cooking, refrigeration, and ventilation systems. Revenue combines chain service contracts, emergency line-down response, parts margin, and PM programs for hood and refrigeration lines. Teams range from local foodservice dealers to national organizations serving hundreds of chain locations. Maturity stages include brand-siloed history, SLA tracking outside dispatch, and mature operators unifying line-level asset registers, chain SLA dispatch, and PM compliance reporting for franchise and corporate accounts.",
    operationalPains: [
    "Downtime SLAs tracked outside dispatch",
    "Line equipment history split by brand and site",
    "PM for hood and refrigeration lines inconsistent",
    "Chain locations lack standardized asset registers",
    "Emergency line-down calls overwhelm dispatch board",
    "Parts compatibility across brands not visible on jobs",
    "Franchise vs corporate request intake inconsistent",
    "Health inspection findings not driving follow-up work",
    "Ventilation and cooking line PM not coordinated",
    "Technician brand certifications not matched on dispatch",
    "Swap equipment during downtime poorly documented",
    "Multi-location chain reporting requires manual assembly",
    "PM kit and filter requirements not on work orders",
    "Third-party warranty on line equipment not on asset",
    "Night and weekend line-down events hard to prioritize",
  ],
    financialPains: [
    "Chain SLA penalties on line downtime erode margin",
    "Missed PM drives expensive emergency refrigeration calls",
    "Parts obsolescence on multi-brand lines hurts inventory ROI",
    "Under-billed travel on low-density chain routes",
    "Contract renewals discounted without downtime analytics",
    "Repeat failure on same line equipment without trend visibility",
    "Overtime on weekend line-down events blows labor budget",
    "Lost chain expansion when SLA proof weak",
    "Inventory carrying cost from untracked van stock by brand",
    "Revenue lag when line-down closeout delays invoicing",
  ],
    buyerPersonas: [
    buildBuyerPersona({
      title: "Kitchen Operations Lead",
      goals: [
        "Minimize line downtime for chains",
        "Standardize PM across locations",
      ],
      kpis: [
        "Line downtime minutes",
        "SLA by chain",
        "PM completion by equipment type",
      ],
      frustrations: [
        "Brand history split by site",
        "Downtime SLAs outside dispatch",
      ],
      buyingTriggers: [
        "New national chain contract",
        "Health inspection tied to equipment",
      ],
      commonObjections: [
        "Dealer portal exists",
        "Too many brands to unify",
      ],
      successMetrics: [
        "Chain SLA penalties avoided",
        "PM compliance across locations",
      ],
    }),
    buildBuyerPersona({
      title: "Operations Director",
      goals: [
        "Increase first-time fix rate",
        "Balance emergency vs PM workload daily",
      ],
      kpis: [
        "First-time fix rate",
        "Average response time",
        "Technician utilization",
      ],
      frustrations: [
        "Dispatch without asset history",
        "Repeat truck rolls erode margin",
      ],
      buyingTriggers: [
        "SLA penalties on key accounts",
        "Dispatch coordinator bottleneck",
      ],
      commonObjections: [
        "Technicians resist new mobile workflows",
        "Too busy for implementation",
      ],
      successMetrics: [
        "Repeat visits down",
        "Same-day closeout rate up",
      ],
    }),
    buildBuyerPersona({
      title: "Dispatch Manager",
      goals: [
        "Prioritize by contract tier and urgency",
        "Reduce windshield time",
      ],
      kpis: [
        "Emergency response time",
        "PM route completion rate",
        "Overtime hours",
      ],
      frustrations: [
        "Emergencies blow up planned routes",
        "No single queue for contract and T&M",
      ],
      buyingTriggers: [
        "Missed SLA on chain account",
        "Dispatcher turnover",
      ],
      commonObjections: [
        "Current dispatch board is good enough",
        "Peak season is bad timing",
      ],
      successMetrics: [
        "On-time PM completion up",
        "Emergency SLA attainment improved",
      ],
    }),
    buildBuyerPersona({
      title: "Service Manager",
      goals: [
        "Grow contract revenue with provable SLA performance",
        "Reduce cost-to-serve on key accounts",
      ],
      kpis: [
        "Contract gross margin",
        "SLA attainment %",
        "Renewal rate",
      ],
      frustrations: [
        "Installed base stale before renewals",
        "Sales and service see different equipment",
      ],
      buyingTriggers: [
        "Major account renewal at risk",
        "New OEM line launch",
      ],
      commonObjections: [
        "CRM already tracks accounts",
        "Need ROI proof before rollout",
      ],
      successMetrics: [
        "Renewals saved with service data",
        "Upsell from failure trends",
      ],
    }),
    buildBuyerPersona({
      title: "Field Supervisor",
      goals: [
        "Keep techs productive on route",
        "Ensure consistent job documentation",
      ],
      kpis: [
        "Jobs per tech per day",
        "Incomplete closeout rate",
        "Travel vs wrench time",
      ],
      frustrations: [
        "Techs re-enter data from spreadsheets",
        "Skill mismatches on dispatched jobs",
      ],
      buyingTriggers: [
        "Seasonal volume spike",
        "New tech cohort onboarding",
      ],
      commonObjections: [
        "Paper works for senior techs",
        "Mobile app too slow on site",
      ],
      successMetrics: [
        "Closeout same-day rate up",
        "Callbacks down per tech",
      ],
    }),
  ],
    discoveryQuestions: discoveryByCategory({
  ops: [
    "How do you track downtime SLAs for chain accounts?",
    "How is line equipment history shared across locations?",
    "How are hood and refrigeration PM coordinated?"
  ],
  revenue: [
    "What downtime analytics support chain renewals?",
    "How do you track parts margin by brand and line type?",
    "Where does sales see installed line before expansion?"
  ],
  dispatch: [
    "How are line-down emergencies prioritized?",
    "How are brand-certified techs matched on dispatch?",
    "What visibility exists across chain locations?"
  ],
  compliance: [
    "How are health inspection findings tracked to closure?",
    "Where are hood cleaning PM records stored?",
    "How is refrigeration temperature compliance documented?"
  ],
  technicians: [
    "What mobile context do techs have on line history?",
    "How are parts compatibility checks done on site?",
    "Where do swap units get recorded during downtime?"
  ],
  customer: [
    "How do chains request service across locations?",
    "What downtime reporting do corporate accounts expect?",
    "How are franchise vs corporate requests handled?"
  ],
  reporting: [
    "Can you report SLA attainment by chain and region?",
    "How do you trend repeat failures on fryers or walk-ins?",
    "Which kitchen KPIs do ops review weekly?"
  ],
  growth: [
    "What breaks when you win a new national chain?",
    "How do new brand authorizations affect dispatch?",
    "What limits PM program scale across locations?"
  ],
  contracts: [
    "How are chain SLA tiers mapped to dispatch rules?",
    "Where do PM entitlements differ by equipment type?",
    "How do you prove PM and SLA for renewals?"
  ],
  equipment: [
    "How is line-level asset register maintained per site?",
    "Where do model, serial, and line position data live?",
    "How do equipment swaps update asset records?"
  ]
}),
    proofPoints: [
    "SLA-aware dispatch for kitchen downtime events",
    "Site and line-level asset history across brands",
    "PM programs for refrigeration, cooking, and hood lines",
    "Chain location registers with standardized asset data",
    "Brand certification rules on dispatch assignment",
    "Health inspection follow-up as structured work",
    "Swap unit documentation during line-down events",
    "Chain SLA and PM compliance reporting by region",
    "Parts compatibility context on work orders",
    "Coordinated hood and refrigeration PM scheduling",
    "Repeat failure trending on line equipment types",
    "Franchise and corporate intake in unified queue",
  ],
    capabilityMappings: [
    { capability: "Chain SLA dispatch", painSignal: "Downtime SLAs outside dispatch rules", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Line-level asset history", painSignal: "History split by brand and site", equipifyModule: "Service History + Reports" },
    { capability: "Hood and refrigeration PM", painSignal: "Inconsistent PM on kitchen lines", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Chain location register", painSignal: "Locations lack standardized assets", equipifyModule: "Equipment + Service History" },
    { capability: "Line-down priority", painSignal: "Emergencies overwhelm dispatch board", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Brand certification routing", painSignal: "Wrong brand tech dispatched", equipifyModule: "Work Orders + Dispatch" },
    { capability: "Health inspection follow-up", painSignal: "Findings not creating work orders", equipifyModule: "Work Orders" },
    { capability: "Swap unit tracking", painSignal: "Swap equipment poorly documented", equipifyModule: "Equipment + Service History" },
    { capability: "Chain SLA reporting", painSignal: "Manual assembly for corporate reports", equipifyModule: "Reports" },
    { capability: "Parts compatibility", painSignal: "Brand parts compatibility not on job", equipifyModule: "Work Orders" },
    { capability: "Coordinated line PM", painSignal: "Hood and refrigeration PM uncoordinated", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Repeat line failure analytics", painSignal: "Same line asset failing without trends", equipifyModule: "Reports" },
    { capability: "Franchise intake queue", painSignal: "Franchise vs corporate requests inconsistent", equipifyModule: "Work Orders" },
    { capability: "PM kit on line asset", painSignal: "PM kits not tied to line equipment", equipifyModule: "Maintenance Plans + Equipment" },
    { capability: "Night/weekend line-down rules", painSignal: "After-hours line-down priority unclear", equipifyModule: "Work Orders + Dispatch" },
  ],
    recommendedCtas: [
    "Review chain SLA dispatch for line-down events",
    "See line-level asset history across brands and sites",
    "Walk through hood and refrigeration PM coordination",
    "Explore chain location asset register standardization",
    "Discuss brand certification rules on dispatch",
    "Review health inspection follow-up workflows",
    "See swap unit documentation during downtime",
    "Walk through chain SLA reporting by region",
    "See parts compatibility context on kitchen jobs",
    "Preview repeat failure trends on line equipment",
    "Review franchise and corporate intake in one queue",
    "See PM kits tied to line assets on work orders",
    "Discuss night and weekend line-down prioritization",
    "Explore downtime analytics for chain renewals",
    "Map line-down bottlenecks in a workflow session",
  ],
    storylines,
    structuredObjections: [
    buildStructuredObjection(
      "We already use a dealer portal.",
      "Many teams keep billing in one system but dispatch and asset history elsewhere—Equipify unifies work orders, assets, and service history without replacing your ERP.",
      "Where do techs see prior kitchen equipment history before arriving on site?",
    ),
    buildStructuredObjection(
      "Our chain SLA workflows are too specialized.",
      "commercial kitchen equipment service programs need PM schedules, asset registers, and audit trails—Equipify is built for asset-centric field service, not generic ticketing.",
      "Which parts of your chain SLA workflow break down outside your current system?",
    ),
    buildStructuredObjection(
      "Security and compliance reviews block new vendors.",
      "We support role-based access, audit logs, and exportable history for health inspection reviews.",
      "What security artifacts does your team require before a pilot?",
    ),
    buildStructuredObjection(
      "We are too busy for a change right now.",
      "Phased rollout starting with SLA dispatch and line assets often pays back within one chain renewal cycle through fewer repeat visits.",
      "What would make a 90-day pilot worth your time?",
    ),
    buildStructuredObjection(
      "We need to see ROI before expanding scope.",
      "Teams measure ROI via repeat truck rolls, PM compliance, and line downtime reduction—we scope pilots around those KPIs.",
      "Which metric would convince leadership: first-time fix, PM compliance, or margin per job?",
    ),
    buildStructuredObjection(
      "Technicians will not adopt mobile.",
      "Mobile job packets mirror existing documentation—asset history, checklists, and parts—without duplicate entry after the visit.",
      "What causes the most re-entry work for techs after a job today?",
    ),
    buildStructuredObjection(
      "Implementation will take too long.",
      "Reference deployments start with asset import, PM templates, and dispatch—most teams run parallel during pilot.",
      "Which site or team would be the lowest-risk pilot cohort?",
    ),
    buildStructuredObjection(
      "Our data is too messy to migrate.",
      "We begin with active contracts and critical assets—not big-bang cutover.",
      "Which asset classes or sites have the cleanest records to start?",
    ),
    buildStructuredObjection(
      "We tried software before and it failed.",
      "Common failures: no asset history on mobile, PM not tied to work orders—we design around those gaps for commercial kitchen equipment service operators.",
      "What broke in the last rollout—adoption, dispatch, or reporting?",
    ),
    buildStructuredObjection(
      "Price is higher than our current tool.",
      "Total cost includes repeat visits, audit prep labor, and coordinator overtime—Equipify targets those hidden costs.",
      "Where is the most labor waste: dispatch, closeout, or audit prep?",
    ),
    buildStructuredObjection(
      "We only need dispatch, not another platform.",
      "Dispatch without asset context drives repeat visits—Equipify connects scheduling to equipment history and PM due dates.",
      "How do dispatchers know if a job is a repeat failure before assigning?",
    ),
    buildStructuredObjection(
      "Corporate IT chose our current stack.",
      "Equipify integrates via exports and APIs while giving operations a tool they control day-to-day.",
      "Does IT own operational workflow changes or does your ops team?",
    ),
    buildStructuredObjection(
      "Our customers will not use a portal.",
      "Portal is optional—value starts with internal dispatch, PM, and history.",
      "Do you need customer-facing visibility in phase one or internal ops first?",
    ),
    buildStructuredObjection(
      "We are too small for this.",
      "Shops use Equipify when spreadsheets break—pricing scales with active techs, not enterprise minimums.",
      "At what headcount did your current process start failing?",
    ),
    buildStructuredObjection(
      "Seasonal volume makes timing bad.",
      "Many commercial kitchen equipment service teams pilot in shoulder season and go live before the next spike.",
      "When is your next volume spike and what breaks first?",
    ),
  ],
    successSignals: [
    "commercial kitchen equipment service leader asks about PM compliance reporting by site or asset class",
    "Dispatcher mentions repeat truck rolls on same asset tag",
    "Compliance owner cites upcoming audit or accreditation window",
    "Ops lead frustrated asset history lives in email or shared drives",
    "Recent SLA miss or penalty on a key account",
    "Merger, new site, or contract win increasing asset count",
    "Technician turnover causing inconsistent job documentation",
    "CFO asking for margin per job or contract cost-to-serve",
    "CMMS renewal dissatisfaction or failed rollout mentioned",
    "Coordinator bottleneck on dispatch",
    "Customer asking for service history reports you cannot produce quickly",
    "Regulatory notice or inspection deadline driving urgency",
    "Sales and service misaligned on installed base before renewal",
    "Paper or spreadsheet PM tracking acknowledged on call",
    "Pilot site named as willing to test new workflow",
    "National chain or franchise complexity mentioned",
  ],
    warningSignals: [
    "Prospect wants cheapest dispatch-only tool with no asset model",
    "No named ops or service leader on the evaluation",
    "IT-only evaluation with no field supervisor input",
    "Requires full ERP replacement in phase one",
    "Unwilling to import any asset or PM data for pilot",
    "Timeline beyond 12 months with no phased plan",
    "Prior vendor lock-in contract just signed",
    "No pain acknowledged—only browsing",
    "Expects zero mobile adoption from senior techs",
    "Budget owner not identified",
    "Single-location restaurant only with no asset interest",
  ],
    personalizationOpeners: [
    "Commercial kitchen teams often track downtime SLAs outside dispatch—is that true for your chain accounts?",
    "Line equipment history split by brand and site slows repeat failure resolution—we hear that often.",
    "Hood and refrigeration PM done inconsistently creates health and downtime risk—sound familiar?",
    "Line-down emergencies that overwhelm the dispatch board hurt chain SLAs—your experience?",
    "Brand-certified tech mismatches drive expensive callbacks on multi-brand lines—on your radar?",
    "Corporate chain reporting assembled manually does not scale—how do you deliver SLA proof?",
    "Health inspection findings that do not become work orders recur at next visit—does that happen here?",
    "New national chain wins expose asset register gaps—planning for growth?",
  ],
    industryVocabulary: [
    "line-down",
    "foodservice equipment",
    "hood PM",
    "walk-in",
    "chain SLA",
    "franchise",
    "cooking line",
    "brand authorization",
    "health inspection",
    "swap unit",
  ],
    industryMetrics: [
    "Line downtime minutes",
    "Chain SLA attainment %",
    "PM compliance by location",
    "Repeat failure rate by line type",
    "Emergency response time",
    "First-time fix on line-down",
    "Parts margin per kitchen job",
    "Swap unit documentation rate",
  ],
    industryTriggers: [
    "New national chain contract win",
    "SLA penalty on line-down event",
    "Health inspection failure at chain location",
    "Brand authorization expansion",
    "Franchise onboarding surge",
    "Corporate mandate for SLA reporting",
    "Dispatch bottleneck during weekend line-down",
    "Competitor loss on chain RFP",
  ],
    competitiveLandscape: STANDARD_FIELD_SERVICE_COMPETITORS,
  })
}

export const GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS = {
  biomedical_equipment: buildBiomedicalEquipmentEnrichedPlaybook,
  medical_equipment: buildMedicalEquipmentEnrichedPlaybook,
  commercial_equipment: buildCommercialEquipmentEnrichedPlaybook,
  industrial_equipment: buildIndustrialEquipmentEnrichedPlaybook,
  field_service: buildFieldServiceEnrichedPlaybook,
  calibration_inspection: buildCalibrationInspectionEnrichedPlaybook,
  facility_maintenance: buildFacilityMaintenanceEnrichedPlaybook,
  commercial_hvac: buildCommercialHvacEnrichedPlaybook,
  hvac_r: buildHvacREnrichedPlaybook,
  commercial_kitchen: buildCommercialKitchenEnrichedPlaybook,
} as const
