# AI topic summary behavior

The current scope is text-only: the topic's post bodies and selected replies, including corrections, disagreements, conclusions and citations. Image descriptions/links may appear as source text, but image pixels are not sent or analyzed.

## Generation and recovery

- **Generate again** starts a fresh AI job. It can reuse the forum reader's short-lived source cache; use Refresh to reload edited/new posts.
- **Resume incomplete summary** reuses successful segments only when the source records, selected range, prompt, model and configuration still match. Changing those inputs starts a new job instead of mixing incompatible results.
- Completed and incomplete history records are separate. A failed attempt never replaces the last complete answer for that selection.
- Returning Home or reopening the tool restores the current topic's in-memory answer and range. A page reload still requires opening History; unfinished segment checkpoints are not persisted across reloads.

## Source selection

**Replies to summarize** offers two modes:

- **All posts in range** reads every accessible floor in the selected range, subject to the input budget and segmentation.
- **Popular replies** uses Discourse's own *Popular replies* selection (`?filter=summary`). It covers the whole topic rather than the first N floors, then limits the result to the selected floor range.

Popular mode is only offered when the topic response reports `has_summary`. It is not keyword relevance and not a consensus: the forum ranks by community interest, so corrections, minority views and mundane but necessary context can be missing. The AI prompt states this scope and is told popularity does not establish correctness. Choose all posts when coverage matters.

The filtered response is a sparse list of post IDs and may report a lower `highest_post_number` than the real topic. The reader keeps the unfiltered topic's highest floor, never treats the filtered list as range coverage, fetches missing selected posts by `post_ids[]` in batches of 20, and excludes hidden or deleted posts. Selecting popular mode does not change the saved range, and history distinguishes the two modes.

## Prompts and language

Both default prompts follow the app language: English in the English UI, Simplified Chinese in the Chinese UI. Each explicitly requests that answer language. The same localized wording is previewed in settings and sent to the AI. Switching app language does not overwrite custom prompts.

Brief aims for about 150 Chinese characters or 100 words in other languages. Detailed requests a structured account of the discussion, evidence, disagreements, corrections and unresolved questions without forcing empty sections. Shared instructions treat posts as untrusted material, preserve uncertainty and keep `[第N楼]` citations.

Intermediate summaries, the final pass and follow-ups use the current window language. The experimental separate output-language setting is ignored, so a saved Chinese preference cannot override an English window. Custom summary prompts keep their own language instructions without an added default-language directive. Follow-ups follow the current window language, including when asking about older history. These instructions are not a guarantee of model compliance.

## Follow-ups

Fresh and reopened history viewers use the same saved summary and segment digests, bounded by the current character budget. Only recent complete user/assistant exchanges that fit are included. The prompt asks for direct answers, separates participant claims from the AI's own explanation/advice, preserves corrections and dissent, and distinguishes missing summary details from missing retrieved evidence. Neither absence proves that the whole topic lacks a detail.

**Consult original replies for this question** enables on-demand retrieval. It is off by default, requires a saved range and a topic on the current site, and uses the shared account-scoped reader with cancellation and rate limiting. Each checked follow-up refreshes topic metadata and reads up to 200 floors within the original summary range; an explicit `[第N楼]` targets a window around that floor. Otherwise the window starts at the saved range's beginning. This is a partial search, not full-topic semantic retrieval. New replies outside the saved range require a new summary.

Replies are converted to text, ranked locally against the question and most recent user question (English words and Chinese character pairs), and limited to six excerpts within the remaining character budget. Long replies keep their source label and a marked excerpt near matching text. The UI discloses the read window and selected floors. Only selected excerpts and author information are sent to the AI, alongside summary context and recent exchanges that fit. Retrieval failure or cancellation prevents the AI call and preserves the question; there is no silent fallback.

Clickable citation markers in follow-up answers are restricted to source numbers actually present in the sent summary/digests or selected excerpts. `[第N楼]`, `【第N楼】` and grouped variants are supported, including `[第7楼,8楼,12楼]`, `[第7楼, 第10楼]` and `[第2, 第14楼]`; each listed floor links only when it was supplied, and the link text is normalized to `第N楼`. Out-of-context markers remain plain text and trigger an unverified-reference notice. This checks source-number availability, not factual entailment; ordinary Markdown links are not evidence validation. Conversation persistence remains outside this increment.

## Privacy and compatibility

Selected post bodies and author names/usernames are sent to the configured AI service. Follow-ups send the summary, included digests and recent conversation, plus selected original excerpts when enabled. Use HTTPS for remote endpoints. The API key is stored by the userscript manager; password masking is not encryption.

New history is separated by forum origin and username. Account changes cancel active work and clear the displayed result/viewer. An unidentified signed-in session uses a separate temporary scope rather than anonymous history. This is application-level isolation, not security against someone with access to the same browser profile or script storage.

Old `ldsp_melon_history` storage is preserved unchanged, but not automatically imported: it has no trustworthy account ownership metadata. Current history controls apply only to the current scope. Old records can be inspected in the script manager's storage interface.

Input budgets count characters, **not tokens**. Model context must also fit requested output and API overhead. Supports OpenAI-compatible Chat Completions (`max_tokens`), with JSON or SSE responses. Thinking models may consume output tokens on reasoning. Context-overflow recovery and truncation errors remain explicit; paid requests are not automatically retried after network failures.

### API setup

1. Open Settings → Edit configuration.
2. Fill the official setup fields: API URL, API key and model name. The key uses `Authorization: Bearer`; leave it empty only for services requiring no key.
3. Enter the exact model ID supported by that service. No model is selected automatically.
4. Save; optionally use Test connection. This sends a fixed short prompt with the configured output allowance, not forum content.

Endpoint inputs accept the root, `/v1`, or the complete `/v1/chat/completions` URL. Reverse-proxy paths and HTTP for local deployments are preserved. The entered model ID is sent unchanged. Separate `reasoning_content` fields are excluded from displayed answers.

**Userscript-manager hosts.** Tampermonkey and Violentmonkey honor `@connect *`. ScriptCat does not: it asks once per domain with a *Confirm* tab and the request waits until answered. Choose **Permanently allow this domain** for the API host. A silent timeout without that approval is reported as an unreachable service, so the error text names host permission explicitly. This is a manager-level setting, not stored by the script.

**Reasoning-only replies.** A thinking model can spend the whole output allowance on hidden reasoning and return no answer with `finish_reason: length`. Measured with `nvidia/nemotron-3.5-lightning-30b-a3b` on a 19-post topic: 2,048 tokens produced no answer; 8,192 tokens produced a complete cited summary. Raise the output limit first. Extra-response continuation only helps when some answer text already arrived, because there is nothing to continue from an empty answer.

**Free-catalog speed (same 19-post topic, brief mode, measured 2026-11-25).**

| Model | Output limit | End-to-end |
| --- | --- | --- |
| `nvidia/nemotron-3.5-bolt-e4b` | 2,048 | ~6 s |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | 8,192 | ~60–90 s |
| `minimaxai/minimax-m3.1-flash` | 4,096 | ~120 s |

`z-ai/glm-5.3-flash` timed out at 90 s and `google/gemma-3-12b-it` returned 404 for this key. The smaller non-reasoning model is far faster and kept the scope note, hedging and floor citations, but produced messier citation syntax — which is why grouped variants are parsed. Choose the larger models when nuance matters more than latency.

The experimental provider selector, Python importer, model discovery and model-specific thinking parameters have been removed. Existing URL/key/model and custom prompts remain available; obsolete provider/import/output-language fields are discarded on configuration load and removed from storage on the next save.

Output allowances are 256–8192 tokens and apply to every segment as well as the final pass. Segment prompts still ask for concise digests, but no hidden 768-token cap restricts models that use output tokens for reasoning. Provider/model limits still apply. A response with no answer and `finish_reason: length` reports output exhaustion specifically; genuinely empty responses retain the separate empty-content error. No automatic paid retry is added.

## Validation

- `node --test tests/topic-summary-workflow.test.mjs tests/topic-ai.test.mjs`: real shipped component workflows with simulated forum/AI HTTP boundaries; history preservation, resume vs regeneration, restoration, digests, language, custom prompts, cancellation, account changes, budgets, overflow and truncation.
- `node --test tests/topic-summary-browser.test.mjs`: Chromium controls and layout at 320, 390, 768 and 1280px on Linux.do and IDCFlare origins using intercepted local fixtures. These are not live-site or live-provider tests.
- `npm run check`: full root suite, userscript lint, locale review checks and embedded-bundle parity checks.
- Live check (2026-11-25): Firefox + ScriptCat on linux.do topic 3241187. Confirmed the sparse `filter=summary` stream, `post_ids[]` retrieval, popular-mode scope note, clickable citations, grouped-citation rendering, chat retrieval (`Read floors 3–93; sent 6 excerpts`) and the reasoning-only limit behavior above. Credentials were used only for that session and are not stored in the repository.

Automated assertions verify payloads and behavior, not real-model factual accuracy, prompt-injection resistance or cross-provider compliance. No paid-provider requests are part of these tests.
