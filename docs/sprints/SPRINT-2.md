# Sprint 2: family profiles, notifications, providers, reports, tests

Scrum master and orchestrator: Claude (this session). Product owner: Caleb. Started 2026-10-04. Branch: `sprint/family-providers-reports` (off `feature/choose-a-plan`; **not merged to `main`, which is production**). The sprint is complete only when every story below meets its definition of done and the verification at the end passes.

## Sprint goal
Turn the demo into something that feels like a real insurance portal: families can edit their own profiles and contact details, get notified, find dentists near them, see which dentist a quote came from, and keep and understand their claims and explanations of benefits (EOBs).

## Backlog from the product owner's notes (priority order)
| # | Story | Size | Owner roles |
|---|---|---|---|
| 1 | **Bug:** "Log a visit for..." on Home shows `$NaN` | S | frontend (+backend if the response shape is wrong), tests |
| 2 | **Enlarge the chatbot box.** Too much white space | S | frontend |
| 3 | **Unit test suite** (pytest: bugs, new features) | M | tests |
| 4 | **Edit family, members and profiles:** DOB, email, SMS number, other info; add and edit family members on the Family page | M | backend, frontend, tests, docs |
| 5 | **Notifications:** text, email and an in-app tab or button, in addition to remaining benefits and upcoming appointments or procedures on the dashboard | L | backend, frontend, tests, docs |
| 6 | **Find Providers page:** synthetic dentists near me, in network and out of network | L | backend, frontend, tests, docs |
| 7 | **Synthetic dentist quote** to test, and show **which dentist** a quote refers to (from the insurance directory) | M | backend, frontend, tests, docs |
| 8 | **Reports page:** explain claims, explain EOBs, explain copay and cost breakdown, upload (synthetic) and save past claims, EOBs and what I owe in chronological order, and a **separate page to ask the assistant about them** | XL | backend, ai, frontend, tests, docs |

## Decisions and assumptions (made by the scrum master; the product owner can overrule)
- **No real email or SMS is sent.** Notifications are real in the app (bell, page, preferences). Email and text are written to a **delivery preview log** ("Email preview, not sent"). A `Notifier` interface leaves a clean place to plug in a real sender (for example Amazon SES or Twilio) later.
- **"Near me" = a ZIP code** (typed, or the member's profile ZIP), not GPS. Provider data is synthetic and uses a small table of real ZIP centroids (public facts) for distance.
- **Uploads accept synthetic sample documents only** (plain text in our sample template). There is no PDF text extraction. Every upload area also offers one-tap "Add a sample" cards. A clear notice says not to upload real records.
- **Profile fields are personal data in a public demo.** Show "Use made-up contact details. Nothing is sent." Validate formats; never log them; they are removed with the demo family (24 h expiry).
- **Family edits (profile, add and remove members) only work in a visitor's own demo family**, never in the shared template, same rule as "Name your family".
- All money figures come from the engine or from stored synthetic document data; the browser and the model never do money math. Estimate disclaimer stays on every result.
- Every story ships with its own tests; the test story adds the shared suite structure and regression coverage.

## Sequencing (waves; backend work is serial because stories share `db/store.py`, `models.py` and `main.py`)
| Wave | Backend | Frontend | Tests / docs |
|---|---|---|---|
| 1 | **B1** profile fields and family member API | **F1** fix `$NaN` (Home) and **F2** enlarge chatbot | **T1** pytest suite foundation (markers, structure, coverage, CI) |
| 2 | **B2** notifications and preferences | **F3** Family edit UI (profile, add member) | |
| 3 | **B3** providers directory and search | **F4** notifications bell, page and settings | |
| 4 | **B4** reports (claims, EOBs, samples, explain) and quote to provider matching | **F5** Find Providers page | |
| 5 | **A1** assistant: reports Q&A tool and scope | **F6** quote provider display and **F7** Reports pages and report Q&A page | |
| 6 | Hardening fixes from review | | **T2** regression and feature test consolidation, **D1** docs, **R1** review |

## Contracts (all routes need the bearer token and follow the existing visibility rules: a primary sees everyone in the household, an adult only themself, managed members have no login)

### B1 profiles and family members
- Migration `005_profiles.sql`: `members` gains `dob` (date), `email`, `phone`, `zip`, `notes` (max 200 chars), `primary_dentist_id` (nullable, filled in wave 3). Age is derived from `dob` using the demo clock (`DEMO_TODAY`); keep the existing `age` column in sync. Seeds get synthetic values (emails at `example.test`, phones in the 555-01xx range, ZIPs near Auburn AL and similar). The sandbox clone copies the new columns.
- `PATCH /members/{id}/profile` body `{name?, dob?, email?, phone?, zip?, notes?}`. Primary may edit anyone in the household; an adult only themself. **Demo family only** (403 for the shared template household). Validation: name like "Name your family" (letters, spaces, apostrophes, hyphens, periods, 1 to 24); `dob` ISO date, not in the future, age 0 to 110; `email` valid format, max 80; `phone` 10 to 15 digits after stripping punctuation; `zip` 5 digits; `notes` max 200 with no angle brackets. Changing `dob` across the 18 boundary updates eligibility rules (adult can have a login, managed members cannot) and returns a plain message if a change is not allowed.
- `POST /households/{id}/members` body `{name, relationship: spouse|partner|child|other, dob, email?, phone?, zip?}` (primary only, demo family only, max 8 members) creates a member (under 18 managed, otherwise adult without a login, status active) with zeroed usage; returns the member.
- `DELETE /households/{id}/members/{member_id}` (primary only, never the primary, demo family only) removes the member and every dependent row.
- All profile fields appear on `GET /households/{id}` members (visible to those who may see the member) and in the assistant context and overview as appropriate (contact details are **not** sent to the model).

### B2 notifications
- Tables `notification_prefs(member_id, app, email, sms, types_json)`, `notifications(id, member_id, kind, title, body, severity, link, dedupe_key unique per member, created_at, read_at)`, `outbox(id, member_id, channel, to_address, subject, body, created_at, status)` where status is always `preview` (never sent).
- Kinds: `benefits_expiring` (yearly maximum left and plan year ending soon, amounts from the benefits engine), `preventive_unused` (cleanings or exams left), `upcoming_appointment` (within 14 days of the demo clock), `procedure_planned`, `deductible_met`, `claim_update` and `eob_ready` (wave 4). Generated deterministically from the member's data, idempotent through `dedupe_key`.
- `GET /members/{id}/notifications?unread=1` (generates, then lists newest first, with an `unread_count`), `POST /members/{id}/notifications/{nid}/read`, `POST /members/{id}/notifications/read-all`, `GET/PUT /members/{id}/notification-prefs` (app on by default; email and sms off until the member has a valid contact and turns them on), `POST /members/{id}/notifications/test {channel}` creates a preview, `GET /members/{id}/outbox` lists previews. When a new notification is generated and email or sms is enabled, a preview row is written (to the member's stored contact). `Notifier` interface with the default `PreviewNotifier`.

### B3 providers
- Tables `providers` (synthetic: id, practice name, dentist name, specialty `general|pediatric|orthodontics|oral_surgery|endodontics|periodontics`, address, city, state, zip, lat, lon, phone, accepting_new, languages, `network_plan_ids` json) and `zip_centroids(zip, city, state, lat, lon)`. About 30 providers across areas near Auburn AL, Atlanta GA, Radnor PA, Fort Wayne IN and Greensboro NC, a mix of in network and out of network per plan tier; seeds in `database/seeds/providers.json` (clearly fictional practice and dentist names).
- `GET /providers?zip=&radius_mi=25&network=all|in|out&specialty=&accepting=&q=&code=&member_id=` returns providers sorted by distance with `distance_mi`, `in_network` for the household's current plan, and, when `code` (a procedure code) and `member_id` are given, an `estimate` with the engine's `you_pay` and `plan_pays` (in or out of network as applicable, plus balance billing for out of network). Missing `zip` uses the member's profile ZIP; unknown ZIP gives 422 with a plain message. `GET /providers/{id}`. `PATCH /members/{id}/profile` accepts `primary_dentist_id`.

### B4 reports and quote matching
- Tables `report_items(id, member_id, kind claim|eob|copay|other, service_date, title, provider_id?, provider_name, code, description, data_json, paid_status unpaid|paid|not_applicable, created_at)`. Structured fields in `data_json`: for a claim `{claim_number, billed, status}`; for an EOB `{eob_number, claim_number, billed, allowed, deductible_applied, plan_paid, coinsurance_amount, you_owe, balance_billing, remark}`; all amounts stored as given by the (synthetic) document, never recomputed by the model.
- `GET /reports/samples` lists synthetic sample documents (a paid claim, an EOB with a deductible, an out-of-network EOB with balance billing, a denied claim, a copay-style visit) each with `title`, `text` and `kind`. `POST /members/{id}/reports/samples/{sample_id}` adds one. `POST /members/{id}/reports/upload?kind=&filename=` takes a raw text body (max 20 KB, content type `text/plain`) in the sample template (`Key: Value` lines starting with the line `MOLAR MONEY SAMPLE DOCUMENT`); anything else gets 422 "Demo accepts the sample documents only." Max 100 items per member.
- `GET /members/{id}/reports?kind=&from=&to=` newest or oldest first (`order=asc|desc`, default chronological ascending by service date) with `totals {billed, allowed, plan_paid, you_paid, you_owe_open}` computed in code from the stored values, `GET /members/{id}/reports/{id}`, `GET /members/{id}/reports/{id}/explain` (deterministic plain-language explanation built in code from the fields: what the document is, each line in words, a billed to allowed to deductible to plan paid to you owe breakdown as ordered steps with amounts, what to do next, and a note when out-of-network balance billing applies), `POST .../mark-paid`, `DELETE`.
- Seeds: synthetic reports for the Alex demo member consistent with his visit history (a cleaning, a filling and an extraction).
- **Quote matching:** `POST /treatment-plan/parse` response gains `provider_match` (`{matched: bool, provider_id?, name?, dentist?, address?, in_network?, network_note, source: "insurer directory"}`) found by matching the quote's header (practice name, phone, ZIP) against the providers table; when `matched` is false, say so and price out of network. New `GET /treatment-plan/samples` returns synthetic dentist quotes (an in-network practice, an out-of-network practice, one unknown practice) with headers that match the directory.

### A1 assistant for reports
`POST /chat` accepts `scope: "reports"`; tools `get_reports(kind?, from?, to?)` and `explain_report(id)` return stored values and the explanation built in code; the model only rephrases and every amount must come from tool results (number guard applies). Suggestions for the reports page: "What do I owe right now?", "Explain my last EOB", "Why was this claim denied?", "Which visits are still unpaid?". The assistant never receives email or phone numbers.

## Definition of done (every story)
Code plus its own tests, `pytest -q` and `ruff check` clean, frontend `typecheck`, `test`, `build` clean, no money math in the browser, accessible and phone friendly (375 px, 44 px targets, 16 px inputs), plain language, disclaimer shown, docs updated, no secrets, no real personal data. The orchestrator verifies each wave itself (tests, plus the live app).

## Progress (updated by the scrum master)
See the table at the bottom of this file; each wave records what shipped, what was verified and what was found.

### Log
- 2026-10-04: sprint planned; wave 1 started.
