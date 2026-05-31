/**
 * Deterministic Opportunity Intelligence scoring for Equipify Sales.
 */
;(function initEquipifyGrowthOpportunityIntelligence() {
  const LOG_PREFIX = "[Equipify Sales:opportunity-intelligence]"

  const INDUSTRY_KEYWORDS = [
    /\bservices?\b/,
    /\bmaintenance\b/,
    /\bfield operations\b/,
    /\bfacilit/,
    /\bclinical engineering\b/,
    /\bequipment service\b/,
    /\bbiomedic/,
    /\bhvac\b/,
    /\belectrical\b/,
    /\bplumbing\b/,
    /\bmep\b/,
    /\bproperty management\b/,
    /\bcontract(?:or|ing)\b/,
    /\bhospital\b/,
    /\bhealthcare\b/,
    /\bmedical center\b/,
    /\bhealth system\b/,
    /\bmemorial\b/,
    /\btechnician\b/,
    /\brepair\b/,
    /\boperations\b/,
  ]

  const EQUIPMENT_HEAVY_KEYWORDS = [
    /\bequipment\b/,
    /\basset/,
    /\bfleet\b/,
    /\bplant\b/,
    /\bindustrial\b/,
    /\bmanufacturing\b/,
    /\butilities\b/,
  ]

  function trimOrNull(value) {
    const trimmed = typeof value === "string" ? value.trim() : String(value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function normalizeText(value) {
    return trimOrNull(value)?.toLowerCase().replace(/\s+/g, " ") ?? ""
  }

  function includesAny(raw, patterns) {
    return patterns.some((pattern) => pattern.test(raw))
  }

  function fitLabelFromScore(score, thresholds = { high: 70, medium: 45 }) {
    if (score >= thresholds.high) return "High"
    if (score >= thresholds.medium) return "Medium"
    return "Low"
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function buildSearchBlob(input) {
    return [
      input.title,
      input.company,
      input.location,
      input.department,
      input.company_industry,
      input.company_description,
      ...(Array.isArray(input.company_keywords) ? input.company_keywords : []),
    ]
      .map(normalizeText)
      .filter(Boolean)
      .join(" ")
  }

  function scoreIndustryFit(input) {
    const blob = buildSearchBlob(input)
    if (!blob) return { score: 15, label: "Low", reasons: [] }

    let score = 24
    const reasons = []
    const industryHits = INDUSTRY_KEYWORDS.filter((pattern) => pattern.test(blob)).length
    const equipmentHits = EQUIPMENT_HEAVY_KEYWORDS.filter((pattern) => pattern.test(blob)).length

    score += Math.min(industryHits * 6, 24)
    score += Math.min(equipmentHits * 4, 12)

    const healthcare =
      includesAny(blob, [/\bhospital\b/, /\bhealthcare\b/, /\bclinical\b/, /\bbiomedic/, /\bmedical\b/]) &&
      includesAny(blob, [/\btechnician\b/, /\bequipment\b/, /\bservices?\b/, /\bengineering\b/, /\bmaintenance\b/])

    if (includesAny(blob, [/\bhospital\b/, /\bhealthcare\b/, /\bclinical\b/, /\bbiomedic/, /\bmedical\b/])) {
      score += 10
      reasons.push("Healthcare equipment service environment")
    }
    const companyOnlyHealthcare =
      !normalizeText(input.title) &&
      includesAny(normalizeText(input.company), [/\bhospital\b/, /\bhealthcare\b/, /\bhealth system\b/, /\bhospital system\b/, /\bmemorial\b/, /\bmedical center\b/])
    if (companyOnlyHealthcare) {
      score += 12
      reasons.push("Strong fit for service operations workflows")
    }
    if (healthcare) {
      score += 8
      reasons.push("Strong fit for service operations workflows")
    }
    if (includesAny(blob, [/\bhealth group\b/, /\bhealth system\b/, /\bhealthcare group\b/, /\bhospital system\b/])) {
      score += 8
      reasons.push("Regional healthcare operator with equipment dependencies")
    }
    if (includesAny(blob, [/\bservices?\b/, /\bmaintenance\b/, /\bfield service\b/, /\bfacilit/])) {
      score += 6
      if (!healthcare) reasons.push("Strong fit for service operations workflows")
    }
    if (includesAny(blob, [/\bservice manager\b/, /\bfield service manager\b/, /\bmaintenance manager\b/])) {
      score += 18
      reasons.push("Service leadership role aligned to operations workflows")
    }
    if (includesAny(blob, [/\bprocurement\b/, /\bpurchasing\b/, /\bsourcing\b/])) {
      score += 8
      reasons.push("Procurement function tied to vendor and equipment decisions")
    }
    if (includesAny(blob, [/\bcontract(?:or|ing)\b/])) {
      score += 22
      reasons.push("Contractor profile aligned to equipment service workflows")
    }
    if (includesAny(blob, [/\bcontract(?:or|ing)\b/, /\bproperty management\b/, /\bmep\b/, /\bhvac\b/])) {
      score += 5
      if (!reasons.includes("Equipment-heavy or facilities-driven business model")) {
        reasons.push("Equipment-heavy or facilities-driven business model")
      }
    }

    score = clamp(score, 0, 100)
    return { score, label: fitLabelFromScore(score, { high: 52, medium: 38 }), reasons }
  }

  function scoreRoleFit(input) {
    const seniority = input.seniority ?? "Unknown"
    const decisionMaker = input.decision_maker_level ?? "Low"
    let score = 20
    const reasons = []

    if (seniority === "Owner" || seniority === "Executive" || seniority === "VP") {
      score = 92
      reasons.push("Executive-level buyer with budget authority")
    } else if (seniority === "Director") {
      score = 82
      reasons.push("Director-level contact can sponsor operational initiatives")
    } else if (seniority === "Manager" || seniority === "Lead") {
      score = 62
      reasons.push("People manager with operational influence")
    } else if (decisionMaker === "Low") {
      score = 28
      reasons.push("Current contact is likely an influencer, not final buyer")
    } else if (decisionMaker === "Medium") {
      score = 48
      reasons.push("Contact can influence workflow but may not own budget")
    } else {
      score = 40
    }

    if (includesAny(normalizeText(input.title), [/\bprocurement\b/, /\bpurchasing\b/, /\bsourcing\b/])) {
      score = Math.max(score, 75)
      reasons.push("Procurement role can influence vendor selection")
    }
    if (
      includesAny(normalizeText(input.title), [/\bprocurement\b/, /\bpurchasing\b/]) &&
      includesAny(normalizeText(input.company), [/\bhospital\b/, /\bhealthcare\b/, /\bhealth system\b/, /\bhospital system\b/, /\bmedical\b/])
    ) {
      score = Math.max(score, 78)
      reasons.push("Healthcare procurement path with vendor evaluation authority")
    }

    score = clamp(score, 0, 100)
    return { score, label: fitLabelFromScore(score), reasons }
  }

  function scoreCompanyFit(input) {
    const company = normalizeText(input.company)
    const blob = buildSearchBlob(input)
    if (!company) {
      return { score: 10, label: "Low", reasons: ["Company context missing — fit estimate is limited"] }
    }

    let score = 35
    const reasons = []

    if (includesAny(company, [/\bhospital\b/, /\bhealthcare\b/, /\bhealth system\b/, /\bhealth group\b/, /\bhealth\b/, /\bmedical\b/, /\bmemorial\b/, /\bclinic\b/])) {
      score += 35
      reasons.push("Healthcare provider with equipment service needs")
    }
    if (includesAny(company, [/\bcontract(?:or|ing)\b/, /\bfacilit/, /\bproperty management\b/])) {
      score += 18
      reasons.push("Facilities or contractor organization with service workflows")
    }
    if (includesAny(company, [/\bservices?\b/, /\bfield service\b/, /\bmaintenance\b/])) {
      score += 18
      reasons.push("Service-heavy organization profile")
    }
    if (
      includesAny(blob, [/\bcontract(?:or|ing)\b/, /\bfacilit/, /\bproperty management\b/, /\bfield service\b/]) &&
      !includesAny(company, [/\bcontract(?:or|ing)\b/])
    ) {
      score += 20
      if (!reasons.includes("Service-heavy organization profile")) {
        reasons.push("Service-heavy organization profile")
      }
    }
    if (input.company_employee_count || input.company_employee_range) {
      score += 8
      reasons.push("Company scale signals operational complexity")
    }
    if (trimOrNull(input.company_industry)) {
      score += 6
    }
    if (includesAny(blob, EQUIPMENT_HEAVY_KEYWORDS)) {
      score += 10
    }

    score = clamp(score, 0, 100)
    return { score, label: fitLabelFromScore(score), reasons }
  }

  function scoreRelationshipFit(input) {
    const strength = input.relationship_strength ?? "Weak"
    const degree = normalizeText(input.connection_degree)
    let score = 20
    const reasons = []

    if (strength === "Strong" || degree === "1st") {
      score = strength === "Strong" ? 88 : 72
      reasons.push("Warm LinkedIn relationship improves outreach response")
    } else if (strength === "Moderate" || degree === "2nd") {
      score = 58
      reasons.push("Moderate network proximity — warm intro may help")
    } else {
      score = 25
      reasons.push("Limited relationship signal — expect colder outreach")
    }

    const mutual = typeof input.mutual_connections_count === "number" ? input.mutual_connections_count : 0
    if (mutual >= 3) score += 8

    score = clamp(score, 0, 100)
    const label = strength === "Strong" ? "Strong" : strength === "Moderate" ? "Moderate" : "Weak"
    return { score, label, reasons }
  }

  function buildCrmContext(input) {
    const parts = []
    if (input.has_crm_match) parts.push("Matched lead in Equipify")
    if ((input.existing_crm_contacts_count ?? 0) > 0) {
      parts.push(`${input.existing_crm_contacts_count} CRM contact${input.existing_crm_contacts_count === 1 ? "" : "s"}`)
    }
    if ((input.existing_opportunities_count ?? 0) > 0) {
      parts.push(`${input.existing_opportunities_count} active opportunit${input.existing_opportunities_count === 1 ? "y" : "ies"}`)
    }
    if ((input.existing_customers_count ?? 0) > 0) {
      parts.push(`${input.existing_customers_count} customer record${input.existing_customers_count === 1 ? "" : "s"}`)
    }
    if (!parts.length) return "No CRM footprint yet"
    return parts.join(" · ")
  }

  function scoreCrmContext(input) {
    let score = 0
    const reasons = []
    if (input.has_crm_match) {
      score += 20
      reasons.push("Existing CRM match reduces research friction")
    }
    if ((input.existing_crm_contacts_count ?? 0) > 0) {
      score += Math.min(input.existing_crm_contacts_count * 4, 16)
      reasons.push("Account already has CRM contacts to expand")
    }
    if ((input.existing_opportunities_count ?? 0) > 0) {
      score += 20
      reasons.push("Active opportunity indicates buying motion in progress")
    }
    if ((input.existing_customers_count ?? 0) > 0) {
      score += 18
      reasons.push("Existing customer footprint supports expansion plays")
    }
    score = clamp(score, 0, 100)
    return { score, label: fitLabelFromScore(score, { high: 65, medium: 30 }), reasons }
  }

  function computeTargetFitScore(breakdown, input) {
    const weighted =
      breakdown.industry.score * 0.3 +
      breakdown.role.score * 0.22 +
      breakdown.company.score * 0.28 +
      breakdown.relationship.score * 0.1 +
      breakdown.crm.score * 0.1

    let score = Math.round(weighted)
    if (!trimOrNull(input.title)) score -= 10
    if (!trimOrNull(input.company)) score -= 15

    const leadershipBoost =
      input.seniority === "Owner" || input.seniority === "Executive"
        ? 18
        : input.seniority === "VP"
          ? 16
          : input.seniority === "Director"
            ? 14
            : input.seniority === "Manager"
              ? 6
              : input.seniority === "Lead"
                ? 4
                : 0
    score += leadershipBoost

    if (
      breakdown.industry.label === "High" &&
      breakdown.company.label === "High" &&
      breakdown.role.label === "Low"
    ) {
      score = clamp(score + 8, 0, 100)
    }

    const executiveSeniority = ["Owner", "Executive", "VP", "Director"].includes(input.seniority)
    if (
      executiveSeniority &&
      breakdown.industry.label === "High" &&
      breakdown.company.label === "High"
    ) {
      score = clamp(score + 10, 0, 100)
    } else if (
      executiveSeniority &&
      (breakdown.industry.label === "High" || breakdown.company.label === "High")
    ) {
      score = clamp(score + 6, 0, 100)
    }

    return clamp(score, 0, 100)
  }

  function priorityFromScore(score) {
    if (score >= 85) return "Critical"
    if (score >= 70) return "High"
    if (score >= 50) return "Medium"
    return "Low"
  }

  function buildWhyThisMatters(breakdown, input) {
    const bullets = []
    const add = (value) => {
      if (value && !bullets.includes(value)) bullets.push(value)
    }

    for (const bucket of Object.values(breakdown)) {
      for (const reason of bucket.reasons ?? []) add(reason)
    }

    if (breakdown.industry.label === "High" && breakdown.role.label === "Low") {
      add("Strong account fit even though this contact is not the economic buyer")
    }
    if (breakdown.company.label === "High" && !trimOrNull(input.company)) {
      add("Company fit signals are limited until company is confirmed")
    }
    if ((input.existing_opportunities_count ?? 0) > 0) {
      add("Opportunity already in motion — coordinate outreach with account owner")
    }
    if (!bullets.length) add("Limited public context — capture and enrich before prioritizing")

    return bullets.slice(0, 5)
  }

  function recommendSalesMotion(input, breakdown, targetScore) {
    if (input.has_crm_match && (input.existing_opportunities_count ?? 0) > 0) {
      return "Advance active opportunity with account team"
    }
    if (input.has_crm_match) {
      return "Open CRM record and plan account expansion"
    }

    const seniority = input.seniority ?? "Unknown"
    const roleLow = breakdown.role.label === "Low"
    const industryHigh = breakdown.industry.label === "High"
    const companyHigh = breakdown.company.label === "High"

    if (!trimOrNull(input.title)) {
      return companyHigh || industryHigh
        ? "Capture contact and validate account fit"
        : "Identify economic buyer before direct outreach"
    }

    if (includesAny(normalizeText(input.title), [/\bprocurement\b/, /\bpurchasing\b/])) {
      return "Position vendor value and route through procurement workflow"
    }

    if (seniority === "Director" || seniority === "VP" || seniority === "Executive" || seniority === "Owner") {
      return "Run executive outreach sequence"
    }

    if (seniority === "Manager" || seniority === "Lead") {
      return "Capture manager and map service workflow pain points"
    }

    if (roleLow && (industryHigh || companyHigh)) {
      return "Find department leader or clinical engineering decision maker"
    }

    if (roleLow) {
      return "Identify economic buyer before direct outreach"
    }

    if (targetScore >= 70) {
      return "Add to prioritized outreach sequence"
    }

    return "Capture contact and validate account fit"
  }

  function analyzeOpportunityIntelligence(input = {}) {
    const breakdown = {
      industry: scoreIndustryFit(input),
      role: scoreRoleFit(input),
      company: scoreCompanyFit(input),
      relationship: scoreRelationshipFit(input),
      crm: scoreCrmContext(input),
    }

    const target_fit_score = computeTargetFitScore(breakdown, input)
    const priority = priorityFromScore(target_fit_score)
    const crm_context = buildCrmContext(input)
    const why_this_matters = buildWhyThisMatters(breakdown, input)
    const recommended_sales_motion = recommendSalesMotion(input, breakdown, target_fit_score)

    const result = {
      target_fit_score,
      priority,
      industry_fit: breakdown.industry.label,
      role_fit: breakdown.role.label,
      company_fit: breakdown.company.label,
      relationship_fit: breakdown.relationship.label,
      crm_context,
      why_this_matters,
      recommended_sales_motion,
      scoring_breakdown: {
        industry: breakdown.industry.score,
        role: breakdown.role.score,
        company: breakdown.company.score,
        relationship: breakdown.relationship.score,
        crm: breakdown.crm.score,
      },
    }

    console.log(LOG_PREFIX, result)
    return result
  }

  window.EquipifyGrowthOpportunityIntelligence = {
    LOG_PREFIX,
    analyzeOpportunityIntelligence,
    scoreIndustryFit,
    scoreRoleFit,
    scoreCompanyFit,
    scoreRelationshipFit,
    priorityFromScore,
  }
})()
