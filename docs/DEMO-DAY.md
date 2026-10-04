# DEMO DAY runbook (2026-10-04, 10:00 AM)

One page for the presenter. The long script with every click is in [DEMO.md](DEMO.md). All data is synthetic. Say so out loud.

## 30 minutes before: checklist
- [ ] **Backend:** open `https://<your Netlify site>/api/health`. It should show `"chat_mode":"anthropic"`. (Direct address: `http://3-149-89-171.sslip.io:8000/health`.)
- [ ] **Live site:** open the Netlify site, tap **Try the demo**. You land on Home as **Marc Halog** in a new demo family.
- [ ] **Reports:** open **Reports**. Marc has one unpaid explanation of benefits (EOB) for a filling. It should show **$90 owed**.
- [ ] **Find Providers:** open **Find Providers** and enter ZIP **36830**. You should see fictional dentists with distances, in and out of network.
- [ ] **Estimate:** **Costs**, pick **Crown, porcelain/ceramic**. Marc should show **$625**.
- [ ] **Assistant:** ask "How much would a crown cost me?" and wait for the full answer.
- [ ] **Phone check:** on a phone using **cellular** (not the venue Wi-Fi), open `/join` on the site, scan the QR code, tap **Try the demo**.
- [ ] Press **Reset demo data** on Home so your numbers are back to the seed.
- [ ] Screen recording of the demo path saved on the laptop (backup).

## The script, in order
Move between pages with the nav tabs, not the browser reload button (a reload puts **Viewing** back on Marc).

| # | Do this | Say out loud |
|---|---|---|
| 1 | `/welcome`, tap **Try the demo** | "Everyone gets their own demo family. All people and dentists are made up." |
| 2 | **Home** as Marc Halog | Left this year, deductible, cleanings used, the bell |
| 3 | **Family** | Marc, AC, Sophia (9, managed by Marc), Hannah (23, waiting for student verification) |
| 4 | **Costs**, cleaning | **You pay $0** |
| 5 | **Costs**, crown, in network (fresh year) | **You pay $625** |
| 6 | Switch **Viewing** to AC, **Costs**, crown | AC has $1,100 used: **you pay $800** (waiting for January saves $175) |
| 7 | Toggle **Out of network** | **You pay $925**, which includes **$300 balance billing** |
| 8 | **Plan My Year**, **Try the demo case** as AC | **$2,300 now, $1,405 with the best order, you save $895.** The urgent root canal stays this year |
| 9 | **Plans**, **Which plan fits us?** (average care for everyone, in network, seed 42) | Whole household: **Basic cheapest in 82% of years, Preferred 17%, Premium 1%.** "These odds are synthetic placeholders." |
| 10 | **Assistant** | "The engine does the math. The AI only explains it." |
| 11 | Optional: **Find Providers** (ZIP 36830), **Reports** ($90 owed), **Reports** ask page, the bell | Quote to dentist matching is on **Costs**. Email and text are previews only |

## What each page shows
| Page | What it shows |
|---|---|
| Home | What is left this plan year, deductible, cleanings, banner, notifications card |
| Plans | Basic, Preferred, Premium side by side; Which plan fits us?; switch plan (primary only) |
| Family | Household tree, profiles, add and remove people (demo family only) |
| Costs | Estimate in or out of network with "show the math"; paste a dentist quote and match it to a dentist |
| Plan My Year | Cheapest order across two plan years; saved plans; saved comparisons |
| Find Providers (`/providers`) | Fictional dentists near a ZIP; in or out of network; estimate with a procedure |
| Reports (`/reports`) | Claims, EOBs and copays (synthetic) in date order, what you owe |
| Report questions (`/reports/ask`) | Ask the assistant about those reports |
| Assistant | Plain-language answers using that person's data and the engine |
| Bell and `/notifications` | Upcoming items and alerts; settings for app, email, text |
| `/join` | QR code page for phones |

## If the assistant is slow
Netlify cuts a forwarded request after about **26 seconds**, so a very slow answer can fail.
1. Wait about 10 seconds. Text streams in.
2. Say "While it thinks, these numbers come straight from the engine" and show **Costs** or **Plan My Year**. They do not need the model.
3. Tap a suggestion chip or ask something short, such as "What do I have left this year?".
4. If you see "Too many requests", wait the number of seconds it says.
5. Still stuck: use the backup plan below.

## If the backend is down
1. Open the health address. No answer means the server or container is down.
2. Ask the teammate who runs the server to restart the container (see [DEPLOYMENT.md](DEPLOYMENT.md)).
3. While waiting, present from the slides ([PRESENTATION.md](PRESENTATION.md)) and the screen recording. Do not guess numbers.

## If the venue Wi-Fi blocks phones
Phones should use **cellular**. Show the `/join` QR code anyway; the site is public on the Internet. If the room has no signal, drop the audience step and demo on the laptop. Other options: [DEMO-PHONES.md](DEMO-PHONES.md).

## Backup plan
1. Screen recording of the demo path.
2. Local copy: run the backend and frontend on the laptop ([SETUP.md](SETUP.md)); the numbers are the same.
3. Slides with the golden numbers.

## What is not real
- No real email or text is ever sent. The bell and the Delivery preview are previews.
- Uploads accept only the **sample documents**, not your own files.
- All people, dentists, plans, fees, claims and EOBs are fictional.
- Sign-in is a demo with no passwords and no accounts.
- The plan-comparison odds are synthetic placeholders, not claims data.
- Every number is an **estimate, not a guarantee**. Your actual cost depends on your dentist's charges and claim review.
