# Changelog

## [Unreleased]

### Added
- Multi-provider AI support via Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- Interactive AI provider setup wizard using `@clack/prompts` (select provider, enter API key, choose model, test connection)
- `AIProviderService` singleton with `generate()` and `generateJSON()` for unified AI calls across all providers
- Provider-agnostic shell environment variable persistence (`shellEnvSetup.ts`) supporting bash, zsh, and fish
- AI config management (`aiConfig.ts`) with auto-detection from environment variables
- Support for OpenRouter, OpenAI, Anthropic, and Google AI providers
- Model role system (`fast` for quick tasks like slugs, `default` for quality tasks like commits)

### Changed
- Migrated `PaneAnalyzer.ts` from raw OpenRouter fetch to `AIProviderService`
- Migrated `aiMerge.ts` commit message and conflict resolution from raw fetch to `AIProviderService`
- Migrated `slug.ts` from raw fetch to `AIProviderService`
- Updated `onboarding.ts` to use new multi-provider setup wizard with auto-detection
- Made `StatusDetector.ts` error messages provider-agnostic
- `generateCommitMessage()` signature changed from `(diff, repoPath)` to `(repoPath)` (diff is now computed internally)

### Deprecated
- `openRouterApiKeySetup.ts` is superseded by `shellEnvSetup.ts` (will be removed in next major)
