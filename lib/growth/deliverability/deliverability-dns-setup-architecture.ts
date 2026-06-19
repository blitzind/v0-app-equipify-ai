/** GE-MAIL-1D — DNS setup operator architecture diagram + runbook pointers (client-safe). */

export const GROWTH_DELIVERABILITY_DNS_SETUP_ARCHITECTURE_QA_MARKER =
  "growth-deliverability-dns-setup-architecture-1d-v1" as const

export const GROWTH_DELIVERABILITY_DNS_SETUP_ARCHITECTURE_DIAGRAM = `
flowchart LR
  subgraph operator_ui [Operator UI]
    DD[GrowthDeliverabilityDashboard]
    SD[DomainSetupDrawer]
  end
  subgraph apis [Platform APIs]
    DNSDash[GET dns-dashboard]
    Setup[GET domain setup-instructions]
    Copy[POST domain copy-setup]
    Validate[POST domain validate]
  end
  subgraph services [Deliverability services]
    SetupSvc[domain-deliverability-setup-service]
    LiveDns[live-dns-service]
    Repo[deliverability-repository]
  end
  subgraph data [Growth schema]
    Domains[sender_domains]
    Checks[domain_dns_checks]
  end
  DD --> DNSDash
  DD --> SD
  SD --> Setup
  SD --> Copy
  SD --> Validate
  Setup --> SetupSvc
  Copy --> SetupSvc
  Validate --> Repo
  Validate --> LiveDns
  SetupSvc --> Domains
  SetupSvc --> Checks
  LiveDns --> Checks
`.trim()

export const GROWTH_DELIVERABILITY_DNS_SETUP_OPERATOR_RUNBOOK = [
  "Open Infrastructure → Deliverability (`/admin/growth/infrastructure/deliverability`).",
  "For each sending domain, choose View Setup Instructions to open the DNS setup drawer.",
  "If Google Workspace is detected, copy the pre-populated MX, SPF, and recommended DMARC values into your DNS host.",
  "For DKIM, follow the Google Admin console steps in the drawer (selector-specific TXT at `selector._domainkey`).",
  "Use Verify DNS after publishing records; use Refresh DNS to re-probe live DNS when `GROWTH_LIVE_DNS_VERIFICATION=true`.",
  "Use Copy Setup From Another Domain to mirror a verified domain's observed DNS values onto a new outbound domain.",
  "Target 100/100 deliverability (SPF, DKIM, DMARC, MX each 25 points) before activating sender pools.",
] as const
