# codeLinc 11: Path 1 vs Path 2, and Project Ideas

Coding started at 1:30 PM Saturday and presentations are at 10:00 AM Sunday, so there are about 18 hours of build time. This document is about **what to build and what to build it with** (frontend, backend, data, LLM). Which AI coding assistant you use is a separate decision. AWS and IBM tools are optional, and every stack below works with any LLM provider.

---

## 1. Path 1 vs Path 2

| | **Path 1: Dental Benefits Optimizer** | **Path 2: Life Insurance Needs Analyzer** |
|---|---|---|
| **The ask** | Describe a procedure and your plan → get a plain-English breakdown of what's covered and what you'll owe → **spread care across the plan year** to get the most from your benefits | A **conversational** AI that asks about your dependents, income, debts and current coverage → gives a personal needs assessment with its reasoning → explains the math **without causing anxiety** |
| **Extras** | Track annual max used, compare in-network vs out-of-network, remind people about unused benefits | Explain term vs whole life, and show the tradeoffs for the user's own situation |
| **What it really is** | Data, rules and calculations, plus scheduling or optimization | Conversation design and UX, plus fairly simple finance math |
| **Hardest part** | Insurance rules (coverage tiers like 100/80/50, deductibles, annual max, frequency limits, waiting periods), getting cost data, the sequencing logic | Tone, trust, making the reasoning clear, guiding the chat without it feeling like a form |
| **Data** | Given: a reference site, an enrollment video, and FAIR Health cost estimates | Mostly user input. The formulas are standard (DIME method, income replacement) |
| **Room to stand out** | **High.** Sequencing and plan comparison are real optimization problems | **Medium.** The core is easy to build, so you win on polish, visuals and explanation |
| **Risk** | Too much scope. It's easy to get lost modeling plan rules | Ending up as "just a chatbot wrapper" |
| **Demo** | Before/after savings in dollars ("this saves you $640") is very convincing | An emotional, human story. Calm UX is easy to show |

**Bottom line:** Path 1 rewards **engineering, data and math** skills. Path 2 rewards **UX, conversation design and communication** skills. Path 1's title also says "Benefits **Selection** Process", so helping people pick a plan at enrollment is in scope too.

---

## 2. Project ideas (3 per path)

Each idea is a complete product, not a single feature. Pick **one** and build it well.

### Path 1: Dental

#### Idea 1A: "What Will I Owe?" Dental Cost Copilot
*The most direct answer to the challenge, and the easiest to finish.*
- **Pitch:** Type "I need a crown on a back molar." The app explains in plain English what the plan covers and what you'll pay.
- **Features:**
  - Plan setup: a short form (deductible, annual max, coinsurance by category, network) or a picker of sample plans
  - Plain-English procedure input. The LLM maps it to a procedure code (CDT code) and category (preventive, basic or major)
  - A cost breakdown card: typical cost (from a hand-built FAIR Health table) → deductible → coinsurance → annual max cap → **"Plan pays $X, you pay $Y"**
  - An "insurance jargon" translator: hover any term for a one-line definition
  - **Extra:** in-network vs out-of-network shown side by side
- **Stack:** Next.js (React + TypeScript) with Tailwind and shadcn/ui. The backend is Next.js API routes, so the whole app is one codebase in one language. Data is a JSON file of about 20 common procedures. The LLM is called through the Vercel AI SDK, which works with any provider.
- **Best fit:** Teams comfortable with JavaScript/TypeScript and web development.

#### Idea 1B: Plan-Year Care Planner
*The strongest differentiator. Shows real optimization, not just a chatbot.*
- **Pitch:** "Your dentist recommends 4 procedures. Here's when to do each one so your plan pays the most."
- **Features:**
  - Enter a treatment plan (for example: 2 fillings, 1 crown, 1 root canal, cleanings)
  - An optimizer schedules care around the annual max and the January reset, respecting waiting periods, frequency limits and urgency (some care can't wait)
  - A timeline view with a **"you save $X vs doing everything now"** banner
  - **Extras:** an annual-max tracker gauge and end-of-year reminders (download a calendar file, `.ics`)
  - The LLM explains the schedule ("We moved the crown to January because...")
- **Stack:** React (Vite) with Tailwind and Recharts for the frontend. Python FastAPI for the backend, with `PuLP` or `OR-Tools` for the optimizer (or a simple greedy rule if time is short). SQLite to save plans. The LLM is called through the provider's Python SDK.
- **Best fit:** Teams with a math, stats or optimization person plus someone comfortable in Python.

#### Idea 1C: Enrollment Plan Picker
*Targets the "Selection Process" wording that many teams will ignore.*
- **Pitch:** "Low PPO, high PPO or HMO? Tell us about your family and we'll show which plan costs you the least."
- **Features:**
  - Upload or select 2–3 plan summaries. Optionally extract plan details from a PDF
  - Short questionnaire: family size, expected care, dental history, risk tolerance
  - A Monte Carlo simulation of a year of dental costs for each plan, giving expected cost, best case and worst case
  - A distribution chart plus the verdict: "Plan B saves you about $210 on average"
  - The LLM translates each plan's fine print into plain English
- **Stack (fastest):** Streamlit, all in Python, with NumPy and Plotly, and `pdfplumber` for PDFs. **Stack (more polished):** React with a FastAPI backend that serves the simulation.
- **Best fit:** Python/stats-heavy teams with less frontend experience.

### Path 2: Life Insurance

#### Idea 2A: Coverage Coach (chat with a live profile panel)
*The most direct answer to the challenge.*
- **Pitch:** A calm, guided conversation that builds your picture as you talk, then shows how much coverage you need and why.
- **Features:**
  - Split screen: chat on the left, a **"What I know so far"** panel on the right that fills in live (dependents, income, mortgage, debts, education goals, existing coverage, budget) and that the user can edit
  - A deterministic needs calculation (DIME or income replacement) gives a **range**, not one scary number
  - A **waterfall chart**: total need minus existing coverage equals the gap, with a short reason for each step
  - Calm-tone rules: no death-focused wording, and a "why we ask" note on every question
  - **Extra:** a term vs whole life explanation using the user's own numbers
- **Stack:** Next.js with Tailwind and shadcn/ui. The Vercel AI SDK handles chat streaming and **structured output** (a Zod schema the LLM fills as the user talks). The calculation is a TypeScript module. Charts use Recharts. No database is needed, since everything stays in the session.
- **Best fit:** Teams strong in frontend/UX and comfortable with prompt design.

#### Idea 2B: Coverage Timeline Studio
*The best visual demo. Makes term vs permanent obvious at a glance.*
- **Pitch:** "Your need for coverage changes over time. Here's what that looks like for you."
- **Features:**
  - A short guided intake (chat or a 5-step wizard)
  - A **coverage-over-time chart**: need falls as the mortgage is paid down and the kids grow up. A term policy is a flat line that ends; a permanent policy is a line that keeps going
  - What-if sliders ("pay off the mortgage early", "add a second child", "raise in 3 years") that update the chart live
  - A recommended term length (for example, until the youngest turns 22 or the mortgage ends)
  - The LLM writes a personalized summary of the tradeoffs
- **Stack:** React (Vite) with Tailwind, and Recharts or D3 for the timeline. The calculation runs in TypeScript in the browser, so sliders update instantly. A small FastAPI or Express backend only forwards LLM calls, which keeps the API key off the client.
- **Best fit:** Teams strong in data visualization. Comfortable with math, but want a polished UI.

#### Idea 2C: Mobile, Voice-First Life Coach
*Stands out on accessibility and reach.*
- **Pitch:** Talk to it like a person, in English or Spanish, on your phone. It ends with a summary you can take to an advisor.
- **Features:**
  - A mobile chat with voice input and spoken replies
  - English and Spanish
  - The same needs calculation and result card as 2A, adapted for a small screen
  - **Life-event check-ins:** "I just had a baby" reopens the analysis and shows how the gap changed
  - A one-tap **advisor handoff PDF** summarizing the situation, needs and open questions
- **Stack:** React Native with Expo (or Flutter). Speech via `expo-speech` plus a speech-to-text API (for example, Whisper), or test it as a web app using the browser's Web Speech API. A FastAPI or Express backend for LLM calls and PDF generation (WeasyPrint or `pdfkit`).
- **Best fit:** Teams with mobile experience. The highest risk of the three: voice adds failure points during a live demo.

---

## 3. Feature comparison

| | **1A Cost Copilot** | **1B Care Planner** | **1C Plan Picker** | **2A Coverage Coach** | **2B Timeline Studio** | **2C Mobile Voice Coach** |
|---|---|---|---|---|---|---|
| Core requirements covered | All 3 (sequencing is light) | All 3 | 2 of 3 (sequencing is light) | All 3 | All 3 | All 3 |
| Extras covered | In-network vs out-of-network | Max tracker, reminders | none directly | Term vs whole life | Term vs whole life plus tradeoffs | Term vs whole life |
| Conversational AI | Medium | Low | Low | **High** | Medium | **High** |
| Math / modeling depth | Low | **High** | **High** | Low–Medium | Medium | Low–Medium |
| Visual "wow" | Medium | High (timeline + $ saved) | High (distributions) | Medium–High (waterfall) | **Highest** | Medium |
| Difficulty | **Easiest** | Hard | Medium | Easy–Medium | Medium | Hardest |
| Demo risk | Low | Medium | Low | Low | Low | **High** (voice, device) |

## 4. Stack comparison

| | **Frontend** | **Backend** | **Data / storage** | **Key libraries** | **Languages** |
|---|---|---|---|---|---|
| **1A** | Next.js + Tailwind + shadcn/ui | Next.js API routes | JSON procedure-cost table | Vercel AI SDK | TypeScript only |
| **1B** | React (Vite) + Tailwind + Recharts | FastAPI | SQLite | PuLP / OR-Tools | TypeScript + Python |
| **1C** | Streamlit (or React) | Python (Streamlit) or FastAPI | JSON plan files, uploaded PDFs | NumPy, Plotly, pdfplumber | Python only (fast path) |
| **2A** | Next.js + Tailwind + shadcn/ui | Next.js API routes | None (session only) | Vercel AI SDK, Zod, Recharts | TypeScript only |
| **2B** | React (Vite) + Tailwind + Recharts/D3 | Thin FastAPI or Express proxy | None (session only) | Recharts or D3 | TypeScript (+ a little Python) |
| **2C** | React Native (Expo) or Flutter | FastAPI or Express | None, or SQLite for check-ins | expo-speech, speech-to-text API, WeasyPrint | TypeScript or Dart + Python |

### How to choose a stack

- **All-TypeScript (Next.js):** One codebase, one language, fast deployment to Vercel. Best when most of the team knows JavaScript.
- **React + FastAPI:** Splits cleanly into frontend and backend work for 5 people. Best when you need Python for math (optimization, simulation).
- **Streamlit:** A working UI in under an hour, but limited design control. Best when the team is mostly Python/data people.
- **React Native / Flutter:** Only if someone has shipped a mobile app before. Otherwise build a mobile-friendly web app instead.
- **LLM provider:** Any of them works (Claude, OpenAI, Gemini, or a local model through Ollama). Use whichever your team already has a key for. Pick a provider that supports **structured output / tool calling**, since every idea relies on it.

### Rules that apply to every idea

- **The LLM never does the math.** Use it to understand input and explain results. Keep calculations in tested code. The judges work in insurance and will check your numbers.
- **Show your assumptions** and add an "estimate, not a guarantee" disclaimer.
- **Don't store personal data.** Keep everything in the session.
- **FAIR Health is a website, not an API.** Look up about 20 common procedures by hand and save them as JSON.

---

## 5. Matching ideas to your team

| If your team's strength is... | Choose |
|---|---|
| Web development (JavaScript/TypeScript), want the safest finish | **1A** or **2A** |
| Math, stats or optimization plus Python | **1B** or **1C** |
| Data visualization and polished UI | **2B** |
| Conversation design, writing, UX | **2A** |
| Mobile development | **2C** |

### Roles for 5 people

1. **Frontend/UX:** screens, components, overall look
2. **AI/LLM:** prompts, structured output, tone guardrails
3. **Calculation engine and data:** the math, the cost/plan data, tests that prove the numbers are right
4. **Backend and integration:** API, connecting frontend to backend, deployment
5. **Product, research and pitch:** learns the insurance rules, writes the demo script and README, tests everything as a user

### Timeline

Settle scope by 2:30 PM. Get a working end-to-end demo by about 10 PM. Add features overnight. Freeze code around 7 AM. Rehearse the demo and finish the README before 10 AM.

---

## 6. Recommendation

- **Strong in math/stats and Python → Idea 1B (Care Planner).** It's the hardest to copy, and a "$ saved" number makes a strong demo. If the optimizer falls behind schedule, fall back to a simple greedy rule.
- **Strong in web development and UX → Idea 2B (Timeline Studio),** with 2A's chat as the intake. The coverage-over-time chart explains term vs permanent better than any paragraph.
- **Want the safest finish → Idea 1A or 2A.** All TypeScript, fewest moving parts, and enough time left to polish.
