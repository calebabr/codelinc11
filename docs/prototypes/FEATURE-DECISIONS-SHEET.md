# Feature Decisions: what to keep from each prototype

Fill this in, then we plan how to combine the chosen features into one product. All four prototypes stay preserved either way.

**How to fill it in:** in the **Decision** column type one word:

- **Keep**: put this feature in the main product
- **Rebuild**: keep the idea but build it again properly in the main product
- **Skip**: leave it out
- **Maybe**: undecided

Use **Notes** for anything you want changed ("make it match the new theme", "only the chart part").
"Also in" shows other prototypes that have a version of the same feature, so you can say which version you prefer.

Prototype owners: **Caleb** (`proto/dental-prototype`) · **Wrigley** (on `main`, from PR #3) · **Sai** (`prototype/sai-benefits-portal`) · **Ulisses** (navigation shell on `main`; landing and login page not pushed yet)

---

## A. Big decisions first

These shape everything else. Mark one option in each.

| # | Question | Options | Your choice |
|---|---|---|---|
| 1 | Does the product serve one person or a whole family? | One person · Family profiles (Wrigley/Sai) | |
| 2 | Login | None (demo plan only) · Mock login (pick a demo member) · Real login | |
| 3 | Which chat engine? | Local Ollama model (Caleb) · Cloud AI model, needs a paid key (Sai) · Simple keyword answers (Wrigley) · Local plus a cloud option | |
| 4 | Page structure and navigation | Ulisses's nav (Home, Dashboard, My Coverage, Estimate, Plan My Year, Chatbot, Profiles) · Caleb's tabs · A new structure | |
| 5 | Visual theme | Ulisses's editorial theme · Caleb's current look · Sai's portal look | |
| 6 | How many plans does the product offer? | One demo plan · Two plans · Three tiers with comparison | |
| 7 | Data | Keep placeholder numbers for now · Team fills in real plan values and fees | |

---

## B. Caleb's prototype

| Feature | What it does | Also in | Decision | Notes |
|---|---|---|---|---|
| Landing page | Welcome page with "Get started" and "Try the demo plan" | Sai, Ulisses (pending) | | |
| Choose a plan (cards) | Pick a plan from cards showing coverage | Sai | | |
| Custom plan builder | Set your own deductible, yearly max and coverage % with a live preview | | | |
| Enter what you've used this year | Sliders and tappable cleaning chips for max used, deductible met, cleanings done | | | |
| Set the current month | Month picker so timing advice is accurate | | | |
| Plain-English plan summary | Short readable description of what the plan covers | Wrigley, Sai | | |
| Browse procedures | Procedure cards by preventive, basic and major care with typical prices | | | |
| Search a procedure in plain words | "cap on my back tooth" finds the crown | | | |
| Cost of one procedure | Big "You pay" and "Plan pays" | Wrigley (chat), Sai (chat) | | |
| Cost-breakdown chart | Step-by-step bars with hover explanations | | | |
| Show the math | Calculation steps in plain English | | | |
| In-network vs out-of-network | Side by side, including balance billing | Wrigley (chat) | | |
| Jargon glossary | Hover definitions for deductible, coinsurance, annual max, balance billing | | | |
| Treatment list builder | Add treatments, set urgent/soon/flexible, "must come after" | | | |
| Plan-year scheduler | Finds the cheapest order and timing across this and next plan year | Wrigley (chat summary) | | |
| Month-by-month timeline | Treatments in their months with a plan-year reset marker | | | |
| Savings banner | "Everything now $X → Optimized $Y → You save $Z" with a toggle | | | |
| "Why this order?" | Plain-English reasons for the schedule | | | |
| "What if I wait until January?" | Cost now vs after the plan year resets | Wrigley (chat) | | |
| Try a different start month | Re-runs the schedule for another month | | | |
| Dentist treatment plan reader | Paste a dentist's plan; shows procedures, teeth and fees, flags high quotes, sends them to the scheduler | Sai (PDF) | | |
| Annual max used and left | Radial gauge | Wrigley, Sai | | |
| Deductible progress | How much of the deductible is met | Wrigley | | |
| Cleanings and visits used | Tappable chips (for example 1 of 2) | Wrigley | | |
| Log a visit | Record a visit so usage updates | | | |
| Months left in plan year | Shows how much of the year remains | | | |
| End-of-year reminder | Banner about unused benefits | Wrigley | | |
| Add reminder to calendar | Downloads a calendar file | | | |
| Savings tips | Cards: schedule after the reset, stay in network, free preventive visits, cheaper equivalent treatment, FSA/HSA, high-quote check | | | |
| FSA/HSA tax-rate slider | Adjust the assumed tax rate | | | |
| High-quote warning | Flags a dentist quote above the typical range | | | |
| Questions to ask your dentist | Tickable checklist with progress, copy, print and an urgent-care warning | | | |
| Chat drawer on every page | Chat opens from any page | Wrigley, Ulisses | | |
| Suggested questions | Tap to start a chat | Sai | | |
| Visible chat activity | "Calculating…" chips | Wrigley | | |
| Chat answers: costs, waiting, benefits left | Procedure cost, "what if I wait", what's left | Wrigley, Sai | | |
| Offline chat mode | Chat still answers some things without an AI model | Sai | | |
| Local AI model | Chat runs on a local open-source model (Ollama) | | | |
| Number check on chat answers | Dollar amounts must come from the calculator | | | |
| Estimate disclaimer | "This is an estimate, not a guarantee" | Wrigley, Sai | | |

---

## C. Wrigley's prototype (on `main`)

| Feature | What it does | Also in | Decision | Notes |
|---|---|---|---|---|
| Dashboard page | Home view with annual max, deductible, cleanings cards, reminder, upcoming events, history | Sai (home summary) | | |
| Member and plan summary card | "Welcome back" header with plan and usage | Sai | | |
| Plan facts | Benefit period, premium, annual max, deductible, dependent age limits | | | |
| Per-service coverage details | Each service: plan %, frequency, age limit, notes | Sai | | |
| Upcoming schedule | Next three appointments and reminders | | | |
| Dental and claims history | Past procedures with what you paid and the plan paid | Sai (assistant) | | |
| Plan documents list | List of plan PDFs | | | |
| Find a dentist | Link to a map of dentists | | | |
| Family profiles | A profile for each covered person | Sai | | |
| Switch between family members | Choose whose plan and usage you're viewing | Sai | | |
| Add a family member | Add a person with name, age and relationship | | | |
| Separate usage per person | Each person has their own max, deductible and visits | | | |
| Who is eligible for what | Eligibility table per person | Sai | | |
| Age limits and student rule | Dependent limit, student limit, "approaching limit" warning | Sai | | |
| Must-have coverage tags | Mark coverage a person needs, such as braces | | | |
| Dedicated assistant page | Full-page chat with a side panel | Sai | | |
| Chat answers: plan, coverage, who's covered, history | Plan details, eligibility and past claims | Sai | | |
| Personalized to the person | Answers use that person's plan and records | Sai | | |
| "What Your Assistant Knows" panel | Shows the user the information the assistant uses | | | |
| Separate memory per person | Each profile has its own chat thread and remembered preferences | | | |
| Orthodontia coverage | Braces coverage for children | Sai | | |

---

## D. Sai's prototype (`prototype/sai-benefits-portal`)

| Feature | What it does | Also in | Decision | Notes |
|---|---|---|---|---|
| Landing page | Hero section with call-to-action buttons | Caleb, Ulisses (pending) | | |
| Member summary card | Name, plan, member ID, usage meter | Wrigley | | |
| Plan tier comparison | Basic, Preferred, Premium side by side: price, max, deductible, coverage % by service | | | |
| Annual cost calculator | Sliders for people, visits and major work; estimates premiums plus care | | | |
| PDF upload and explanation | Attach an EOB, claim summary or treatment plan PDF and get a plain-English explanation | Caleb (pasted text only) | | |
| Family tree diagram | Clickable family tree | | | |
| Eligibility chips per person | Click a person to see which services they can use | Wrigley | | |
| "Pending verification" status | A dependent awaiting student verification | Wrigley | | |
| Plan upgrade advice | "Should I upgrade to Premium next year?" | | | |
| Vision coverage | Vision exam, lenses and frames as a service | | | |
| Orthodontia coverage | Children's braces line | Wrigley | | |
| Dedicated assistant page with member sidebar | Full-page chat beside the member's details | Wrigley | | |
| Suggested questions | Tap to ask | Caleb | | |
| Cloud AI assistant | Answers free-form questions with a cloud model (needs a paid key) | | | |
| Offline canned replies | A few built-in answers with no AI model | Caleb | | |
| Claims on file in the assistant | The assistant knows past claims | Wrigley | | |

---

## E. Ulisses's work

| Feature | What it does | Also in | Decision | Notes |
|---|---|---|---|---|
| Top navigation bar | Links to Home, Dashboard, My Coverage, Estimate, Plan My Year, Chatbot, Profiles | | | |
| Profile switcher in the header | Switch family member from any page | Wrigley | | |
| Assistant button on every page | Floating button opens the chat | Caleb, Wrigley | | |
| Editorial theme | Warm paper background, ink text, Lincoln maroon, orange only for money you save | | | |
| Style guide page | Reference page at `/style` for colors, buttons and a sample receipt | | | |
| Planned page structure | Empty pages for Home, My Coverage, Estimate, Plan My Year, Get started | | | |
| Landing page | **Not pushed yet** | Caleb, Sai | | |
| Login page | **Not pushed yet** | | | |

---

## F. Anything missing

Features not in any prototype that you want, or changes to a feature above:

1.
2.
3.
