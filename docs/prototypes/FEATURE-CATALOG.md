# Feature Catalog: everything the three prototypes do

Purpose: decide which features go into the main product. Implementation planning comes after that.

Each feature is listed once. "From" shows who built it: **Caleb** = branch `proto/dental-prototype` (not on `main` yet), **Wrigley** = `fe/chatbot-prototype` (**merged to `main`** as PR #3), **Sai** = the `benefits-portal` tarball (not in the repo), **Ulisses** = the navigation shell and theme already on `main`. The last column is for your decision.

What is on `main` today: Wrigley's Dashboard, Chatbot and Profiles pages inside Ulisses's navigation shell. Section 10 lists the shell.

## 1. Getting started and plan setup

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Landing page | Welcome page that explains the product and has "Get started" and "Try the demo plan" buttons | Caleb, Sai | |
| Member and plan summary card | "Welcome back" header showing the plan, annual maximum used and left, and the member or household | Wrigley, Sai | |
| Choose a plan | Pick from plan options shown as cards with their coverage | Caleb, Sai | |
| Plan tier comparison | Basic, Preferred and Premium side by side: price, yearly maximum, deductible, and coverage percentage for each type of care | Sai | |
| Custom plan builder | Set your own deductible, yearly maximum and coverage percentages and see a live preview | Caleb | |
| Enter what you've used this year | Set how much of the maximum and deductible are used and which cleanings are done | Caleb | |
| Set the current month | Pick the month you're in so timing advice is accurate | Caleb | |
| Plain-English plan summary | A short readable description of what the plan covers | Caleb, Wrigley, Sai | |
| Plan facts | Benefit period, monthly premium, annual maximum, deductible, dependent age limits | Wrigley | |

## 2. Understanding costs

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Browse procedures | Procedure cards grouped by preventive, basic and major care, with typical prices | Caleb | |
| Search a procedure in plain words | Type "cap on my back tooth" and find the right procedure | Caleb | |
| Cost of one procedure | Shows what you pay and what the plan pays | Caleb (also in chat: Wrigley, Sai) | |
| Cost-breakdown chart | Step-by-step bars: typical cost, deductible, plan share, you pay, with hover explanations | Caleb | |
| Show the math | The calculation steps written out in plain English | Caleb | |
| In-network vs out-of-network | Side-by-side cost, including the extra amount an out-of-network dentist can bill | Caleb (also in chat: Wrigley) | |
| Jargon glossary | Hover definitions for deductible, coinsurance, annual maximum, balance billing | Caleb | |
| Per-service coverage details | For each service: plan percentage, how often it's covered, age limits, notes | Wrigley, Sai | |
| Annual cost calculator | Estimates yearly cost from premiums plus expected care, using sliders for people, visits and major work | Sai | |

## 3. Planning your care

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Treatment list builder | Add planned treatments, set each as urgent, soon or flexible, and say which must come after another | Caleb | |
| Plan-year scheduler | Finds the cheapest order and timing for treatments across this plan year and the next | Caleb (summary in chat: Wrigley) | |
| Month-by-month timeline | Shows each treatment in its month, with a marker where the plan year resets | Caleb | |
| Savings banner | "Doing everything now: $X → Optimized: $Y → You save $Z" with a toggle between the two | Caleb | |
| "Why this order?" | Plain-English reasons for the schedule | Caleb | |
| "What if I wait until January?" | Compares the cost now versus after the plan year resets | Caleb, Wrigley | |
| Try a different start month | Re-runs the schedule for another month | Caleb | |
| Upcoming schedule | The next three appointments and reminders | Wrigley | |
| Dentist treatment plan reader | Paste your dentist's treatment plan; it lists the procedures, teeth and fees, compares each fee to the typical price, and sends them to the scheduler | Caleb | |
| PDF upload and explanation | Attach an EOB, claim summary or treatment plan PDF and get a plain-English explanation | Sai | |

## 4. Tracking and reminders

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Annual maximum used and left | Gauge or progress bar for how much of the yearly maximum is used | Caleb, Wrigley, Sai | |
| Deductible progress | How much of the deductible is met | Caleb, Wrigley | |
| Cleanings and visits used | How many of the covered cleanings or visits are used (for example 1 of 2) | Caleb, Wrigley | |
| Log a visit | Record a visit so usage updates | Caleb | |
| Months left in the plan year | Shows how much of the year remains | Caleb | |
| End-of-year reminder | Banner telling you about unused benefits before they reset | Caleb, Wrigley | |
| Add reminder to calendar | Downloads a calendar file with reminders | Caleb | |
| Dental and claims history | List of past procedures with what you paid and what the plan paid | Wrigley (assistant also knows it in Sai) | |
| Plan documents list | List of plan PDFs (summary of benefits, certificate, fee schedule) | Wrigley | |

## 5. Saving money

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Savings tips | Cards showing ways to save: schedule after the reset, stay in network, use free preventive visits, choose a cheaper equivalent treatment, use FSA/HSA money, check a high quote. Each shows before and after and how it was calculated | Caleb | |
| FSA/HSA tax-rate slider | Adjust the assumed tax rate to see the savings change | Caleb | |
| High-quote warning | Flags a dentist quote above the typical price range | Caleb | |
| Plan upgrade advice | Asks whether you should move to a higher tier next year | Sai | |

## 6. Preparing for the dentist

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Questions to ask your dentist | Tickable checklist grouped by topic (urgency, cost, coverage, alternatives, timing, the specific procedure), with a progress count, copy, print and an urgent-care warning | Caleb | |
| Find a dentist | Link to a map of dentists, described as showing who is in network | Wrigley | |

## 7. Family and dependents

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Family profiles | A profile for each covered person: self, spouse, children | Wrigley, Sai | |
| Switch between family members | Choose whose plan and usage you're viewing | Wrigley, Sai | |
| Add a family member | Add a new person with name, age and relationship | Wrigley | |
| Separate usage per person | Each person has their own maximum, deductible and visits | Wrigley | |
| Who is eligible for what | Shows which services each person can use | Wrigley, Sai | |
| Age limits and student rule | Dependent age limit, full-time student limit, "approaching limit" warning, "pending verification" status | Wrigley, Sai | |
| Must-have coverage tags | Mark coverage a person needs, such as braces | Wrigley | |
| Family diagram | Clickable family tree showing eligibility chips | Sai | |

## 8. Assistant (chat)

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Chat available on every page | A chat button or panel you can open anywhere | Caleb, Wrigley | |
| Dedicated assistant page | A full-page chat with a side panel | Wrigley, Sai | |
| Suggested questions | Tap a suggested question to start | Caleb, Sai | |
| Visible activity | Shows what the assistant is doing, such as "Calculating…" | Caleb, Wrigley | |
| Answers about costs, waiting, benefits left | Procedure cost, "what if I wait", what's left this year | Caleb, Wrigley, Sai | |
| Answers about plan, coverage, who's covered, history | Plan details, eligibility and past claims | Wrigley, Sai | |
| Personalized to the person | Answers use that person's plan, household and records | Wrigley, Sai | |
| "What the assistant knows" panel | Shows the user the information the assistant is using about them | Wrigley | |
| Separate memory per person | Each profile has its own chat thread and remembered preferences | Wrigley | |
| Offline mode | Chat still answers a few things without an AI model | Caleb, Sai | |
| Local AI model | Chat runs on a local open-source model | Caleb | |
| Check that dollar amounts come from the calculator | Answers are checked so numbers aren't invented | Caleb | |

## 9. Other

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Estimate disclaimer | "This is an estimate, not a guarantee" on results | Caleb, Wrigley, Sai | |
| Vision coverage | Vision exam, lenses and frames shown as a service | Sai | |
| Orthodontia coverage | Braces coverage for children | Wrigley, Sai | |
| Burgundy and orange brand look | Lincoln-inspired colors | Caleb, Wrigley, Sai | |

## 10. Shared shell already on `main` (Ulisses)

| Feature | What it does | From | Include in main product? |
|---|---|---|---|
| Top navigation bar | Page links: Home, Dashboard, My Coverage, Estimate, Plan My Year, Chatbot, Profiles. The family profile switcher sits in the header | Ulisses (switcher: Wrigley) | |
| Assistant button on every page | A floating "Ask the assistant" button opens the chat panel from any page, including the Chatbot page | Ulisses, Wrigley | |
| Editorial theme | Warm paper background, ink text, Lincoln maroon, and orange used only for money you save | Ulisses | |
| Style guide page | A reference page at `/style` showing the colors, buttons and a sample cost receipt | Ulisses | |
| Planned pages (titles only, no features yet) | Home, My Coverage, Estimate ("What will I owe?"), Plan My Year and Get started exist as empty pages; they mark where those features are meant to go | Ulisses | |

---

Next step: once you've filled in the last column, we plan how to combine the chosen features into one implementation.
