# codeLinc 11: Path 1 vs Path 2, and Project Ideas

Coding started at 1:30 PM Saturday and presentations are at 10:00 AM Sunday, so there are about 18 hours of build time.

---

## 1. Path 1 vs Path 2

| | **Path 1: Dental Benefits Optimizer** | **Path 2: Life Insurance Needs Analyzer** |
|---|---|---|
| **The ask** | Describe a procedure and your plan → get a plain-English breakdown of what's covered and what you'll owe → **spread care across the plan year** to get the most from your benefits | A **conversational** AI that asks about your dependents, income, debts and current coverage → gives a personal needs assessment with its reasoning → explains the math **without causing anxiety** |
| **Extras** | Track annual max used, compare in-network vs out-of-network, remind people about unused benefits | Explain term vs whole life, and show the tradeoffs for the user's own situation |
| **What it really is** | Data, rules and calculations, plus scheduling or optimization | Conversation design and UX, plus fairly simple finance math |
| **Hardest part** | Insurance rules (coverage tiers like 100/80/50, deductibles, annual max, frequency limits, waiting periods), getting cost data, the sequencing logic | Tone, trust, making the reasoning clear, guiding the chat without it feeling like a form |
| **Data** | Given: a reference site, an enrollment video, and FAIR Health cost estimates | Mostly user input. The formulas are standard (DIME method, income replacement) |
| **Room to stand out** | **High.** Sequencing and plan comparison are real optimization problems, and there are three extras you can visibly check off | **Medium.** The core is easy to build, so most teams will look alike. You win on polish, visuals and explanation |
| **Risk** | Too much scope. It's easy to get lost modeling plan rules | Ending up as "just a ChatGPT wrapper" |
| **Demo** | Before/after savings in dollars ("this saves you $640") is very convincing | An emotional, human story. Calm UX is easy to show |

**Bottom line:** Path 1 rewards **engineering, data and math** skills. Path 2 rewards **UX, conversation design and communication** skills. Path 1's title also says "Benefits **Selection** Process", which suggests that helping people pick a plan at enrollment is in scope. Many teams will skip that, which makes it a good place to stand out.

---

## 2. Matching paths to your team

Each person should quickly rate themselves on these. Wherever most of your strength sits is your path.

| Skill | Points to |
|---|---|
| Stats, optimization, modeling (Monte Carlo, linear programming, expected value) | **Path 1** |
| Parsing documents or PDFs, data wrangling, backend rule engines | **Path 1** |
| Dashboards and data visualization | Both (slightly more Path 1) |
| Frontend, UX, product design | **Path 2** |
| Prompt engineering, conversation flows, LLM agents | **Path 2** |
| Writing and storytelling, finance or insurance knowledge | **Path 2** |
| Mobile development | Either (a mobile-first Path 2 chat works well) |

### Roles for 5 people (either path)

1. **Frontend/UX**
2. **AI/agent** (prompts, tool calling, guardrails)
3. **Calculation engine and data** (the math person; owns accuracy)
4. **Integration and deployment** (AWS, API, glue code)
5. **Product, research and pitch:** researches the plan rules and reference material, writes the demo script and README, and tests everything

---

## 3. Project ideas

### Path 1: Dental

#### ① Coverage Explainer: "What will I owe?" *(core requirement, must build)*
- **Features:** The user types something like "I need a crown on a back molar." The LLM matches that to a dental procedure code (CDT code) and its category (preventive, basic or major). A lookup gives the cost from FAIR Health. A **deterministic** calculator applies the deductible, coinsurance and remaining annual max, and returns "Plan pays $X, you pay $Y" with a plain-English explanation. Plan details can be entered in a form or pulled from an uploaded benefits summary (SBC) PDF.
- **Stack:** React or Next.js with Tailwind, a FastAPI backend, Claude on Amazon Bedrock with tool calling (the LLM calls your `calculate_cost()` function), and a JSON table of about 20 common CDT codes with FAIR Health prices you look up by hand. Optional: Amazon Textract or `pdfplumber` to extract plan details from a PDF.
- **Note:** FAIR Health is a consumer website, not an API. Seed a small table by hand rather than scraping it.

#### ② Plan-Year Care Sequencer *(core requirement and your strongest differentiator)*
- **Features:** Take a treatment plan (for example: 2 fillings, 1 crown, 1 root canal, cleanings) and schedule it around the annual maximum and the January reset, respecting waiting periods and frequency limits (such as 2 cleanings per year). Show a timeline and a "you save $X vs doing everything now" number.
- **Stack:** Greedy scheduling, or a small integer program with `PuLP` or `OR-Tools`, and a timeline chart in Recharts or Plotly.
- **Best for:** A math or stats person. Use deterministic code; don't let the LLM do the math.

#### ③ Plan Chooser at Enrollment *(ties directly to "Selection Process")*
- **Features:** Compare plan options (for example, a low and a high PPO, or an HMO-style DHMO) based on expected care, family size and risk tolerance. A Monte Carlo simulation gives the expected yearly cost plus a worst case for each plan. Output reads like "Plan B saves you about $210 on average."
- **Stack:** NumPy simulation and a distribution chart.
- **Best for:** A stats-heavy team.

#### ④ Benefits Wallet with Reminders *(covers extras 1 and 3)*
- **Features:** A gauge for annual max used vs remaining and progress toward the deductible. Log a visit or upload an Explanation of Benefits (EOB) to update it. In October or November, a nudge like "You have $1,100 unused, so book your cleaning before Dec 31."
- **Stack:** DynamoDB or SQLite, plus EventBridge Scheduler and SNS for email or text, or simply a downloadable `.ics` calendar reminder (the cheapest option to demo).

#### ⑤ In-Network vs Out-of-Network Comparator *(covers extra 2)*
- **Features:** Compare the negotiated (in-network) rate with out-of-network charges, including the extra amount an out-of-network dentist can bill you, side by side for the same procedure. Optionally add a dentist map using mock data.

**Recommended Path 1 scope:** Build ① and ② as the core. Add ④'s tracker gauge and reminder as a quick win. Add ③ or ⑤ only if you're ahead of schedule by about 3 AM.

### Path 2: Life Insurance

#### ⑥ Guided Conversational Needs Analyzer *(core requirement, must build)*
- **Features:** A chat that fills in a structured profile as it goes (dependents and their ages, income, mortgage and debts, education goals, employer coverage, budget). Show a side panel with "what I know so far" that the user can edit. A deterministic DIME or income-replacement calculation produces the coverage gap. The result is shown as a **waterfall chart** (needs minus existing coverage equals the gap), with a short reason for each step.
- **Stack:** Next.js with the Vercel AI SDK or a FastAPI backend, Claude on Bedrock using structured output or tool calls to fill the profile, a Python or TypeScript calculation module, and Recharts.
- **Anxiety guardrails:** A system prompt that sets a calm tone. Avoid death-focused wording ("protecting your family's plans"). Show a **range**, not one scary number. Add a "why we ask" tooltip on every question.

#### ⑦ Coverage-Over-Time Visualizer *(covers the term vs whole life extra in a visual way)*
- **Features:** A chart of need over time, which falls as the mortgage is paid down and the kids grow up, with a term policy as a flat line that ends and a permanent policy as a line that keeps going. It shows the tradeoff for the user's own numbers. Add what-if sliders ("what if you pay off the mortgage early?"). Recommend a term length (for example, until the youngest child turns 22 or the mortgage ends).
- **Best for:** Teams strong in data visualization. This is the most impressive thing you can show in a Path 2 demo.

#### ⑧ Voice-First and Multilingual Version
- **Features:** Talk instead of type, with Spanish support, aimed at underserved users.
- **Stack:** The browser's built-in Web Speech API (free and fast), or Amazon Transcribe and Polly.

#### ⑨ Life-Event Check-ins
- **Features:** "I just had a baby" or "I bought a house" reopens the analysis and shows how the coverage gap changed. This fits Lincoln's workplace benefits business well (adjusting employer coverage during the year).

#### ⑩ Advisor Handoff Summary
- **Features:** A one-click PDF summary of the user's situation, needs and questions to bring to an agent.
- **Stack:** `react-pdf` or WeasyPrint.

**Recommended Path 2 scope:** Build ⑥ and ⑦ as the core and add ⑩ as polish. Add ⑧ only if someone on the team has done speech work before.

---

## 4. Shared stack and tips

- **LLM:** **Claude on Amazon Bedrock.** AWS is a sponsor and gave a talk, so it fits the event. Build the agent with **Strands Agents** or LangGraph and optionally deploy it on **AgentCore Runtime**.
- **AWS costs:** There are **no event-provided AWS credits**. Create your own account (new accounts get $100 in free credits), set a $0 budget alert, and shut resources down after the demo. If AWS setup slows you down, use any LLM API and run locally.
- **Fastest frontend option:** If your team is mostly Python, use **Streamlit**. You'll have a working UI in an hour, but it will look less polished than React.
- **AI coding tools:** Kiro is free for students for a year (kiro.dev/students). Its spec-driven mode produces requirements, design and task files, and the slides point out these **double as judging documentation**. IBM Bob also has a trial.
- **The most important design rule:** **The LLM never does the math.** Use the LLM to understand input and explain results, and keep all calculations in tested code. The judges work in insurance and will check your numbers. Say this in your pitch.
- **Compliance touches judges will notice:** an "estimate, not a guarantee" disclaimer, no storing of personal data (keep it in the session only), and showing every assumption.
- **Timeline:** Settle scope by 2:30 PM. Get a working end-to-end demo by about 10 PM. Add features overnight. Freeze code around 7 AM. Rehearse the demo and finish the README before 10 AM.

---

## 5. Recommendation

- **If you have at least one strong math or stats person and one solid backend developer, choose Path 1 (① + ② + ④).** It offers the most ways to stand out, the sequencing and plan-choice ideas are real technical work, and a "$ saved" number makes a strong demo.
- **If your team is strongest in frontend, design and communication, choose Path 2 (⑥ + ⑦).** The calm conversation plus the coverage-over-time chart can beat a technically stronger team whose demo is less clear.
