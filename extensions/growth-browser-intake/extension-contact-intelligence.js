/**
 * Deterministic Contact Intelligence scoring for Equipify Sales SDR workspace.
 */
;(function initEquipifyGrowthContactIntelligence() {
  const LOG_PREFIX = "[Equipify Sales:contact-intelligence]"

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

  function detectSeniority(title) {
    const raw = normalizeTitle(title)
    if (!raw) return { seniority: "Unknown", seniority_confidence: 0 }

    if (includesAny(raw, [/\bowner\b/, /\bfounder\b/, /\bco-founder\b/, /\bcofounder\b/])) {
      return { seniority: "Owner", seniority_confidence: 0.95 }
    }
    if (includesAny(raw, [/\bpresident\b(?!.*vice)/, /\bceo\b/, /\bchief executive\b/])) {
      return { seniority: "Executive", seniority_confidence: 0.95 }
    }
    if (includesAny(raw, [/\bchief\b/, /\bcfo\b/, /\bcoo\b/, /\bcto\b/, /\bcmo\b/, /\bchro\b/])) {
      return { seniority: "Executive", seniority_confidence: 0.9 }
    }
    if (includesAny(raw, [/\bvice president\b/, /\bvp\b/, /\bsvp\b/, /\bevp\b/])) {
      return { seniority: "VP", seniority_confidence: 0.9 }
    }
    if (includesAny(raw, [/\bdirector\b/, /\bhead of\b/])) {
      return { seniority: "Director", seniority_confidence: 0.88 }
    }
    if (includesAny(raw, [/\bmanager\b/, /\bsupervisor\b/, /\bsuperintendent\b/])) {
      return { seniority: "Manager", seniority_confidence: 0.85 }
    }
    if (includesAny(raw, [/\bteam lead\b/, /\btech lead\b/, /\bgroup lead\b/, /\b lead\b/, /\bsenior lead\b/])) {
      return { seniority: "Lead", seniority_confidence: 0.8 }
    }
    if (
      includesAny(raw, [
        /\btechnician\b/,
        /\bspecialist\b/,
        /\bcoordinator\b/,
        /\bassociate\b/,
        /\banalyst\b/,
        /\bengineer\b/,
        /\brepresentative\b/,
        /\brep\b/,
        /\bassistant\b/,
      ])
    ) {
      return { seniority: "Individual Contributor", seniority_confidence: 0.82 }
    }
    return { seniority: "Individual Contributor", seniority_confidence: 0.45 }
  }

  function detectDepartments(title) {
    const raw = normalizeTitle(title)
    if (!raw) return { departments: ["Unknown"], department: "Unknown", department_confidence: 0 }

    const departments = []
    const add = (value) => {
      if (!departments.includes(value)) departments.push(value)
    }

    if (includesAny(raw, [/\bowner\b/, /\bfounder\b/, /\bceo\b/, /\bpresident\b/, /\bchief\b/, /\bexecutive\b/])) {
      add("Executive")
    }
    if (includesAny(raw, [/\bclinical\b/, /\bbiomedic/, /\bmedical\b/, /\bpatient\b/, /\bhospital\b/, /\bhealthcare\b/, /\bnursing\b/])) {
      add("Clinical")
    }
    if (includesAny(raw, [/\bbiomedic/, /\bengineer/, /\bengineering\b/, /\btechnical\b/, /\btechnician\b/])) {
      add("Engineering")
    }
    if (includesAny(raw, [/\bservice\b/, /\bfield service\b/])) add("Service")
    if (includesAny(raw, [/\bmaintenance\b/, /\brepair\b/])) add("Maintenance")
    if (includesAny(raw, [/\bfacilit/, /\bplant\b/, /\bbuilding\b/])) add("Facilities")
    if (includesAny(raw, [/\boperation/, /\bsupply chain\b/, /\blogistic/])) add("Operations")
    if (includesAny(raw, [/\bit\b/, /\binformation technology\b/, /\bsoftware\b/, /\bdigital\b/, /\bcyber/])) add("IT")
    if (includesAny(raw, [/\bprocurement\b/, /\bpurchasing\b/, /\bsourcing\b/])) add("Procurement")
    if (includesAny(raw, [/\bfinance\b/, /\baccounting\b/, /\bcontroller\b/])) add("Finance")
    if (includesAny(raw, [/\bsales\b/, /\brevenue\b/, /\bbusiness development\b/, /\baccount executive\b/])) add("Sales")
    if (includesAny(raw, [/\bmarketing\b/, /\bbrand\b/, /\bgrowth\b/])) add("Marketing")

    if (!departments.length) {
      return { departments: ["Unknown"], department: "Unknown", department_confidence: 0.35 }
    }

    const confidence = departments.length === 1 ? 0.86 : 0.78
    return {
      departments,
      department: departments.join(" · "),
      department_confidence: confidence,
    }
  }

  function scoreDecisionMaker(title, seniority) {
    const raw = normalizeTitle(title)
    let level = "Low"
    let score = 20

    if (seniority === "Owner" || seniority === "Executive") {
      level = "Executive"
      score = 95
    } else if (seniority === "VP") {
      level = "Executive"
      score = 90
    } else if (seniority === "Director") {
      level = "High"
      score = 78
    } else if (seniority === "Manager") {
      level = "Medium"
      score = 55
    } else if (seniority === "Lead") {
      level = "Medium"
      score = 45
    } else if (includesAny(raw, [/\bpresident\b/, /\bfounder\b/, /\bowner\b/])) {
      level = "Executive"
      score = 95
    } else if (includesAny(raw, [/\bdirector\b/])) {
      level = "High"
      score = 78
    } else if (includesAny(raw, [/\bmanager\b/, /\bsupervisor\b/])) {
      level = "Medium"
      score = 55
    }

    return { decision_maker_level: level, decision_maker_score: score }
  }

  function scoreBuyingInfluence(seniority, title) {
    const raw = normalizeTitle(title)
    if (seniority === "Owner" || seniority === "Executive" || seniority === "VP" || seniority === "Director") {
      return "High"
    }
    if (seniority === "Manager" || seniority === "Lead") return "Medium"
    if (includesAny(raw, [/\bmanager\b/, /\bsupervisor\b/])) return "Medium"
    if (includesAny(raw, [/\bdirector\b/, /\bvp\b/, /\bvice president\b/, /\bowner\b/, /\bfounder\b/, /\bpresident\b/])) {
      return "High"
    }
    return "Low"
  }

  function scoreRelationshipStrength(input = {}) {
    const degree = trimOrNull(input.connection_degree)?.toLowerCase().replace("+", "") ?? null
    const mutual = typeof input.mutual_connections_count === "number" ? input.mutual_connections_count : null
    const following = input.is_following === true || input.follower_relationship === "following"

    if (degree === "1st") {
      if (mutual != null && mutual >= 5) return "Strong"
      if (mutual != null && mutual >= 1) return "Moderate"
      return "Moderate"
    }
    if (degree === "2nd") {
      if (mutual != null && mutual >= 3) return "Moderate"
      return "Weak"
    }
    if (degree === "3rd" || degree === "3rd+") return "Weak"
    if (following) return "Weak"
    return "Weak"
  }

  function scoreResearchConfidence(input = {}) {
    const fields = [
      trimOrNull(input.person),
      trimOrNull(input.title),
      trimOrNull(input.company),
      trimOrNull(input.location),
    ]
    const present = fields.filter(Boolean).length
    return Math.round((present / 4) * 100)
  }

  function recommendAngles(title, departments, seniority) {
    const raw = normalizeTitle(title)
    const angles = []

    if (seniority === "Owner" || includesAny(raw, [/\bowner\b/, /\bfounder\b/])) {
      return ["Revenue Growth", "Margin Improvement", "Team Accountability"]
    }
    if (seniority === "Executive" || seniority === "VP") {
      return ["Operational Visibility", "Team Accountability", "Strategic Efficiency"]
    }
    if (seniority === "Director" || includesAny(raw, [/\bdirector\b/, /\bclinical engineering\b/])) {
      return ["Operational Visibility", "Technician Productivity", "Compliance Reporting"]
    }
    if (seniority === "Manager" || includesAny(raw, [/\bmanager\b/, /\bsupervisor\b/])) {
      return ["Team Productivity", "Service Efficiency", "Operational Visibility"]
    }

    const deptSet = new Set(departments ?? [])
    if (deptSet.has("Clinical") || deptSet.has("Engineering") || includesAny(raw, [/\bbiomedic/, /\btechnician\b/])) {
      angles.push("Field Service Efficiency", "Equipment Maintenance", "Service Operations")
    }
    if (deptSet.has("Operations") || deptSet.has("Service")) {
      angles.push("Service Operations", "Workflow Efficiency")
    }
    if (deptSet.has("Sales")) angles.push("Pipeline Growth", "Account Expansion")
    if (deptSet.has("Finance")) angles.push("Cost Control", "Budget Visibility")
    if (deptSet.has("IT")) angles.push("System Reliability", "Integration Efficiency")

    const unique = [...new Set(angles)]
    if (unique.length) return unique.slice(0, 3)
    return ["Operational Efficiency", "Team Productivity"]
  }

  function recommendNextBestAction(input = {}) {
    const { seniority, buying_influence, hasCrmMatch, departments, title } = input

    if (hasCrmMatch) {
      return {
        next_best_action: "Open CRM record",
        next_best_action_reason: "This contact is already matched in Equipify CRM.",
      }
    }

    if (seniority === "Director" || seniority === "VP" || seniority === "Executive" || seniority === "Owner") {
      return {
        next_best_action: "Add to outreach sequence",
        next_best_action_reason: "High-influence contact with likely budget authority.",
      }
    }

    if (seniority === "Manager" || seniority === "Lead") {
      return {
        next_best_action: "Capture and research manager",
        next_best_action_reason: "Influencer who can sponsor operational improvements.",
      }
    }

    const deptSet = new Set(departments ?? [])
    const raw = normalizeTitle(title)
    if (
      buying_influence === "Low" &&
      (deptSet.has("Clinical") || deptSet.has("Engineering") || includesAny(raw, [/\btechnician\b/, /\bbiomedic/]))
    ) {
      return {
        next_best_action: "Identify Clinical Engineering Director",
        next_best_action_reason: "Individual contributor — route outreach through department leadership.",
      }
    }

    if (buying_influence === "Low") {
      return {
        next_best_action: "Identify department decision maker",
        next_best_action_reason: "Low buying influence — find the economic buyer before outreach.",
      }
    }

    return {
      next_best_action: "Add to Equipify",
      next_best_action_reason: "Capture this contact to begin account research.",
    }
  }

  function analyzeContactIntelligence(input = {}) {
    const person = trimOrNull(input.person)
    const title = trimOrNull(input.title)
    const company = trimOrNull(input.company)
    const location = trimOrNull(input.location)

    const seniorityResult = detectSeniority(title)
    const departmentResult = detectDepartments(title)
    const decisionMaker = scoreDecisionMaker(title, seniorityResult.seniority)
    const buying_influence = scoreBuyingInfluence(seniorityResult.seniority, title)
    const relationship_strength = scoreRelationshipStrength(input)
    const research_confidence = scoreResearchConfidence({ person, title, company, location })
    const recommended_angles = recommendAngles(title, departmentResult.departments, seniorityResult.seniority)
    const nba = recommendNextBestAction({
      seniority: seniorityResult.seniority,
      buying_influence,
      hasCrmMatch: input.hasCrmMatch === true,
      departments: departmentResult.departments,
      title,
    })

    const result = {
      person,
      title,
      company,
      location,
      department: departmentResult.department,
      departments: departmentResult.departments,
      department_confidence: departmentResult.department_confidence,
      seniority: seniorityResult.seniority,
      seniority_confidence: seniorityResult.seniority_confidence,
      decision_maker_level: decisionMaker.decision_maker_level,
      decision_maker_score: decisionMaker.decision_maker_score,
      buying_influence,
      relationship_strength,
      research_confidence,
      recommended_angles,
      next_best_action: nba.next_best_action,
      next_best_action_reason: nba.next_best_action_reason,
    }

    console.log(LOG_PREFIX, result)
    return result
  }

  window.EquipifyGrowthContactIntelligence = {
    LOG_PREFIX,
    analyzeContactIntelligence,
    detectSeniority,
    detectDepartments,
    scoreDecisionMaker,
    scoreBuyingInfluence,
    scoreRelationshipStrength,
    scoreResearchConfidence,
    recommendAngles,
    recommendNextBestAction,
  }
})()
