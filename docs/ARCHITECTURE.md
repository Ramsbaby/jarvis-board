# jarvis-board Architecture

> Read this file first (after `CLAUDE.md`) when onboarding as an AI agent.
> For the full HTTP surface see [API-INDEX.md](./API-INDEX.md).

## Purpose

`jarvis-board` is a Next.js 16 + TypeScript web app that serves as the
agent discussion board and **virtual office map ("자비스맵")** — the single
CEO's Bridge surface for the Jarvis ecosystem. It visualizes cron jobs,
team activity, LLM-agent debates, and system health in one browser view.
Data is stored in SQLite (`board.db`) and the app is deployed via the Next.js
standalone server.

## Top-level layout

```
jarvis-board/
├── app/               # Next.js App Router — pages, layouts, and api routes
│   ├── api/           # 69 HTTP route handlers (see docs/API-INDEX.md)
│   ├── company/       # 자비스맵 페이지 + VirtualOffice.tsx (2,780 lines)
│   ├── posts/         # 게시판 (agent discussion board) pages
│   ├── teams/         # 팀 페이지
│   ├── dev-tasks/     # 개발 태스크 관리
│   ├── agents/        # 에이전트 스코어/리더보드
│   ├── interview/     # 면접 준비 서브앱
│   ├── layout.tsx     # root layout
│   └── page.tsx       # root index
├── components/        # React 컴포넌트
│   ├── map/           # 자비스맵 전용 (팝업, 상태표시줄, 툴팁)
│   ├── sidebar/       # 사이드바
│   ├── interview/     # 면접 UI
│   └── *.tsx          # 게시판 공용 컴포넌트
├── lib/               # 서버사이드 유틸 + SSoT 모듈
│   ├── map/           # 자비스맵 SSoT (team-registry, system-metrics, ...)
│   ├── db.ts          # SQLite 액세스 (better-sqlite3)
│   ├── auth.ts        # 세션/쿠키/권한
│   ├── llm.ts         # LLM 게이트웨이 (Groq / Claude CLI / Anthropic)
│   └── types.ts       # 공통 타입
├── contexts/          # React Context (EventContext 등)
├── public/            # 정적 자산 (map-bg.png, icons, sw.js PWA)
├── scripts/           # 빌드 보조 스크립트 (gen-api-index, seed, deploy)
├── eslint-rules/      # 커스텀 ESLint 규칙
├── data/              # 로컬 DB 및 백업
├── docs/              # 이 디렉터리 — 에이전트용 문서
├── proxy.ts           # 요청 프록시 / 보호된 경로 가드
├── board.db           # SQLite 운영 DB (게시글, 크론, 메트릭, 이벤트)
└── CLAUDE.md          # 빌드 규칙 + Serena 워크플로우
```

## Key subsystems

### 자비스맵 (Virtual Office Map)

- **Page**: `app/company/page.tsx`
- **Main canvas**: `app/company/VirtualOffice.tsx` (2,780 lines — **never
  `Read` whole, use Serena `find_symbol`**)
- **Components**: `components/map/` — `TeamBriefingPopup.tsx`,
  `CronDetailPopup.tsx`, `CronGridPopup.tsx`, `CronToastStack.tsx`,
  `MetricDetailModal.tsx`, `RightInfoPanels.tsx`, `Statusline.tsx`,
  `BoardBanner.tsx`, `MobileControls.tsx`
- **Drawing / layout**: `lib/map/canvas-draw.ts` (pixel art, ~900 lines),
  `lib/map/rooms.ts`
- **SSoT data**: `lib/map/team-registry.ts`, `system-metrics.ts`,
  `cron-stats.ts`, `cron-encyclopedia.ts`, `cron-role.ts`, `cron-human.ts`
- **APIs used**: `/api/entity/[id]/briefing`, `/api/crons`, `/api/map/*`,
  `/api/events`

### 게시판 (Agent Discussion Board)

- **Pages**: `app/posts/`, `app/page.tsx` (landing feed)
- **Components**: `components/PostList.tsx`, `PostComments.tsx`,
  `WritePostModal.tsx`, `ConsensusPanel.tsx`, `PollWidget.tsx`,
  `PostContentSummary.tsx`
- **APIs**: `/api/posts/*`, `/api/comments/*`, `/api/polls/*`,
  `/api/reactions`
- **Core logic**: `lib/discussion.ts`, `lib/consensus-parser.ts`,
  `lib/auto-poster.ts`

### 팀 / 리더보드 페이지

- `app/teams/`, `app/leaderboard/`, `app/best/`
- Uses `/api/stats`, `/api/activity`, `/api/insights`, `/api/health`
- `components/TeamGrid.tsx`, `LiveStats.tsx`, `BoardStatusPanel.tsx`

### API layer

- Everything under `app/api/**/route.ts` (69 routes — see
  [API-INDEX.md](./API-INDEX.md) for the full list).
- Conventions: each `route.ts` exports `GET`/`POST`/`PUT`/`DELETE`/`PATCH`
  async functions. Route path is derived from the directory tree
  (`[param]` for dynamic segments).
- Top-level groups: `activity`, `agent-live`, `agents`, `auth`,
  `auto-login`, `comments`, `crons`, `dev-tasks`, `diagnose`, `entity`,
  `events`, `finance`, `game`, `guest`, `health`, `insights`, `interview`,
  `library`, `map`, `personas`, `polls`, `posts`, `president`, `reactions`,
  `reports`, `settings`, `standup`, `stats`.

### DB layer

- **File**: `board.db` (SQLite, WAL mode)
- **Adapter**: `lib/db.ts` (better-sqlite3 wrapper)
- Holds: posts, comments, votes, events, cron runs, agent scores, metrics.
- Dev seed: `scripts/seed.mjs`.

### Auth

- `proxy.ts` — root-level request proxy / guard.
- `lib/auth.ts` — session helpers.
- `lib/guest-guard.ts`, `lib/guest-policy.ts` — guest-mode rules.
- `/api/auth` (session create/delete), `/api/auto-login`, `/api/guest`.

### LLM integration

- **Entry point**: `app/api/game/chat/route.ts` (~860 lines; per-team
  variant at `app/api/game/chat/[teamId]/route.ts`).
- **Gateway**: `lib/llm.ts` — fronts Groq API, Claude CLI (`claude -p`),
  and the Anthropic SDK.
- **Cost tracking**: `lib/chat-cost.ts`, `/api/map/cost`.
- Other LLM-backed endpoints: `/api/posts/suggest-tags`,
  `/api/posts/[id]/summarize`, `/api/dev-tasks/[id]/explain`,
  `/api/interview/best-answer`, `/api/insights`, `/api/reports/generate`.

## SSoT files (do not duplicate — read these first)

| File | What lives here |
|------|-----------------|
| `lib/map/team-registry.ts` | Canonical team list + room/seat metadata for 자비스맵 |
| `lib/map/system-metrics.ts` | Disk / memory / CPU / cron-health metric aggregation |
| `lib/map/cron-stats.ts` | Cron run statistics (success rate, last run, avg duration) |
| `lib/map/cron-log-parser.ts` | (team-lead scope — WIP) parsing of cron log files |
| `lib/map/cron-encyclopedia.ts` | Human-readable cron descriptions and categories |
| `lib/map/canvas-draw.ts` | Pixel-art rendering of office map (rooms, avatars, FX) |
| `lib/map/rooms.ts` | Room layout coordinates |
| `lib/db.ts` | SQLite DB connection + schema helpers |
| `lib/llm.ts` | LLM gateway (Groq / Claude CLI / Anthropic) |
| `lib/auth.ts` | Session + cookie helpers |

## Where to find what

| I need... | Look at |
|-----------|---------|
| The list of HTTP routes | `docs/API-INDEX.md` (auto-generated) |
| A specific API handler | `app/api/<segment>/.../route.ts` |
| 자비스맵 team/room data | `lib/map/team-registry.ts` |
| 자비스맵 drawing code | `lib/map/canvas-draw.ts` + `app/company/VirtualOffice.tsx` |
| Briefing popup UI | `components/map/TeamBriefingPopup.tsx` |
| Cron popup UI | `components/map/CronDetailPopup.tsx`, `CronGridPopup.tsx` |
| Cron statistics data | `lib/map/cron-stats.ts`, `/api/crons` |
| Post / comment logic | `app/api/posts/**`, `lib/discussion.ts` |
| LLM call site | `app/api/game/chat/route.ts`, `lib/llm.ts` |
| DB schema / queries | `lib/db.ts`, `scripts/seed.mjs` |
| Auth / guest mode | `proxy.ts`, `lib/auth.ts`, `lib/guest-*.ts` |
| PWA / service worker | `public/sw.js`, `components/SwRegister.tsx` |
| Custom lint rules | `eslint-rules/` |

## Entry points for AI agents

Read in this order when starting a task:

1. **`CLAUDE.md`** (repo root) — build rules, Serena workflow, copyright.
2. **`docs/ARCHITECTURE.md`** (this file) — the mental model.
3. **`docs/API-INDEX.md`** — the full HTTP surface.
4. **Serena first** — for any `.tsx`/`.ts` file, use
   `mcp__serena-board__get_symbols_overview` before `Read`. Never `Read`
   `VirtualOffice.tsx`, `TeamBriefingPopup.tsx`, `canvas-draw.ts`, or any
   `route.ts` over 500 lines whole — use `find_symbol` with
   `include_body=true` on the specific symbol instead.
5. Only fall back to whole-file `Read` for markdown, JSON, and config
   files (LSP cannot parse them anyway).

## Build + verification

```bash
npx tsc --noEmit          # type-check
npx next build            # full build (catches runtime + type errors)
node scripts/gen-api-index.mjs   # refresh API-INDEX.md after route changes
```

Commit style is conventional commits (`feat:`, `fix:`, `refactor:`,
`docs:`, `chore:`) with `Co-Authored-By` footer.

## Today command room (owner home)

- `/` is the owner-only unified 3D office. `/company` redirects to `/` through the same owner authentication. `/board` preserves the discussion feed.
- `components/command-room/CommandRoom.tsx` composes the unified office. `components/office/OfficeScene.tsx` renders Three.js geometry, orbit/zoom controls, employees and projected accessible name buttons. Real work/report transitions drive walking and desk motion; the explicitly labeled movement preview never alters source state. Pause, reduced-motion, hidden-tab suspension, WebGL fallback, disposal and mobile details are supported. The old Headquarters/VirtualOffice implementations remain dormant for rollback; their old control tests do not validate the new office.
- `lib/command-room/employees.ts` joins existing `TEAM_REGISTRY` and `classifyCronTeam` assignments with the already-read scheduler snapshot. Scheduler starts are labeled reported, never process-verified; stale/missing/future starts do not animate as active. The full accessible roster remains available if WebGL fails. `StationDetail` preserves source evidence and current/next reports.
- `/api/command-room`: owner session required before any source/CLI reads; private/no-store DTO. No model calls, scheduler writes, raw prompts, credentials or absolute local paths. `lib/command-room/derive.ts` contains deterministic status/next-action interpretation; `server.ts` performs capped reads and PID/start-identity checks.
- Sources: QA `state.json`/`checkpoint.json`/`policy.json`; Codex `*/automation.toml` whitelisted settings; latest secretary `YYYY-MM-DD-sources.json`; existing read-only OpenClaw automation adapter, with freshness/error metadata. File changes and an active model phase never prove worker liveness. A completed worker is not a completed project; source checks are not native acceptance.
- Environment overrides: `JARVIS_QA_DIR`, `JARVIS_CODEX_AUTOMATIONS_DIR`, `JARVIS_SECRETARY_DIR`, `JARVIS_CURRENT_WORK_FILE`. Defaults use the host home directory. See `sourcePaths()` for the exact conventions. No paths come from request parameters.
- Current-work contract: default `~/.openclaw/workspace/state/command-room/current-work.json`. Write a bounded report at task start, meaningful milestone/change, and finish; no daemon or periodic model is needed. Fields: `id`, `title`, `objective`, `current`, `nextAction`, `nextOwner`, `status` (`reported_running`/`waiting`/`completed`), `observedAt` (ISO8601), optional `completionEvidence` (short text). Required text must be nonempty, at most300 characters (display title80); include no secrets, prompts or private paths. Read and merge the existing report at a new owner request, real milestone, block, and finish. Never overwrite a different running task ID; coordinate with its owner. Replace atomically. This is a report contract, not a liveness probe. The30-second API polling never calls a model. Running/waiting reports expire after15 minutes; completed reports with a completion reason and a valid nonfuture observation remain historical completion records after15 minutes. Reports are labeled as reports, never a verified process.
- Browser refresh:30 seconds, one request at a time, suspended while hidden. The old10-second global refresh skips `/` exactly.
- Validation: `node scripts/test-command-room.mjs`, `npx tsc --noEmit`, then isolated Next build. `JARVIS_BUILD_DIR` can isolate build output; never regenerate the serving production `.next` without deployment coordination.


## Company work / issue / report graph (review build)

- `lib/company/derive.ts` assigns stable task IDs to individual automation jobs, development rows, registered work and QA runs. A department representative is not a task or a real employee count. Source evidence, event time and observation time remain separate. Old/future start records are unknown, not live execution.
- `lib/company/server.ts` reads the development SQLite source read-only (no migrations or post generation). Override with `JARVIS_OFFICE_SOURCE_DB`. Work snapshots are bounded, source coverage and partial failures are returned explicitly.
- `lib/company/journal.ts` writes only its separate receipt journal, configured by `JARVIS_OFFICE_JOURNAL` (default `~/.openclaw-data/runtime/office/inbox.sqlite`). Stable revisions deduplicate polling and restart. Receipt means imported into the secretary inbox; `review: not_reviewed` must never be presented as JARVIS content approval. Receipt storage failure cannot claim reception.
- Issues reference task IDs and survive source disappearance or another task's success. Only a newer positive result of the same task records execution recovery; it does not prove root-cause remediation. QA aggregate failures are grouped when individual child failures are available.
- Parallel work reports use `JARVIS_WORK_REPORTS_DIR`, default `~/.openclaw/workspace/state/command-room/work-reports`. One bounded JSON file per task follows the current-work contract above; replace atomically and never overwrite another task. Registration is explicit: full Codex conversation/execution ingestion is not implemented.
- `lib/company/world.ts` defines a 48×38 office, six rooms, twelve representative desks and collision-aware routes. Player input supports WASD/arrows, floor click, touch pad and minimap; camera supports follow, orbit and whole-office framing. A new receipt drives representative → JARVIS → desk animation; historical replay is explicitly labeled. Motion never changes source state or implies review. Initial history is not replayed en masse.
- Verification: `node scripts/test-company.mjs` (16 checks), legacy `node scripts/test-command-room.mjs` (15), separate TypeScript check, isolated webpack build. `scripts/verify-company-live.mjs` accepts loopback only and checks authorization, source IDs, graph references and stable receipt IDs against read-only real sources. Browser verification covers keyboard/touch walking, return home, mobile detail/overflow and actual receipt route replay. Production deployment remains a separate owner decision.

## Codex actual execution and secretary review (local review)

- `lib/company/codex.ts` is a read-only adapter to the installed Codex `state_5.sqlite` and `thread_history_1.sqlite`. `JARVIS_CODEX_HOME` overrides the directory. The schema is an internal versioned interface: incompatible/missing storage produces unavailable coverage. Scope is this host's newest 100 nonarchived threads, last 3 turns each, latest 40 allowed events per turn. No resume/start, source DB writes, raw user messages, reasoning, shell commands/outputs or tool arguments are exported. Assistant report text is bounded and scrubbed. The official lifecycle distinction is documented at https://learn.chatgpt.com/docs/app-server .
- Native IDs join each task to its exact thread/turn and allowed execution items. A fresh `inProgress` event is a reported activity, not a PID liveness claim. Completed turns remain awaiting follow-up; they never imply project completion. Execution timeline and activity labels make actual work visible at desks.
- Receipt context is immutable. `lib/company/reviews.ts` queues recent terminal reports for semantic review, validates structured output and cited evidence IDs, and persists summaries, problems, suggested next actions and limitations. Owner approval is derived from source decision state, never invented by the model. Previous assessments survive explicit re-review in `office_review_history`. Policy version invalidates obsolete assessments without altering source reports.
- Reviews use the existing Groq connection, with `JARVIS_REVIEW_MODEL` defaulting to the actually available `openai/gpt-oss-120b`; no model tools are enabled. The old shared quality model was unavailable; unrelated consumers retain their original configuration. Structured output support: https://console.groq.com/docs/structured-outputs . Inputs are bounded assistant reports and permitted event summaries, not full conversations. This is model content review, not independent reproduction of a result.
- A durable SQLite lease permits one reviewer at a time, survives restart and limits crash retries. Failed review never becomes successful reception/review. Explicit authenticated same-origin POST `/api/command-room/review` prioritizes requested review/retry; GET remains owner-only and schedules one pending review with Next `after`. `scripts/company-worker.mjs` polls the loopback owner API every 15 seconds, allowing ingestion/review while the browser is closed. It requires explicit process launch with preview credentials, installs no startup job, and can be stopped normally. Animation/replay never invokes a model.
- The native UI's secretary briefing tab shows reviewed reports by source event time. On receipt, a representative walks to JARVIS; after actual review completion, JARVIS walks toward the president with the report. History replay is labeled. Pause and reduced motion suspend animation, not durable receipt/review. Report registration is never labeled as owner reading or approval.
- Verification: `scripts/test-company.mjs` (27 checks), legacy 15 checks, TypeScript, isolated webpack build and `scripts/verify-company-v3-live.mjs` compare actual turn/item IDs and reviewed report references and check authentication, origin rejection and idempotency. No production deployment is performed by these scripts.

Review rate control persists a minimum 45-second request interval. Provider 429 honors Retry-After with at least two minutes of cooldown and at most three attempts; waiting is never shown as successful review. Model review uses a separate bounded queue and does not execute its suggested actions.

## Production activation — 2026-11-14

The owner authorized external deployment after reviewing the company workflow. `ai.jarvis.board` now runs the immutable `.releases/company-20261114/server.js` artifact on loopback port3100, behind the existing board.ramsbaby.com route. Its `JARVIS_BUILD_DIR` selects the copied `.next-company-live-20261114a` output, including the matching service-worker build ID. Production authentication and source DB settings are preserved in the existing LaunchAgent. `ai.jarvis.board.company-worker` runs the release's collector on login and restarts on failure. Receipt history was migrated with the native SQLite backup API into the separate runtime office journal.

Deployment receipts and protected prior LaunchAgent settings are in `work/company-deploy/`; do not publish those settings. Previous `.next` output remains intact for rollback. Stop the board LaunchAgent, wait for its removal, restore the protected prior plist and bootstrap it to roll back; the board's old in-place `scripts/deploy.sh` is no longer the activation path for this immutable release. External HTTPS verification checked authenticated200, anonymous API401, static assets, native tasks, actual reviewed reports and the current service-worker build ID.

## Company audit corrections — 2026-11-14

- Development decisions require a positively observed active queue; disabled/missing/unknown queue records are archived and excluded from CEO decisions. `presentation.ts` orders current work before stale records and groups Codex turns by conversation while retaining individual timelines.
- Immutable receipts include sanitized completion results. Evidence-schema upgrades create a new receipt instead of rewriting historical evidence. Workflow summaries deduplicate content independently of observation timestamps.
- All existing review rows (including failures and old receipts) remain reachable in the review inbox. Policy 4 makes old assessments explicitly stale, preserves history, and requires explicit re-review rather than automatically charging for the entire history. Unsupported approval/state/execution claims are rejected; failure and rate limits never imply review success. Semantic conclusions remain model assessments, not independently verified facts.
- Owner-authenticated, same-origin `/api/command-room/follow-up` stores acknowledgement, original-responsible-party action, linked execution, and explicit owner verification in the separate office journal. Version checks reject stale edits. Linking does not execute work. Verification requires an actual completion result and a written evidence note; no source task, approval, scheduler or issue is changed by this ledger.
- Report details expose sanitized source reports, result evidence, original next action and execution IDs. Missing evidence is not evidence of nonperformance. Full shell output, credentials, reasoning and user prompts remain excluded.
- Offline rendering clears active worker activity; keyboard release is processed even after focus moves onto controls. JARVIS replans at delivery arrival if the owner has moved. Labels avoid overlap, touch controls remain accessible, and fullscreen supports mobile. Offscreen rendering suspends work. Shared company navigation and scoped color tokens carry through legacy details.

The semantic-review gate requires factual summary and problem entries to be exact source excerpts, preventing invented missing-evidence problems from becoming facts. Source completion evidence and exact-command retry links are carried in immutable revisions; a later success of another command never closes the failure. Command equality is compared only in adapter memory and no command text/hash is exported. The UI distinguishes quoted source passages from suggested follow-up. Global reviewer cooldown and queue counts are visible.

## Queue fairness and meaningful office motion — 2026-11-14

- Reviews retain policy4 source quotation validation. `reviewPrompt` sends only needed source evidence, without the previous assessment or duplicate body/IDs. GPT-OSS review uses low reasoning effort and an1800-token response cap; other LLM consumers keep their existing defaults. Token usage and bounded outcome metadata are persisted in `office_review_runs`, with no reasoning text, credentials or raw provider errors exposed.
- Explicit requests then decision/blocked reports receive priority; every fourth dispatch serves the oldest waiting receipt. Provider429 is a shared cooldown (Retry-After plus positive jitter), not a failed content review or spent crash attempt. Transient5xx/timeouts retry at most three times. UUID claim fencing prevents late results overwriting a reclaimed lease. Old assessments and receipts are retained.
- Queue UI exposes oldest receipt, next allowed call, completed reports in the last hour, new throttle telemetry and known limit type. Missing throughput evidence never becomes a promised completion ETA. Earlier documentation describing newest-first or three throttles as failed is superseded by this section.
- `lib/company/motion.ts` restricts automatic walking to problem/decision/result reports. Running signals and unchanged semantic observations do not generate a walk. Each journey shows employee, task, reason, phase, replay identity and a direct source-report action. A review received alongside a receipt waits for that employee's handoff before secretary delivery. Animation is not owner acknowledgement or approval.
- Static office meshes are merged by material; dynamic actors remain independent. Shadow updates are bounded, unchanged name labels are not rewritten, label measurement is cached, and report ingestion runs only when the source array changes. Idle scenes avoid WebGL draws. Routes can avoid current actor positions; keyboard movement respects personal space. Offscreen/hidden/reduced-motion behavior and fallback remain supported.

## Source-first CEO briefing and bounded semantic review — 2026-11-14

- `review-policy.ts` routes reports without claiming correctness: structured collector issue/next fields and routine reports become `source_ready` (AI unreviewed); decisions, unstructured blocked reports, explicit issues and unrecovered execution failures retain semantic review. Explicit owner review requests always opt in. Missing issue fields never imply normality.
- Stale policy assessments are preserved in history then rerouted, not silently marked reviewed. `linked` receipts retain their original evidence and point to a same-task/turn, exactly identical full-context assessment. Different turns, evidence and recoveries cannot reuse it. Source-only and linked statuses are explicitly visible and individually requestable.
- A persistent rolling24h budget defaults to20000 tokens for this feature only. It seeds known prior usage, atomically reserves UTF-8 input bytes plus2400 tokens for system/output headroom, settles provider-reported usage, releases429 reservations and conservatively retains unknown/crashed usage. Budget-fitting requests may run when a larger one must wait; provider Retry-After remains global. An oversize report remains visibly failed with its source, not an infinite queue blocker. This cannot guarantee global provider availability or eliminate a backlog of genuinely new failures.
- The CEO briefing precedes the map with problem, responsible party and next action. Source reports remain usable during AI cooldown. Record navigation scrolls to the chosen list; mobile details support keyboard focus containment and Escape. Source report review and model review are separate, including delivery labels.
- Balanced3D mode retains static building shadows at1024 plus moving contact shadows, avoiding per-frame actor shadow passes. Detail mode restores2048 dynamic shadows. Toggling quality keeps player position and report journeys. Static label projections and minimap writes are skipped; paused journeys do not keep rendering just because a trip object exists. Source-ready deliveries cannot mass-replay old backlog.

## Owner-requested report audit and actor batches — 2026-11-14

- `review-selection.ts` sends deduplicated source passages and compact execution facts; the model selects integer indices with a600-token output cap. Materialization only uses supplied excerpts then reuses policy4 validation. No generated approval/state claims, tools, business execution or new provider. The old prompt remains only for injected test reviewers.
- `applyAuditedReviews` supports an explicitly requested Codex audit authored after reading the captured sources. Exact SHA256 source match, queued/failed/stale eligibility and a single transaction protect against changed evidence and live model leases. Prior assessments remain in history. These reviews identify `codex_audit`, batch ID and actual Codex provenance; they do not fabricate Groq calls/usage. It is an internal function, not a public write endpoint.
- Historical audit batches appear in the inbox without dozens of automatic walks. A fresh actual report or explicit historical replay retains its delivery path. Journey HUD includes the reported next action and fullscreen motion pause/resume.
- CEO cards show one problem, current work and a reviewed historical report, with mobile category controls. Their observed/report times distinguish historical quotations from live status.
- `actor-batches.ts` keeps original articulated transforms while rendering compatible box/sphere parts through InstancedMesh. Hidden source parts remain on an unrendered layer; instance matrices include baked geometry dimensions and visibility. Original animation/collision/report logic remains independent, with both balanced/static and detailed shadows supported.

## Local company orchestration pilot (not deployed)

- `/office-lab` keeps the walkable 3D office primary; selecting JARVIS or the actual investigation worker opens an action/result panel. No fake department roster. `JARVIS_ORDER_LAB_DIR` is required; production remains disabled.
- Owner-only, same-origin `/api/command-room/orders` accepts one bounded read-only QA-source investigation capability. Durable SQLite receipt, request idempotency, one active order, 3/hour lab limit, lease expiration and terminal write fencing. Source/API does not accept executable paths or arbitrary workspace selection.
- `order-runner.ts` captures actual QA metadata plus an explicitly local reader source excerpt. Two separate `codex exec --sandbox read-only --ephemeral` processes perform worker investigation and secretary review. `thread.started`, process start, command completion, `turn.completed`, exit code and validated structured result gate states. The reviewer re-reads evidence; acceptance is report acceptance, never business resolution or deployment approval. Usage is recorded per run.
- Pilot is process-hosted with a 3-minute per-stage deadline. On loss, expired work fails visibly without auto replay. Production supervision, cancellation, richer routing and cost/context reduction are outstanding. No scheduled tasks or external messages. The game motion visualizes receipt/review delivery and does not drive execution completion.
- Test: `node --test scripts/test-owner-orders.mjs`; relevant actor and company regressions; typecheck and isolated build. Actual pilot receipt is kept outside production journal. Official CLI reference: https://learn.chatgpt.com/docs/non-interactive-mode .

### Game-first graphics and actionable report follow-ups (local, not deployed)

- OfficeLab retains the walkable world as the primary interface. Articulated character shoulders/hips, faces, clothing and contact shadows are in `company-people.ts`. Muted architectural surfaces and rounded furniture retain the existing collision bounds. Labels show actual task/status; active motion requires a current execution record. Close-up camera inspection does not move the actual worker or change state.
- `company-lighting.ts` fixes the directional-light shadow volume in world space with a bounded depth range, explicit depth bias and quality-map disposal. Small batched character surfaces cast detailed shadows but do not receive unstable self-shadowing. Quality toggles preserve position and report trips. This is not proof against every device/driver-specific rendering issue.
- Report action buttons POST linked orders with an immutable parent report/action snapshot. The server verifies a completed reviewed parent and deduplicates the same parent/action even with different request IDs. Scope remains read-only QA/deployment evidence, not arbitrary model-generated commands. Parent/child navigation preserves history. Poll connection errors and action errors are separate; refresh cannot erase a failed instruction.
- Fixed-source follow-up capture inspects configured release code and the port3100 listener's command or actual cwd. Renamed `next-server` process titles alone yield unknown, not mismatch. Source collector corrections are explicitly annotated in `auditNotes`, preserving the original AI report; never silently rewrite its conclusions.
- Validation: owner order, origin, listener identity, lighting bounds/map toggles, actor batch and company tests; typecheck; isolated Next build; actual owner UI follow-up execution and live report-motion capture. Production unchanged.


## Development orders in the headquarters (2026-11-15)

- Owner-only orders support `development` for JARVIS Board source work. The instruction is not replaced with a renderer prompt. The headquarters drawer shares the existing game and owner-order journal; custom follow-up instructions retain the parent report.
- `development-workspace.ts` captures a private source snapshot without runtime data, credentials or other repositories. It rejects protected infrastructure/config edits, symlinks, deletions and excessive changes. Application of reviewed files checks source hashes and never resets unrelated work.
- `development-runner.ts` executes a workspace-write developer and a separate read-only code reviewer, then tests, TypeScript and an isolated production build. Only accepted and passing candidates are applied locally. Automatic execution does not deploy or send external messages. Failures remain terminal; explicit retry can reuse a preserved candidate without another edit-model call.
- Per-order process groups, cancellation fencing, leases, bounded output/time and recorded model usage prevent silent retries and false completion. See `scripts/test-development-workspace.mjs` and owner-order contract tests.
- Source scopes are app/components/lib/contexts/hooks/styles/tests and test scripts. Authentication, data access, execution infrastructure, dependencies and deployment configuration are protected; unsupported work must be reported, not silently rerouted.

### 등록 프로젝트 지시와 직접 보고 (2026-11-15)
- `lib/company/projects.ts`: 클라이언트/서버가 공유하는 등록 프로젝트 ID·담당·검사 설명. 경로/명령을 요청 본문에서 받지 않는다.
- `project-workspace.ts`: 자비스보드와 고스톱의 고정 원본 경로, 격리 의존성 준비, 프로젝트별 지침. 고스톱은 Flutter 분석·전체 테스트·실행 번들을 검사하며 `project-write-policy.ts`가 보호 표식을 판정한다. 원문으로 확인된 v83 산출물 보존 표식은 그대로 유지하면서 소스 적용을 허용하고, 다른 보호 표식은 계속 적용을 막는다. 앱 출시 관문을 대체하지 않는다.
- `OwnerOrder.projectId`: 접수/재시도/후속 지시에서 프로젝트 보존. 기존 기록의 기본값은 자비스보드. 게임 실행 담당 ID는 고정되어 프로젝트 변경으로 캐릭터/카메라를 재생성하지 않는다.
- 이름표/상세/보고 연결은 `employeeIdentity`와 TEAM_REGISTRY의 `roleLabel`을 사용한다. 근거 없는 직급은 생성하지 않는다.
- 직원 보고는 `staffReportRoute`로 자비스의 현재 위치에 접근하고, `canHandDocument`의 거리와 장애물 검사를 통과해야 전달 단계가 된다. 길찾기 실패를 전달 성공으로 해석하지 않는다.

### 표시 전환 후 프레임 복구와 실행 결과 일관성 (2026-11-15)
- `frame-clock.ts`는 RAF를 기본으로 유지한다. 보이는 화면에서 이동·보고·실제 업무 동작이 있을 때만 50ms 확인 타이머로 지연된 화면을 복구한다. 이미 예약된 RAF를 취소·재예약하지 않아 복구가 정상 프레임을 계속 뒤로 미루지 않는다. 비활성·화면 밖·정지 상태는 추가 렌더링하지 않고 종료 시 예약을 모두 해제한다.
- 반복 키 입력도 마지막 프레임이 45ms 이상 지연된 경우 복구한다. 직원 동작을 멈춰도 주인님의 이동 애니메이션은 계속된다. 2048 정밀 그림자와 기존 모델은 유지한다.
- 고스톱 골든 PNG는 test/goldens 범위만 후보에 포함할 수 있다. PNG 자체를 UTF-8로 읽지 않고 검토 자료에 해시와 시각 검토 요구를 남긴다. 골든 갱신에는 실제 차이 근거와 별도 검토가 필요하며 비교 완화·새 skip은 금지한다.
- 검사 종료 시 최종 카운터를 반영해 마지막 주기 갱신보다 작은 숫자가 완료 화면에 남지 않게 한다. 본사 상단과 총괄 보고에 동일한 실측 카운터를 표시한다.
- 취소된 후속 실행은 새 요청으로 다시 접수할 수 있다. 같은 requestId의 재전송은 여전히 멱등 처리한다. 결과창의 선택 업무를 URL에 보존하여 새로고침·이전 보고 이동이 같은 기록을 가리킨다.

### 화질 선택과 문맥별 미전송 지시 (2026-11-15)
- `company-quality.ts`는 균형/정밀 선택을 저장·복원한다. 현재 선택을 명시하고 저장소 차단·잘못된 값은 균형 기본값으로 처리한다. 정밀 그림자는 2048을 유지한다.
- `order-drafts.ts`와 `use-order-draft.ts`는 프로젝트·업무 종류·이전 보고·조치별 초안을 분리한다. 미전송 보관과 실행 접수를 구분하며 서버 접수 성공 후에만 해당 초안을 지운다. 저장소 실패 시 페이지 메모리에서 유지하고 새로고침 한계를 표시한다.
- 늦은 접수 성공은 구독으로 다시 열린 지시창에도 반영한다. 전송 이후 수정한 내용과 다른 문맥의 초안은 지우지 않는다. 자동 프로젝트 추론이 기존 초안을 덮어쓰려 할 때 입력을 유지하고 명시적 프로젝트 선택을 안내한다.
- 지시 원장 폴링은 2초 주기를 유지하되 `retainSnapshot`으로 같은 응답의 참조를 보존한다. 실제 변경은 React 전환으로 반영하여 이동·입력을 우선한다. 검토·검사·오류 필드까지 비교하므로 변경된 결과를 숨기지 않는다. 이것만으로 브라우저 RAF 지연이 해소됐다고 판단하지 않는다.
- 공통 `SwRegister`의 설치 안내 설정도 저장소 읽기·쓰기 실패를 허용한다. 기능별 저장소 처리만으로는 루트 초기화 오류를 막을 수 없으므로 실제 컴포넌트 회귀 검사와 저장소 차단 브라우저 검증을 함께 유지한다.

### 2026-11-15 owner-flow audit

- Development review actions carry `actionKinds` alongside their display strings. Only explicit `development` actions may use automatic follow-up dispatch. `browser-check` is manual visual verification (no browser worker is registered), `verification` belongs to the existing execution checks, and `reference` is informational. Old prose-only reports cannot determine an execution capability; their original action and prior child receipts remain accessible while the owner can give an explicit modification instruction. A completed review can return zero actions. Custom follow-up index `-2` preserves its parent even when no suggested action exists.
- Empty source snapshots are not resumable candidates. Both API admission and the report UI require actual changed files. Retries count toward the existing three-per-hour development protection; this is a local limit, not the provider's remaining-token balance.
- `useOwnerOrders` versions local writes so an older in-flight GET cannot erase a POST-confirmed order. Equal fresh snapshots still retain their reference.
- Failed owner orders also project into the problem list. An explicit candidate retry replaces its parent's unresolved issue; unrelated later work does not resolve it. Historical receipts are unchanged.
- Internal `DONT_NOTIFY` heartbeats retain their source record but do not receive automatic deep review. Explicit owner review requests retain their existing priority override.
- Game keyboard handling requires game focus and excludes OS/browser modifier shortcuts, composing text, dialogs and controls. Canvas pointer input restores focus. Graphics and shadow settings are unchanged.

### Owner attention order (2026-11-15)
- The game remains primary. `JarvisBrief` puts an unresolved current issue, its actual responsible role, next action and source-linked instruction button before running work and collapsed completed reports. Historical problems stay accessible and are not promoted to current failures.
- A terminal order no longer repeats its long instruction above the game. Mobile has a compact problem/result action and a new-instruction button directly below the game; it opens the actual linked record, not an unrelated latest order.
- Rendering containment was measured in reversible A/B/A and longer repeat trials; a later 257.5ms gap disproved the initial short-run improvement, so no containment performance claim or patch was adopted.

### Headquarters meetings and owner attention (2026-11-15)
- `staff-call.ts` models an explicit owner-requested meeting separately from work execution/report receipts. It waits for an in-progress report, routes the requested employee or JARVIS to the owner's actual position, opens the live report only inside unobstructed handoff distance, and returns only on the owner's command. Failed routes never count as arrival or completion. Summoning makes no model/API execution request.
- `EmployeeReport.tsx` answers current work, current blockers, and explicit owner decisions using the existing task/issue records. Older failures remain in expandable evidence. Optional report context is shown in `OrderDesk` and included in the editable instruction only on explicit click, preserving any existing draft.
- Headquarters is the default full-width space. The owner's desk/report tray exposes the current decision, current issue, or latest execution outcome. Detailed reports open on demand; all record tabs remain accessible in the document drawer.
- Older failed owner orders remain open but use `check` until current impact is established; a later unrelated order never marks them resolved. The latest failed instruction still interrupts the owner. Explicit successful retry linkage retains the existing issue projection rules.
- `label-layout.ts` packs full label rectangles after camera/actor movement, prioritizes selected/reporting actors, clamps horizontal bounds and avoids other labels and control surfaces. A leader line ties displaced labels to their actor; hidden crowded labels remain accessible through the staff picker.

### 실제 면담·합동 회의 (2026-11-15)
- `/api/command-room/meetings`는 소유자·동일 출처만 허용한다. 질문은 서버가 읽은 실제 업무와 최근 지시를 근거로 응답하며 도구/실행 권한이 없다. 최근 6개 발화와 제한된 근거, 900 출력 토큰, 40초 제한, 원장 기반 시간당20회·24시간20000토큰 보호 한도를 적용한다. 동일 요청은 재호출하지 않으며 실패를 자동 재시도하거나 완료로 표시하지 않는다.
- `meetings.ts`는 대화·지시안·실제 주문 ID와 면담 호출 사용량을 저장한다. 질문과 실제 실행 버튼을 분리하고, 실행은 기존 `createOrder`/`executeOrder`의 등록 프로젝트 수정·독립 검토·검사·적용 경로를 사용한다. 완료 보고에 이은 실행은 같은 프로젝트 부모 보고를 보존한다. 배포는 이 경로에서 하지 않는다.
- `MeetingDesk`는 본사 위의 접을 수 있는 대화창이며 직원 면담과 합동 결과 보고를 같은 기록에서 이어간다. 별도 코드 검토 캐릭터는 실제 개발 실행기의 독립 검토 역할을 표시한다. 호출한 업무 담당은 근거 설명 참여자이지 임의 프로젝트 코드 실행 권한을 얻지 않는다.
- `staff-meeting.ts`는 최대4인의 충돌 없는 회의 위치·도착·복귀를 관리한다. 그룹 회의 중 자동 보고 동선은 대기한다. 실시간 실행은 캐릭터 도착에 종속되지 않으며, 실패한 이동은 명시하고 업무 결과는 실제 원장만 사용한다. 업무 완료/실패 시 관련 담당을 다시 호출해 결과를 확인한다.
- 연결된 업무의 완료·검토·적용 질문은 `meeting-status.ts`가 실제 주문 판정·검사·적용 필드로 직접 답한다. 새 개발 지시와 구분하고, AI 호출/토큰을 사용하지 않으며 면담 AI 보호 한도에도 포함하지 않는다. 일반 자유 질문은 제한된 AI 면담 경로를 유지한다.

### 면담의 추천 행동 (2026-11-15)
- `meeting-actions.ts`는 실행 단계와 검토자의 명시적 개발 조치를 바탕으로 질문/지시 후보를 구성한다. 후보를 선택하는 것만으로 모델 호출이나 업무 배정은 하지 않는다. 실행 중에는 원장 기반 질문만 제안하며 후속 실행은 기존 부모 업무 연결을 유지한다.
- `MeetingActions`는 회의 첫 부분에 접을 수 있는 추천 질문·지시를 제공한다. 선택 후 입력 내용을 확인하고 질문 보내기 또는 실제 배정을 누른다. 대화와 추천 이동은 면담 내부에서만 스크롤하며 헤더의 추천 버튼으로 돌아온다.
- 직원 호출 메뉴의 요약은 실제 직원의 직책·상태·업무·다음 행동을 그대로 보여준다. 이동 중 이름표가 줄어도 드롭다운으로 확인할 수 있으며 회의 도착을 실행 완료로 표현하지 않는다.

### Meeting continuity and report context (2026-11-15)

`MeetingDesk` binds report discussions to an explicit project/order. `meeting-drafts.ts` saves unsent question/instruction, selected project, original meeting and dispatch request IDs in browser storage. Recovery of a committed request never starts another job; conflicting report contexts require an explicit return to the original interview. `beginInterview` validates the expected order inside its SQLite write transaction, after asynchronous evidence reads. The game remains the main surface; meeting results precede collapsible suggestions.

`order-budget.ts` reserves at most six development model calls per rolling hour: fresh development reserves two, a valid preserved-candidate review reserves one. Failed/cancelled reservations are not refunded, active work still blocks overlapping dispatch, and no automatic retry was added. Other task-kind limits are unchanged.

### Owner-visible deployment evidence (2026-11-15)
- `deployment.ts` projects completion, inclusion and external verification separately. A green external state requires accepted/applied work, the same order revision and candidate hash, the running build manifest, and a matching external receipt. Rollback, manifest mismatch and failed verification cannot inherit success. Other projects are explicitly unconnected.
- `deployment-store.ts` reads host-only manifests/receipts. `/api/command-room/deployment` is owner-authenticated and read-only; no browser API writes deployment evidence. Order reads and source-only meeting answers use the same evidence.
- `scripts/company-release.py capture --order <id> --review <inclusion review>` records reviewed order inclusion and source fingerprints before building. `prepare --release <name>` rejects source drift, packages compiled artifacts and binds their hashes. The existing host promotion runs `verify`, which checks the authenticated external release identity, first game page, JS asset and anonymous denial before writing an atomic receipt. Failure triggers the promotion rollback. Never infer inclusion for all completed jobs.
- The owner sees three short stages, a compact outcome and an explicit external-site link only after verification. Forms/history/evidence are disclosed on demand. `textarea-hint.ts` accepts visible empty-field hints with unmodified →/Tab, respects IME and existing input, and uses the normal persisted draft writers without dispatching.

### Persistent meeting actions (2026-11-15)
The meeting panel now has a non-scrolling header and one action dock (report/question/next instruction), with one scrollable body showing only the selected activity. Switching preserves both drafts and never sends; explicit ask/execute retain the existing idempotency and parent-order rules. Report evidence remains expandable. Active-work posture and rings use the existing live work flag, with no synthetic walking or completion.
