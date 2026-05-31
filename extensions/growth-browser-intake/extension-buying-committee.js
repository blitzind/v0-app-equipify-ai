/**
 * Deterministic buying committee classification and ranking for Equipify Sales.
 */
;(function initEquipifyGrowthBuyingCommittee() {
  const LOG_PREFIX = "[Equipify Sales:buying-committee]"

  const BUYING_ROLES = ["Decision Maker", "Influencer", "Champion", "End User", "Unknown"]

  const RELEVANT_DEPARTMENTS = new Set([
    "Operations",
    "Service",
    "Technical",
    "Engineering",
    "Clinical",
    "Maintenance",
    "Facilities",
    "Executive",
    "Procurement",
  ])

  const LEADERSHIP_PRIORITY = [
    { pattern: /\bowner\b/, weight: 100, label: "Owner title" },
    { pattern: /\bfounder\b|\bco-founder\b|\bcofounder\b/, weight: 98, label: "Founder title" },
    { pattern: /\bpresident\b(?!.*vice)/, weight: 96, label: "President title" },
    { pattern: /\bceo\b|\bchief executive\b/, weight: 96, label: "CEO title" },
    { pattern: /\bvice president\b|\bvp\b|\bsvp\b|\bevp\b/, weight: 92, label: "VP title" },
    { pattern: /\bdirector\b/, weight: 88, label: "Director title" },
    { pattern: /\bgeneral manager\b|\bgm\b/, weight: 84, label: "General Manager title" },
    { pattern: /\bchief\b/, weight: 90, label: "Chief title" },
  ]

  function trimOrNull(value) {
    const trimmed = typeof value === "string" ? value.trim() : String(value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function normalizeTitle(title) {
    return trimOrNull(title)?.toLowerCase().replace(/\s+/g, " ") ?? ""
  }

  function includesAny(raw, patterns) {
    return patterns.some((pattern) => pattern.test(raw))
  }

  function classifyBuyingRole(title) {
    const raw = normalizeTitle(title)
    if (!raw) return { buying_role: "Unknown", buying_role_confidence: 0 }

    if (
      includesAny(raw, [
        /\bowner\b/,
        /\bco-owner\b/,
        /\bfounder\b/,
        /\bco-founder\b/,
        /\bcofounder\b/,
        /\bceo\b/,
        /\bchief executive\b/,
        /\bchief\b/,
        /\bcfo\b/,
        /\bcoo\b/,
        /\bcto\b/,
        /\bcmo\b/,
        /\bchro\b/,
        /\bpresident\b(?!.*vice)/,
        /\bvice president\b/,
        /\bvp\b/,
        /\bsvp\b/,
        /\bevp\b/,
        /\bdirector\b/,
        /\bhead of\b/,
        /\bgeneral manager\b/,
        /\bgm\b/,
      ])
    ) {
      let confidence = 0.82
      if (includesAny(raw, [/\bowner\b/, /\bfounder\b/, /\bceo\b/, /\bpresident\b(?!.*vice)/])) confidence = 0.94
      else if (includesAny(raw, [/\bvice president\b/, /\bvp\b/, /\bsvp\b/, /\bevp\b/, /\bchief\b/])) confidence = 0.9
      else if (includesAny(raw, [/\bdirector\b/, /\bhead of\b/, /\bgeneral manager\b/])) confidence = 0.86
      return { buying_role: "Decision Maker", buying_role_confidence: confidence }
    }

    if (
      includesAny(raw, [
        /\bmanager\b/,
        /\bsupervisor\b/,
        /\bsuperintendent\b/,
        /\bteam lead\b/,
        /\bdepartment lead\b/,
        /\bgroup lead\b/,
        /\bsection lead\b/,
      ])
    ) {
      return { buying_role: "Influencer", buying_role_confidence: 0.84 }
    }

    if (
      includesAny(raw, [
        /\bsenior technician\b/,
        /\bsr\.?\s*technician\b/,
        /\bsenior engineer\b/,
        /\bsr\.?\s*engineer\b/,
        /\bsenior specialist\b/,
        /\bsr\.?\s*specialist\b/,
        /\bproject lead\b/,
        /\blead technician\b/,
        /\blead engineer\b/,
      ])
    ) {
      return { buying_role: "Champion", buying_role_confidence: 0.8 }
    }

    if (
      includesAny(raw, [
        /\btechnician\b/,
        /\bcoordinator\b/,
        /\boperator\b/,
        /\bassistant\b/,
        /\bassociate\b/,
        /\bspecialist\b/,
        /\bengineer\b/,
        /\banalyst\b/,
        /\brepresentative\b/,
        /\brep\b/,
      ])
    ) {
      return { buying_role: "End User", buying_role_confidence: 0.78 }
    }

    return { buying_role: "Unknown", buying_role_confidence: 0.35 }
  }

  function detectSeniorityWeight(title) {
    const contactIntel = window.EquipifyGrowthContactIntelligence
    if (contactIntel?.detectSeniority) {
      const detected = contactIntel.detectSeniority(title)
      switch (detected.seniority) {
        case "Owner":
          return { weight: 25, label: detected.seniority, confidence: detected.seniority_confidence }
        case "Executive":
          return { weight: 24, label: detected.seniority, confidence: detected.seniority_confidence }
        case "VP":
          return { weight: 22, label: detected.seniority, confidence: detected.seniority_confidence }
        case "Director":
          return { weight: 20, label: detected.seniority, confidence: detected.seniority_confidence }
        case "Manager":
          return { weight: 15, label: detected.seniority, confidence: detected.seniority_confidence }
        case "Lead":
          return { weight: 12, label: detected.seniority, confidence: detected.seniority_confidence }
        default:
          return { weight: 6, label: detected.seniority, confidence: detected.seniority_confidence }
      }
    }

    const raw = normalizeTitle(title)
    if (includesAny(raw, [/\bowner\b/, /\bfounder\b/, /\bceo\b/, /\bpresident\b/])) {
      return { weight: 24, label: "Executive", confidence: 0.85 }
    }
    if (includesAny(raw, [/\bvp\b/, /\bvice president\b/, /\bdirector\b/])) {
      return { weight: 20, label: "Leadership", confidence: 0.8 }
    }
    if (includesAny(raw, [/\bmanager\b/, /\bsupervisor\b/])) {
      return { weight: 14, label: "Manager", confidence: 0.75 }
    }
    return { weight: 5, label: "Individual Contributor", confidence: 0.45 }
  }

  function scoreDepartmentRelevance(department, title) {
    const dept = trimOrNull(department) ?? "Unknown"
    const raw = normalizeTitle(title)
    if (RELEVANT_DEPARTMENTS.has(dept)) {
      return { weight: 22, label: `${dept} department`, confidence: 0.85 }
    }
    if (includesAny(raw, [/\boperation/, /\bservice\b/, /\bfield\b/, /\btechnician\b/, /\bbiomedic/, /\bclinical\b/])) {
      return { weight: 20, label: "Operations-adjacent title", confidence: 0.75 }
    }
    if (dept === "Unknown") return { weight: 4, label: "Department unknown", confidence: 0.3 }
    return { weight: 8, label: `${dept} department`, confidence: 0.5 }
  }

  function scoreContactIntelligenceSignals(record, context = {}) {
    const contactIntel = window.EquipifyGrowthContactIntelligence
    if (!contactIntel?.analyzeContactIntelligence) {
      return { weight: 0, badges: [], confidence: 0 }
    }

    const analysis = contactIntel.analyzeContactIntelligence({
      person: record.name,
      title: record.title,
      company: context.company ?? null,
      hasCrmMatch: Boolean(record.lead_id),
    })

    let weight = 0
    const badges = []

    if (analysis.decision_maker_level === "Executive") {
      weight += 18
      badges.push("Executive decision maker")
    } else if (analysis.decision_maker_level === "High") {
      weight += 14
      badges.push("High decision authority")
    } else if (analysis.decision_maker_level === "Medium") {
      weight += 8
      badges.push("Moderate influence")
    }

    if (analysis.buying_influence === "High") {
      weight += 10
      badges.push("High buying influence")
    } else if (analysis.buying_influence === "Medium") {
      weight += 6
    }

    if (record.source === "current_profile") {
      weight += 6
      badges.push("Current profile")
    } else if (record.lead_id) {
      weight += 8
      badges.push("In CRM")
    }

    return {
      weight,
      badges,
      confidence: Math.min(1, analysis.research_confidence / 100),
      analysis,
    }
  }

  function roleBaseWeight(buyingRole, buyingRoleConfidence) {
    const bases = {
      "Decision Maker": 40,
      Influencer: 28,
      Champion: 20,
      "End User": 8,
      Unknown: 0,
    }
    return (bases[buyingRole] ?? 0) * (buyingRoleConfidence ?? 0)
  }

  function scoreEmployeeRecord(record, context = {}) {
    const classification = classifyBuyingRole(record.title)
    const buyingRole = record.buying_role ?? classification.buying_role
    const buyingRoleConfidence = record.buying_role_confidence ?? classification.buying_role_confidence
    const seniority = detectSeniorityWeight(record.title)
    const department = scoreDepartmentRelevance(record.department, record.title)
    const signals = scoreContactIntelligenceSignals(record, context)

    const roleWeight = roleBaseWeight(buyingRole, buyingRoleConfidence)
    const total =
      roleWeight +
      seniority.weight * seniority.confidence +
      department.weight * department.confidence +
      signals.weight

    const badges = [
      `${buyingRole} · ${Math.round(buyingRoleConfidence * 100)}%`,
      seniority.label,
      department.label,
      ...signals.badges,
    ].filter(Boolean)

    return {
      total: Math.round(total * 10) / 10,
      badges: [...new Set(badges)].slice(0, 4),
      buying_role: buyingRole,
      buying_role_confidence: buyingRoleConfidence,
    }
  }

  function enrichEmployeeRecord(record, context = {}) {
    const classification = classifyBuyingRole(record.title)
    const scored = scoreEmployeeRecord({ ...record, ...classification }, context)
    return {
      ...record,
      buying_role: classification.buying_role,
      buying_role_confidence: classification.buying_role_confidence,
      committee_score: scored.total,
      committee_badges: scored.badges,
    }
  }

  function enrichEmployeeRecords(records, context = {}) {
    return (records ?? []).map((record) => enrichEmployeeRecord(record, context))
  }

  function buildCommitteeSummary(records) {
    const counts = {
      "Decision Maker": 0,
      Influencer: 0,
      Champion: 0,
      "End User": 0,
      Unknown: 0,
    }
    for (const record of records ?? []) {
      const role = record.buying_role ?? classifyBuyingRole(record.title).buying_role
      counts[role] = (counts[role] ?? 0) + 1
    }
    return counts
  }

  function pickBestByRole(records, targetRole, context = {}) {
    const candidates = (records ?? [])
      .map((record) => enrichEmployeeRecord(record, context))
      .filter((record) => record.buying_role === targetRole)
      .sort((a, b) => (b.committee_score ?? 0) - (a.committee_score ?? 0))
    return candidates[0] ?? null
  }

  function buildRecommendedContacts(records, context = {}) {
    const enriched = enrichEmployeeRecords(records, context)
    const picks = [
      { slot: "Best Decision Maker", role: "Decision Maker" },
      { slot: "Best Influencer", role: "Influencer" },
      { slot: "Best Champion", role: "Champion" },
    ]

    return picks
      .map(({ slot, role }) => {
        const best = enriched
          .filter((record) => record.buying_role === role)
          .sort((a, b) => (b.committee_score ?? 0) - (a.committee_score ?? 0))[0]
        if (!best) return null
        return {
          slot,
          role,
          employee: best,
          badges: best.committee_badges ?? [],
          explanation: `${role} · score ${best.committee_score ?? 0}`,
        }
      })
      .filter(Boolean)
  }

  function isLeadershipTitle(title) {
    const raw = normalizeTitle(title)
    if (!raw) return false
    return LEADERSHIP_PRIORITY.some((entry) => entry.pattern.test(raw))
  }

  function leadershipPriorityScore(title) {
    const raw = normalizeTitle(title)
    if (!raw) return 0
    for (const entry of LEADERSHIP_PRIORITY) {
      if (entry.pattern.test(raw)) return entry.weight
    }
    return 0
  }

  function logCommittee(scope, details = {}) {
    console.log(LOG_PREFIX, scope, details)
  }

  window.EquipifyGrowthBuyingCommittee = {
    BUYING_ROLES,
    classifyBuyingRole,
    enrichEmployeeRecord,
    enrichEmployeeRecords,
    buildCommitteeSummary,
    buildRecommendedContacts,
    pickBestByRole,
    scoreEmployeeRecord,
    isLeadershipTitle,
    leadershipPriorityScore,
    logCommittee,
  }
})()
