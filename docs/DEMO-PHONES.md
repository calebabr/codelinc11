# Demo on phones: runbook for presenters

A QR code is only a web address. The audience scans it, their phone opens the site, and the site must be able to reach the backend. Pick **one mode** below, then run the checklist.

| Mode | What it is | Cost | Phone mic works? | Use when |
|---|---|---|---|---|
| **A. Same Wi-Fi** | Phones open `http://<laptop address>:5173` | Free, no cloud | No (plain HTTP) | Home or lab network you control |
| **B. Tunnel** (recommended backup) | A free tunnel gives your laptop an `https://...` address | Free | Yes (HTTPS) | Venue Wi-Fi blocks phones, or the audience is on cellular |
| **C. Public hosting** | Frontend on a static host, backend on a server | Small monthly cost | Yes (HTTPS) | You want it up for days, not minutes |

In modes A and B the browser talks to **one address** (the Vite dev server). Vite forwards every `/api/...` request to the backend on port 8000 (it removes the `/api` part). That is why no CORS change is needed.

## Mode A: same Wi-Fi

1. Start the backend (port 8000) as usual.
2. In `frontend/`, start the frontend so other devices can reach it, with the API address set to `/api`:
   - PowerShell: `$env:VITE_API_URL="/api"; npm run dev:lan`
   - Bash: `VITE_API_URL=/api npm run dev:lan`
3. From the project root run `.\scripts\lan-url.ps1` (Windows) or `scripts/lan-url.sh`. It prints the laptop's address and the exact URL, for example `http://192.168.1.20:5173/welcome`, and writes `qr-demo.png` and `qr-demo.svg` if the QR package is installed (see "QR code" below).
4. Windows will ask "Allow Node.js to communicate on private networks?" the first time. Choose **Private networks**. If you missed it: Windows Security > Firewall > Allow an app, and tick Node.js for Private.
5. Put the phone on the **same Wi-Fi** and scan the QR code.

Good to know:
- Many venue, hotel, campus and guest Wi-Fi networks use "client isolation": devices cannot see each other. If the phone cannot load the page but the laptop can, use Mode B.
- This is plain HTTP. Phones only allow the microphone on HTTPS, so voice input will not work in this mode (typing in the assistant works).
- Test it with one phone before the demo day.

## Mode B: tunnel from the laptop

Same steps as Mode A (backend on 8000, frontend with `VITE_API_URL=/api`, `npm run dev` or `npm run dev:lan`), plus one tunnel command. **You install the tunnel tool yourself**; nothing in this repo downloads it.

- **Cloudflare Tunnel** (no account needed for a quick tunnel): `cloudflared tunnel --url http://localhost:5173`
- **ngrok** (free account and a one-time auth token you set up yourself): `ngrok http 5173`

The tool prints a temporary address such as `https://random-words-here.trycloudflare.com` (ngrok: `https://something.ngrok-free.app`). It changes every time you start the tunnel. Make the QR for that address:

```
python scripts/make_qr.py https://random-words-here.trycloudflare.com/welcome
```

Then show `qr-demo.png`, or open `https://<the-address>/join?url=https://<the-address>/welcome` on the big screen (the Scan to try page, when it is available).

Notes:
- Vite already allows trycloudflare, ngrok and loca.lt host names (`frontend/vite.config.ts`). If you use another tunnel service, add its domain to `server.allowedHosts` there.
- ngrok's free plan may show a "Visit site" warning page the first time. Click through it on your own phone before the demo.
- **Anyone with the address can use the app and spend your assistant quota** (the Anthropic key is billed per message). Keep the tunnel up only during the demo. The app already limits chat (`RATE_CHAT_*`, `CHAT_GLOBAL_DAILY_CAP`).
- Many people share one laptop connection, so the sign-in limit (10 per minute per address by default) can trip. For the demo you can raise `RATE_LOGIN_PER_MINUTE` and `RATE_LOGIN_PER_HOUR` in `backend/.env` and restart the backend. With a tunnel you can also set `TRUST_PROXY=1` so each phone is counted by its own address.
- Do not share the address outside the room, and never put keys in the URL.

## Mode C: public hosting

1. Build the frontend with the backend's HTTPS address: `VITE_API_URL=https://api.example.com npm run build`, then upload `frontend/dist` to a static host (Netlify, Vercel, GitHub Pages, or the S3 + CloudFront kit in `infra/aws/`).
2. On the backend set `CORS_ORIGINS=https://your-frontend-address` (comma separate more than one). For preview domains that change, `CORS_ORIGIN_REGEX` accepts a regular expression.
3. **Mixed content:** an HTTPS page cannot call an HTTP backend. The backend must also be HTTPS (or sit behind the same CloudFront address, as the AWS kit does with `VITE_API_URL=/api`).
4. Hosting costs money and creates cloud resources: get the team's approval first. See [../infra/README.md](../infra/README.md).

## QR code

```
pip install qrcode pillow
python scripts/make_qr.py <address>
```

This writes `qr-demo.png` and `qr-demo.svg` in the current folder (use `--out-dir` to choose another) and prints a text QR in the terminal. It runs **entirely on your machine**; the address is never sent to an online QR service. Without Pillow you still get the SVG and the text QR. Do not commit the generated files.

## 10-minute checklist before the demo

1. Start the backend and the frontend (and the tunnel for Mode B). Open `/health` on the laptop: `ok` is true.
2. Make the QR for the **current** address (tunnel addresses change on every start).
3. Scan it with an **iPhone** (Safari) and an **Android** phone (Chrome). Check the landing page, sign in with the demo family, open Plans, Plan My Year and the assistant.
4. Repeat once on **cellular** (Wi-Fi off) and once in a **private tab**.
5. Ask the assistant one question and confirm the answer streams in.
6. Check the sign-in and chat limits are high enough for the room (see Mode B notes).
7. Keep the laptop plugged in, with sleep turned off and the tunnel window open.
8. Record a 2-minute screen recording of the full flow as the backup.

## If something goes wrong

- **Venue Wi-Fi blocks phones (Mode A fails):** switch to Mode B. The audience can use cellular.
- **The page loads but data does not:** the phone is calling the wrong address. Confirm the frontend was started with `VITE_API_URL=/api` and the backend is running on port 8000. Restart Vite after changing the variable.
- **"Blocked request" from Vite:** the tunnel domain is not in `server.allowedHosts`.
- **The assistant is slow or says it is unavailable:** the rest of the app (estimates, Plan My Year, Plans) does not need the model. Say so and keep going; check `/health` for `chat_mode`. If the model is rate limited, wait a minute.
- **"Too many requests" on sign-in:** raise the sign-in limits (above) and restart the backend.
- **Everything fails:** play the backup screen recording, and show the app on the laptop.
