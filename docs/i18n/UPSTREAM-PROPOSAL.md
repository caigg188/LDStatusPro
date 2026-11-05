# Proposal: optional en-US for the LDStatusPro userscript on linux.do

**Status:** implementation published on the fork's `feat/i18n-topic-tools` branch for draft review, including E0/P1, E3 and E4 message/format fixes. Post-rebase validation passed 347/347 tests with 944 catalog keys; audit probes passed 13/13, 10/10 and 7/7. Real manager/browser compatibility and interaction acceptance (E1/E5), plus delivery work (E6), remain open.  
**Current base:** `7f33767`, following the merge of layout PR #97 on 2026-11-05; userscript version remains `3.9.0.7`.  
**Date:** 2026-11-01; status reconciled 2026-11-05.  
**Detailed analysis (Portuguese):** [ANALISE-PT-BR.md](ANALISE-PT-BR.md); [current audit and E0–E6 scope](AUDITORIA-E-ESCOPO-PT-BR.md).

## Summary

I would like to contribute an optional **English (US)** interface for the LDStatusPro application embedded in `linux.do`, while keeping Simplified Chinese as the default and source language.

The goal is one upstream userscript with maintainable translation catalogs. The current branch aggregates the implementation slices below for draft review; the suggested incremental sequence remains a discussion point with the maintainer. Once the initial extraction is complete, new releases should primarily require reviewing changed catalog entries rather than repeatedly patching an English fork.

## Scope

The contribution covers the userscript's own panel, settings, trust-level requirements, reading metrics, trends, rankings, activity, followers, login/sync feedback, tickets, LDC/CDK overlays, AI tools and topic export controls. It includes tooltips, accessible names, loading/empty/error states, chart labels and generated export headings.

The storefront web application and institutional website are outside this phase. Native forum UI and external pages remain under their owners' control. Forum posts, user names, messages and free-form AI output retain their original content; the surrounding plugin interface is localized.

The userscript has additional domain matches and bridge code. Their compatibility must be preserved, while the requested English acceptance scope is the app inside `linux.do`.

## User experience

- Add `简体中文` / `English (US)` to the existing settings menu, available before plugin login.
- Keep Chinese unless the user explicitly chooses English.
- Persist a validated locale through the existing per-site `Storage` abstraction, using an immediate write before any reload.
- Initially, apply the setting through an explicit safe reload if updating all imperative overlays in place is too risky. Do not interrupt unsaved forms, active summaries, exports or other operations; allow applying on a later load.
- Set `lang` on plugin-owned containers and exported documents, not on the forum's entire page.
- Preserve business time zones, LDC units, data formats and transaction behavior.

## Technical direction

Introduce a small module under `src/i18n/`, plain-text catalogs for `zh-CN` and `en-US` split by feature, and a reproducible generated i18n block in `LDStatusPro.user.js`.

The foundation uses a zero-dependency runtime built on browser-native `Intl.PluralRules`, `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat`, bundled reproducibly by `esbuild` (`scripts/embed-i18n.mjs`). The first slice (82 bilingual keys) measured **8,757 bytes minified / 4,022 bytes gzip**. The current 944-key i18n bundle measures **76,311 bytes / 29,253 bytes gzip**; this excludes duplicated messages in the core bundle. E4 fixes localized owned messages and affected date/number consumers. Combined overhead and startup still require validation.

Expose a narrow translation/locale interface, keep persistence outside the pure runtime, and include both catalogs in the userscript so localization works offline. Use semantic keys, named parameters and correct plural families. Keep HTML escaping and existing sanitizers at the rendering sites.

The current userscript is not fully generated: `scripts/embed-core.mjs` only regenerates its marked core block. Localization should use its own marked block without requiring a rewrite of the entire application.

## Compatibility findings

| Finding | Proposed handling |
|---|---|
| Chinese strings are also metric/history keys and parser aliases in `CONFIG` | Preserve identities and parsing; add presentation keys |
| `_normalizeReadingLevels` converts recognized English aliases to Chinese labels | Separate canonical identity from localized presentation |
| `Storage._globalKey` includes a site prefix | Reuse the existing per-site preference convention |
| User-visible errors also originate in `src/core/topic-*.mjs` | Include those messages and their callers in the inventory |
| AI citations and parsing use forms such as `[第1楼]` | Preserve the internal format unless generation, parser and tests change together |
| Remote labels/errors may lack stable localization identifiers | Translate known codes and coordinate missing contracts; track gaps explicitly |
| Baseline CI path filters covered `src/core` only | Local foundation adds i18n coverage; preserve those checks in the proposed contribution |

There is also a build dependency outside the localization scope: the website derives previews from the userscript and checks screenshot hashes. Changes to presentation declarations may require injecting a pure i18n instance into its isolated preview sandbox and refreshing the existing Chinese screenshots. This is compatibility maintenance, not a website translation project; the check should not be bypassed.

## Keeping translations current

The initial audit found incomplete reference scanning and automatic review approval through manifest regeneration. E3 added selective `--approve`, read-only `--status`, and stronger reference checks with regression probes. The current manifest has 944 matching entries and the checker reports 16 dynamically resolved references; matching hashes do not prove human semantic review. The maintenance contract remains:

1. Missing, duplicate, obsolete and unresolved keys.
2. Parameter compatibility and locale-specific plural families.
3. The source-text/context hash against which each English translation was reviewed. Changing Chinese copy under the same key marks English stale.
4. Newly hard-coded visible text, using syntax-aware extraction and explicit exceptions for parser values, data keys, comments, logs and fixtures.

Extraction must not automatically approve a new source hash. Updates should report **added / changed source / removed / awaiting review** entries.

During migration, use a shrinking baseline and block regressions in migrated areas. Before advertising complete English support, require all owned UI messages in scope to be reviewed and exercise the corresponding workflows. Chinese fallback provides resilience but does not count as translated coverage.

Official remote announcements or configurable labels displayed by the plugin may need localized fields or stable identifiers. Those backend capabilities were not established by this source review. A generic English error should not replace a necessary business instruction merely to remove Chinese text.

Machine translation can draft entries, followed by contextual review. The most important maintenance improvement is upstream adoption of the foundation; until then, fork updates will still require patch maintenance and occasional conflict resolution.

## Suggested PR sequence

1. **Foundation:** catalogs, engine, generated block, settings selector, persistence, CI detection and one complete small panel section.
2. **Core panel:** requirements, reading, trends, rankings and remaining settings.
3. **Other workflows:** activity, followers, tickets and LDC/CDK overlays, including failure states.
4. **Topic tools:** AI settings/history/viewer and export controls/generated headings, preserving original topic content.
5. **Audit remediation (E0–E6):** trustworthy tests, safe reload, reproduced functional fixes, review/checker hardening, remaining translations/formatting, accessibility/layout, and delivery preparation. This work is required before claiming completion of the local slices above.

Keep each PR focused, avoid unrelated reformatting or architecture changes, and update short-lived branches against upstream. Preserve the existing release process and official update URLs.

## Acceptance criteria

- Chinese behavior, persisted history keys, parser aliases, API payloads and business calculations remain compatible.
- Persisted locale, invalid values, storage failure, offline use and reload behavior work as specified.
- No locale operation duplicates trackers, network requests or active operations.
- Plurals, dates/numbers, errors and unknown remote values have deliberate handling.
- Interpolation tests cover HTML/attribute injection in imperative templates.
- Validate narrow panel layouts, text expansion, keyboard access, themes and accessible names in both languages.
- Reuse existing `node:test`/jsdom fixtures and isolated topic-tool previews; extend them for the main panel and locale behavior.
- Pass root `npm run check`, strengthened locale checks and existing affected CI dependencies, including preview verification.
- Measure bundle/startup overhead and review the complete plugin surface inventory before claiming full support.

## Decisions requested

1. Would you accept optional en-US support for the userscript, delivered incrementally?
2. Is Chinese-by-default with an explicit persisted selector the preferred behavior?
3. Is the implemented small, dependency-free embedded runtime acceptable subject to total size/startup validation?
4. Is explicit reload-based application acceptable for the initial version?
5. Who should review English terminology and coordinate backend-owned messages where needed?

The next deliverable is E5/E6 acceptance: real userscript-manager/browser smoke checks, layout/accessibility, viewer and print/PDF checks, faithful screenshot provenance, all affected CI checks, and a coordinated version/delivery plan. Existing WebP captures are unchanged and still dated 2026-10-20 although their source manifests were updated. On 2026-11-05, website `npm run check:deploy` passed lint with one existing warning, then failed preview generation with “Plugin screenshots are stale”; TypeScript/Vite did not run. Storefront checks have not been run locally. This contribution should remain a draft until those gaps are addressed. The independent layout PR #97 was merged on 2026-11-05.
