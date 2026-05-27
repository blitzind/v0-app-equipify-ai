/** Growth Engine — Title role groups + industry-aware title mappings (Prospect Search UX). */

export const GROWTH_TITLE_TARGETING_SMART_QA_MARKER = "growth-title-targeting-smart-v1" as const

export const TITLE_ROLE_GROUPS = [
  "Leadership",
  "Operations",
  "Medical Equipment",
  "Technical",
  "Finance",
  "Commercial",
] as const

export type TitleRoleGroup = (typeof TITLE_ROLE_GROUPS)[number]

export type TitleRoleEntry = {
  title: string
  group: TitleRoleGroup
  keywords?: string[]
}

export const TITLE_ROLE_CATALOG: TitleRoleEntry[] = [
  { title: "Owner", group: "Leadership", keywords: ["owner", "proprietor"] },
  { title: "Founder", group: "Leadership", keywords: ["founder", "co-founder"] },
  { title: "CEO", group: "Leadership", keywords: ["ceo", "chief executive"] },
  { title: "President", group: "Leadership", keywords: ["president"] },
  { title: "General Manager", group: "Leadership", keywords: ["general manager", "gm"] },
  { title: "VP Operations", group: "Leadership", keywords: ["vp operations", "vice president operations"] },

  { title: "Operations Manager", group: "Operations", keywords: ["operations manager", "oper"] },
  { title: "Director of Operations", group: "Operations", keywords: ["director of operations", "oper"] },
  { title: "Operations Director", group: "Operations", keywords: ["operations director", "oper"] },
  { title: "Service Director", group: "Operations", keywords: ["service director"] },
  { title: "Field Service Manager", group: "Operations", keywords: ["field service manager"] },
  { title: "Field Service Director", group: "Operations", keywords: ["field service director"] },

  { title: "Biomedical Manager", group: "Medical Equipment", keywords: ["biomedical manager", "bio"] },
  { title: "Biomedical Engineer", group: "Medical Equipment", keywords: ["biomedical engineer", "bio"] },
  { title: "Clinical Engineering Director", group: "Medical Equipment", keywords: ["clinical engineering", "htm"] },
  { title: "HTM Director", group: "Medical Equipment", keywords: ["htm director", "healthcare technology management"] },
  { title: "Maintenance Director", group: "Medical Equipment", keywords: ["maintenance director"] },
  { title: "Asset Manager", group: "Medical Equipment", keywords: ["asset manager", "clinical assets"] },

  { title: "Service Manager", group: "Technical", keywords: ["service manager"] },
  { title: "Technical Director", group: "Technical", keywords: ["technical director"] },
  { title: "Engineering Manager", group: "Technical", keywords: ["engineering manager"] },
  { title: "Facilities Manager", group: "Technical", keywords: ["facilities manager"] },

  { title: "CFO", group: "Finance", keywords: ["cfo", "chief financial"] },
  { title: "Controller", group: "Finance", keywords: ["controller"] },
  { title: "Finance Director", group: "Finance", keywords: ["finance director"] },

  { title: "Sales Director", group: "Commercial", keywords: ["sales director"] },
  { title: "Business Development Director", group: "Commercial", keywords: ["business development", "bd"] },
  { title: "Account Executive", group: "Commercial", keywords: ["account executive"] },
]

/** Industry key fragments → recommended titles (substring match on industry field). */
export const TITLE_INDUSTRY_RECOMMENDATIONS: Array<{
  industryMatch: string[]
  titles: string[]
  roleGroups?: TitleRoleGroup[]
}> = [
  {
    industryMatch: ["medical equipment", "medical device", "biomedical", "healthcare field", "htm"],
    titles: [
      "Biomedical Manager",
      "Clinical Engineering Director",
      "HTM Director",
      "Service Director",
      "Field Service Manager",
      "Maintenance Director",
      "Asset Manager",
    ],
    roleGroups: ["Medical Equipment", "Operations"],
  },
  {
    industryMatch: ["hvac", "mechanical", "mep"],
    titles: ["Service Director", "Operations Manager", "Field Service Manager", "General Manager"],
    roleGroups: ["Operations", "Leadership"],
  },
  {
    industryMatch: ["field service", "commercial equipment"],
    titles: ["Field Service Director", "Operations Manager", "Service Director", "VP Operations"],
    roleGroups: ["Operations", "Leadership"],
  },
  {
    industryMatch: ["electrical", "garage door", "locksmith"],
    titles: ["Owner", "General Manager", "Operations Manager", "Service Director"],
    roleGroups: ["Leadership", "Operations"],
  },
  {
    industryMatch: ["property management", "facilities"],
    titles: ["Facilities Manager", "Maintenance Director", "Operations Director", "Asset Manager"],
    roleGroups: ["Technical", "Operations"],
  },
]

export function normalizeIndustryKey(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function getIndustryTitleRecommendations(
  industry: string | null | undefined,
  limit = 8,
): string[] {
  const key = normalizeIndustryKey(industry)
  if (!key) return []

  const titles = new Set<string>()
  for (const row of TITLE_INDUSTRY_RECOMMENDATIONS) {
    if (row.industryMatch.some((fragment) => key.includes(fragment) || fragment.includes(key))) {
      for (const title of row.titles) titles.add(title)
    }
  }

  return [...titles].slice(0, limit)
}

export function getTitlesForRoleGroup(group: TitleRoleGroup): string[] {
  return TITLE_ROLE_CATALOG.filter((row) => row.group === group).map((row) => row.title)
}

export function allCatalogTitles(): string[] {
  return TITLE_ROLE_CATALOG.map((row) => row.title)
}
