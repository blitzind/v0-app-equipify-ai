# GE-AIOS-3A — Infrastructure Audit

**Phase:** GE-AIOS-3A — LLM Provider Abstraction  
**Date:** 2026-06-25

---

## Existing systems audited

| System | Location | Relationship |
|--------|----------|--------------|
| Core provider adapters | `lib/ai/providers/*` | **Reused** via `ai-provider-core-bridge.ts` |
| Core provider registry | `lib/ai/providers/index.ts` | **Reused** — `getProviderAdapter`, `isProviderAvailable` |
| Growth copilot provider | `lib/growth/ai-copilot-provider.ts` | **Not modified** — legacy Growth path via `runAiTask` |
| Context Assembly (2J) | `ai-context-assembly-service.ts` | **Input source** — Context Package only |
| Decision Engine (2H) | `ai-decision-engine-service.ts` | **Unchanged** — no direct provider calls |
| Executive Brain (2G) | `ai-executive-brain-service.ts` | **Unchanged** — no direct provider calls |
| Realtime OpenAI | `lib/growth/realtime/providers/*` | **Separate** — speech/STT, not text LLM |

---

## Reuse strategy

- **No duplicate SDK clients** — AI OS delegates to Core `AiProviderAdapter.complete()`
- **Single bridge file** — `ai-provider-core-bridge.ts` is the only AI OS module importing Core adapters
- **Provider registry** — AI OS catalog wraps Core availability with model capability metadata
- **Failover** — tries candidates in preference order; emits degradation/switch events
- **Normalization** — all responses converted to `AiOsProviderNormalizedResponse`

---

## Invocation path

```
invokeAiOsProviderWithContextPackage
  ├─ buildAiOsProviderMessagesFromContextPackage
  ├─ selectAiOsProviderCandidates
  ├─ ai.requested
  ├─ invokeAiOsProviderWithFailover → invokeCoreProviderAdapter → getProviderAdapter
  ├─ normalizeAiOsProviderResponse
  └─ ai.completed | ai.failed
```

---

## Explicitly not in scope

- Wiring Decision Engine or Executive Brain to invoke providers (future phase)
- Replacing legacy Growth `runAiTask` paths outside AI OS
- Realtime transcription provider changes
- Equipify Core modifications

---

## Provider adapters

| Provider | Core adapter | AI OS registry entry |
|----------|--------------|----------------------|
| OpenAI | `createOpenAiAdapter()` | `openai` |
| Anthropic | `createAnthropicAdapter()` | `anthropic` |
| Google Gemini | `createGoogleAdapter()` | `google` |
