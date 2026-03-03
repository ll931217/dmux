---
prd:
  version: v1
  feature_name: multi-provider-ai
  status: draft
git:
  branch: main
  branch_type: main
  created_at_commit: 4669fa52849494bda3af4caaaf26c60cbf72ffcf
  updated_at_commit: 4669fa52849494bda3af4caaaf26c60cbf72ffcf
worktree:
  is_worktree: false
  name: main
  path: ""
  repo_root: /home/liangshih.lin/GitHub/dmux
metadata:
  created_at: 2026-03-03T00:00:00Z
  updated_at: 2026-03-03T00:00:00Z
  created_by: Liang-Shih Lin
  filename: prd-multi-provider-ai-v1.md
beads:
  related_issues: []
  related_epics: []
code_references:
  - file: src/services/PaneAnalyzer.ts
    lines: "29-128"
    purpose: "Core AI consumer — raw fetch to OpenRouter with parallel model fallback"
  - file: src/utils/aiMerge.ts
    lines: "35-77"
    purpose: "Commit message and conflict resolution — raw fetch to OpenRouter"
  - file: src/utils/slug.ts
    lines: "21-71"
    purpose: "Slug generation — raw fetch to OpenRouter with Claude CLI fallback"
  - file: src/utils/onboarding.ts
    lines: "62-123"
    purpose: "Current OpenRouter-only onboarding flow"
  - file: src/utils/openRouterApiKeySetup.ts
    lines: "1-197"
    purpose: "Shell config persistence for OPENROUTER_API_KEY"
  - file: src/services/StatusDetector.ts
    lines: "246-282"
    purpose: "OpenRouter-specific error messages"
  - file: src/types.ts
    lines: "71-96"
    purpose: "DmuxSettings — no AI provider fields currently"
priorities:
  enabled: true
  default: P2
  inference_method: ai_inference_with_review
  requirements:
    - id: FR-1
      text: "Abstract AI layer using ai-sdk with unified generateText interface"
      priority: P1
      confidence: high
      inferred_from: "core architectural change enabling multi-provider"
      user_confirmed: true
    - id: FR-2
      text: "Interactive setup wizard using @clack/prompts"
      priority: P1
      confidence: high
      inferred_from: "explicit user request for guided setup"
      user_confirmed: true
    - id: FR-3
      text: "Support OpenRouter, OpenAI, Anthropic, Google providers"
      priority: P1
      confidence: high
      inferred_from: "explicit user request"
      user_confirmed: true
    - id: FR-4
      text: "Backward compatibility — existing OPENROUTER_API_KEY users unaffected"
      priority: P0
      confidence: high
      inferred_from: "breaking existing users is critical risk"
      user_confirmed: true
    - id: FR-5
      text: "Migrate PaneAnalyzer, aiMerge, slug to use provider abstraction"
      priority: P1
      confidence: high
      inferred_from: "required for multi-provider to actually work"
      user_confirmed: true
    - id: FR-6
      text: "Connection testing during setup"
      priority: P2
      confidence: medium
      inferred_from: "good UX for validating configuration"
      user_confirmed: true
    - id: FR-7
      text: "Re-run setup via settings menu or CLI"
      priority: P3
      confidence: medium
      inferred_from: "users need to change providers after initial setup"
      user_confirmed: false
mcp_servers: []
---

# PRD: Multi-Provider AI Support with Interactive Setup Wizard

## 1. Introduction/Overview

dmux hardcodes OpenRouter as the sole AI provider. Users **must** have `OPENROUTER_API_KEY` set to use AI-powered features (pane status detection, commit message generation, slug generation, conflict resolution). This is restrictive for users who prefer or only have access to direct OpenAI, Anthropic, or Google AI APIs.

This feature introduces a provider abstraction layer using Vercel AI SDK (`ai`) and an interactive setup wizard using `@clack/prompts` to guide users through configuring their preferred AI provider.

## 2. Goals

- Replace hardcoded OpenRouter dependency with a pluggable provider system
- Provide a polished interactive setup experience for first-time users
- Support four major AI providers: OpenRouter, OpenAI, Anthropic, Google
- Maintain zero-disruption backward compatibility for existing users
- Simplify AI-related code by removing duplicated fetch/fallback logic

## 3. User Stories

- **As a new user**, I want to be guided through choosing an AI provider and entering my API key so that dmux works with my preferred service.
- **As an existing OpenRouter user**, I want dmux to keep working without any changes to my setup.
- **As a user with an OpenAI key**, I want to use OpenAI directly instead of going through OpenRouter.
- **As a user**, I want to verify my API key works during setup so I don't discover configuration issues later.
- **As a user**, I want to change my AI provider after initial setup.

## 4. Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-1 | Abstract AI layer using ai-sdk with unified generateText interface | P1 | Core architecture |
| FR-2 | Interactive setup wizard using @clack/prompts | P1 | Replaces readline onboarding |
| FR-3 | Support OpenRouter, OpenAI, Anthropic, Google providers | P1 | Four providers in initial release |
| FR-4 | Backward compat — existing OPENROUTER_API_KEY users unaffected | P0 | Critical |
| FR-5 | Migrate PaneAnalyzer, aiMerge, slug to provider abstraction | P1 | All three AI consumers |
| FR-6 | Connection testing during setup | P2 | Validates config before saving |
| FR-7 | Re-run setup via settings menu or CLI | P3 | Change provider post-setup |

## 5. Non-Goals (Out of Scope)

- **Streaming responses** — all dmux AI calls are short, non-streaming
- **Tool calling / agent patterns** — not needed for current features
- **Per-feature provider overrides** — one provider for all features
- **Bundling gum binary** — using @clack/prompts instead (cross-platform, zero binary deps)
- **Cost tracking or usage monitoring**
- **Custom base URLs** — only OpenRouter uses a custom baseURL; others use defaults

## 6. Assumptions

- Users have at most one active AI provider configured at a time
- API keys are stored as environment variables in shell config (not in JSON)
- The `ai` package supports all four providers via their respective packages
- `@clack/prompts` works in the same terminal environments as dmux (TTY required)

## 7. Dependencies

### New npm packages

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `ai` | Vercel AI SDK core — `generateText` | ~100KB |
| `@ai-sdk/openai` | OpenAI + OpenRouter provider | ~30KB |
| `@ai-sdk/anthropic` | Anthropic provider | ~30KB |
| `@ai-sdk/google` | Google AI provider | ~30KB |
| `@clack/prompts` | Interactive terminal prompts | ~20KB |

### Existing dependencies (unchanged)

- `chalk` — still used for non-wizard console output
- Node.js >= 18 — required for native `fetch` (ai-sdk uses it)

## 8. Acceptance Criteria

- [ ] Running `dmux` with no config and no API keys in env triggers the setup wizard
- [ ] Running `dmux` with `OPENROUTER_API_KEY` set and no config auto-creates config (no wizard)
- [ ] Setup wizard lets user choose from 4 providers, enter API key, select model, test connection
- [ ] API key is persisted to shell config (same mechanism as current `openRouterApiKeySetup.ts`)
- [ ] Provider choice and model preferences saved to `~/.dmux/ai-config.json`
- [ ] PaneAnalyzer works with all 4 providers (status detection, option extraction, summary)
- [ ] Commit message generation works with all 4 providers
- [ ] Slug generation works with all 4 providers
- [ ] All existing tests continue to pass
- [ ] New tests cover provider factory, config management, and setup logic
- [ ] `pnpm run typecheck` passes
- [ ] Non-TTY environments skip wizard gracefully (same as today)

## 9. Design Considerations

### Setup Wizard UI (@clack/prompts)

```
  dmux  AI Provider Setup

  ◆ Select your AI provider
  │ ○ OpenRouter  — multi-model gateway (recommended)
  │ ● OpenAI     — direct API access
  │ ○ Anthropic  — Claude models
  │ ○ Google AI  — Gemini models
  └

  ◆ Enter your OpenAI API key
  │ ▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪
  └

  ◆ Choose your default model
  │ ○ gpt-4o-mini (recommended — fast, cheap)
  │ ● gpt-4o (higher quality)
  │ ○ Custom model ID
  └

  ◇ Testing connection...
  │ ✓ Connected to OpenAI (gpt-4o-mini)
  └

  ◇ API key saved to ~/.zshrc
  └

  ✓ AI provider configured successfully!
```

## 10. Technical Considerations

### Supported Providers

| Provider | Package | Env Var | Default Fast Model | Default Model |
|---|---|---|---|---|
| OpenRouter | `@ai-sdk/openai` (custom baseURL) | `OPENROUTER_API_KEY` | `google/gemini-2.5-flash` | `openai/gpt-4o-mini` |
| OpenAI | `@ai-sdk/openai` | `OPENAI_API_KEY` | `gpt-4o-mini` | `gpt-4o-mini` |
| Anthropic | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` | `claude-haiku-3-5` | `claude-haiku-3-5` |
| Google AI | `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-2.0-flash` | `gemini-2.0-flash` |

### Configuration File (`~/.dmux/ai-config.json`)

```json
{
  "provider": "openrouter",
  "models": {
    "fast": "google/gemini-2.5-flash",
    "default": "openai/gpt-4o-mini"
  }
}
```

- **API keys are NOT stored in this file** — they remain as env vars in shell config
- Each provider maps to a well-known env var name (see table above)

### Model Roles

| Role | Used By | Characteristics |
|---|---|---|
| `fast` | PaneAnalyzer (status detection), slug generation | Lowest latency, cheapest, called frequently |
| `default` | Commit messages, conflict resolution | Better quality, called less frequently |

### Architecture

```
                    ┌────────────────────────────────────┐
                    │        AIProviderService            │
                    │  (singleton, lazy-init)             │
                    ├────────────────────────────────────┤
                    │  + generateText(role, prompt, opts) │
                    │  + generateJSON<T>(role, prompt)    │
                    │  + isConfigured(): boolean          │
                    │  + getProviderName(): string        │
                    │  + getModelId(role): string         │
                    ├────────────────────────────────────┤
                    │  reads: ~/.dmux/ai-config.json      │
                    │  reads: env var for API key          │
                    └──────────┬─────────────────────────┘
                               │ delegates to
                               ▼
                    ┌────────────────────────────────────┐
                    │  ai-sdk generateText()              │
                    │  + @ai-sdk/openai                   │
                    │  + @ai-sdk/anthropic                │
                    │  + @ai-sdk/google                   │
                    └────────────────────────────────────┘
                               ▲
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────┴──────┐  ┌─────┴─────┐  ┌──────┴──────┐
     │ PaneAnalyzer  │  │ aiMerge   │  │ slug.ts     │
     │ (status)      │  │ (commits) │  │ (slugs)     │
     └───────────────┘  └───────────┘  └─────────────┘
```

### Fallback Strategy

Current: parallel `Promise.any()` racing 3 models within OpenRouter.
New: single model call via ai-sdk → Claude Code CLI fallback → safe defaults.

The multi-model racing is removed. The ai-sdk handles provider-level errors. If the primary model fails, we fall back to the existing Claude Code CLI approach, then to heuristic defaults.

### Shell Config Persistence

The existing `openRouterApiKeySetup.ts` is generalized to handle any env var name:
- `persistEnvVarToShell(varName, value)` — replaces `persistOpenRouterApiKeyToShell()`
- Block markers updated: `# >>> dmux ai >>>` / `# <<< dmux ai <<<`
- Supports zsh, bash, fish (same as today)

### Backward Compatibility

Detection priority when no `ai-config.json` exists:
1. `OPENROUTER_API_KEY` in env → auto-create config with `provider: "openrouter"`
2. `OPENAI_API_KEY` in env → auto-create config with `provider: "openai"`
3. `ANTHROPIC_API_KEY` in env → auto-create config with `provider: "anthropic"`
4. `GOOGLE_GENERATIVE_AI_API_KEY` in env → auto-create config with `provider: "google"`
5. None found → trigger setup wizard

## 11. Architecture Patterns

- [x] **Single Responsibility**: AIProviderService handles provider creation; aiConfig handles persistence; aiSetup handles wizard UX
- [x] **Open/Closed**: New providers can be added by extending the provider map without modifying consumers
- [x] **Factory Pattern**: `createProvider(config)` returns the correct ai-sdk provider instance
- [x] **Registry Pattern**: Provider metadata (env var names, default models) stored in a static registry
- [x] **Adapter**: ai-sdk adapts different provider APIs behind `generateText()`

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ai-sdk adds dependency weight | Tree-shakeable; only `generateText` imported. Estimate <200KB total. |
| Breaking existing OpenRouter users | Auto-detect `OPENROUTER_API_KEY` and silently create config |
| JSON mode support varies by provider | Use text mode with JSON parsing fallback for providers that don't support structured output |
| @clack/prompts in non-TTY | Detect `!process.stdin.isTTY` and skip (same guard as today) |
| Provider API rate limits | Existing timeout/fallback patterns preserved |

## 13. Success Metrics

- Existing users with `OPENROUTER_API_KEY` experience zero disruption
- New users complete setup wizard in < 60 seconds
- All AI features work with all four providers
- Test coverage on new code >= 80%
- Package size increase < 500KB

## 14. Priority/Timeline

Single PR, estimated implementation: 5 epics executed in parallel where possible.

## 15. Open Questions

- Should we support `OPENROUTER_API_KEY` and `OPENAI_API_KEY` simultaneously (provider switching without re-setup)?
- Should model IDs be validated against provider's model list during setup?

## Implementation Plan

### Epic 1: Provider Abstraction Layer (P1)

**New files:**
- `src/services/AIProvider.ts` — Provider factory + `generateText`/`generateJSON` wrappers
- `src/utils/aiConfig.ts` — Read/write `~/.dmux/ai-config.json`, provider registry, env var detection

**Modified files:**
- `src/types.ts` — Add `AIProviderConfig`, `AIProviderName`, `ModelRole` types
- `package.json` — Add `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`

### Epic 2: Interactive Setup Wizard (P1)

**New files:**
- `src/utils/aiSetup.ts` — Setup wizard using @clack/prompts

**Modified files:**
- `package.json` — Add `@clack/prompts`
- `src/utils/onboarding.ts` — Replace `runOpenRouterApiKeyOnboardingIfNeeded()` with `runAIProviderSetupIfNeeded()`

### Epic 3: Migrate AI Consumers (P1)

**Modified files:**
- `src/services/PaneAnalyzer.ts` — Replace raw fetch with AIProviderService
- `src/utils/aiMerge.ts` — Replace raw fetch with AIProviderService
- `src/utils/slug.ts` — Replace raw fetch with AIProviderService
- `src/services/StatusDetector.ts` — Update error messages to be provider-agnostic

### Epic 4: Shell Config & Backward Compat (P1)

**Modified files:**
- `src/utils/openRouterApiKeySetup.ts` → Generalize to `src/utils/shellEnvSetup.ts` (provider-agnostic env var persistence)
- `src/utils/onboarding.ts` — Auto-detect existing env vars, silent migration

### Epic 5: Tests & Documentation (P2)

**New files:**
- `__tests__/aiProvider.test.ts`
- `__tests__/aiConfig.test.ts`
- `__tests__/aiSetup.test.ts`

**Modified files:**
- `CHANGELOG.md`

## Relevant Code References

| File Path | Lines | Purpose |
|-----------|-------|---------|
| `src/services/PaneAnalyzer.ts` | 29-128 | Core AI consumer — raw fetch with parallel model fallback |
| `src/utils/aiMerge.ts` | 35-77 | Commit/conflict resolution — raw fetch to OpenRouter |
| `src/utils/slug.ts` | 21-71 | Slug generation — raw fetch with Claude CLI fallback |
| `src/utils/onboarding.ts` | 62-123 | Current OpenRouter-only onboarding |
| `src/utils/openRouterApiKeySetup.ts` | 1-197 | Shell config persistence (block markers) |
| `src/services/StatusDetector.ts` | 246-282 | OpenRouter-specific error messages |
| `src/types.ts` | 71-96 | DmuxSettings — no AI provider fields |

## Changelog

| Version | Date | Summary of Changes |
|---------|------|-------------------|
| 1 | 2026-03-03 | Initial PRD |
