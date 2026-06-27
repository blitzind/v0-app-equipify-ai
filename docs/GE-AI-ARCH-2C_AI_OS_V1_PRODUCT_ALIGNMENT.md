# GE-AI-ARCH-2C — AI OS v1 Product Alignment

**Phase:** GE-AI-ARCH-2C (final pre-commit alignment)  
**Scope:** Presentation, terminology, roadmap, and documentation only — no backend, API, runtime, or migration changes.  
**Certification:** `pnpm test:ge-ai-arch-2c-ai-os-v1-product-alignment`

---

## Product story (locked)

**Equipify Core** — The software customers use to run their company.

**AI OS** — The autonomous AI Growth Operator that Equipify uses internally every day to sell Equipify.

> Ava is Equipify's autonomous AI Growth Operator. She continuously researches prospects, prepares campaigns, books meetings, learns from results, and helps us sell Equipify.

Someday customers will hire their own Ava. **That is not v1.**

**QA marker:** `growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1`

---

## Terminology changes (v1)

| Before | After (v1) |
|--------|------------|
| Your AI Revenue Operator | **Equipify's AI Growth Operator** |
| Marketing Operator / My Marketing Missions | **Growth Operator / Growth Initiatives** |
| Customer Success Operator / Missions | **Customer Growth / Customer Growth Opportunities** |
| Service Operator / My Service Missions | **Customer Delivery Intelligence** (future — hidden by default) |
| Technician Awareness | **Implementation Readiness** (future) |
| Customer Health (ambiguous) | **Equipify Account Health** |
| Service Contribution | **Delivery Impact** (future) |

**Unchanged:** Revenue Missions, Mission Health, Revenue Forecast, Mission Timeline.

---

## Default Home (v1 shipping scope)

1. Ava Check-In — VP of Revenue / Growth Operator voice  
2. My Active Revenue Missions  
3. Mission Health · Revenue Forecast · Next Planned Actions · Mission Timeline  
4. Growth Initiatives (+ Campaign Performance, Content, Audience, Growth Impact)  
5. Customer Growth Opportunities (+ Account Health, Expansion, Renewals, Wins, Impact)  
6. Daily Briefing + continuity + ownership sections  
7. **Hidden:** Customer Delivery Intelligence block (`GROWTH_HOME_SERVICE_OPERATOR_VISIBLE=false`)

---

## Roadmap

| Phase | Name | v1 status |
|-------|------|-----------|
| 1 | AI OS Foundation | ✅ |
| 2 | Branding (UX-1B) | ✅ |
| 3 | Executive Experience (UX-1A/1C) | ✅ |
| 4 | Outcome-first UX (UX-2A) | ✅ |
| 5 | Ava (UX-3A/3B) | ✅ |
| 6 | Living AI (UX-4A–6A) | ✅ |
| 7 | Revenue Operator (UX-8A) | ✅ |
| 8 | Growth Operator (UX-9A realigned) | ✅ |
| 9 | Customer Growth (UX-9B realigned) | ✅ (Equipify accounts only) |

### Future Vision (not v1 default UX)

- Customer AI OS  
- Service Operator (field operations — **not** v1)  
- Finance Operator  
- Operations Operator  
- Company Operator  
- Enterprise AI OS  

---

## Deferred features (code preserved)

| Feature | Flag / location |
|---------|-----------------|
| Customer Delivery Intelligence (6 Home sections) | `GROWTH_HOME_SERVICE_OPERATOR_VISIBLE=false` |
| Service / technician / dispatch narrative | Synthesizer reframed to onboarding; UI gated |
| COO operator voice in check-in | Gated with delivery intelligence |

---

## Certification

```bash
pnpm test:ge-ai-arch-2c-ai-os-v1-product-alignment   # v1 alignment (required before commit)
pnpm test:ge-ai-8a-autonomous-revenue-operator
pnpm test:ge-ai-9a-autonomous-marketing-operator
pnpm test:ge-ai-9b-autonomous-customer-success-operator
pnpm test:ge-ai-9c-autonomous-service-operator        # future vision module cert
```

---

## Release readiness

**Ready for first AI OS v1 commit** when ARCH-2C cert passes and default Home shows no Service Operator / technician / dispatch surfaces.
