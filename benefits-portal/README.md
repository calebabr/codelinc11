# Dental & Vision Benefits Portal (hackathon prototype)

A Lincoln-style (burgundy `#650030` + orange `#FF4F17`) benefits site with:

- Plan tier comparison with coverage bars and a side-by-side table
- Dependent eligibility diagram (click a family member)
- Annual cost calculator
- A personalized AI assistant that explains plans, eligibility, dental records,
  and uploaded PDF reports (EOBs, claim summaries, treatment plans)

No dependencies. Only Node.js 18+ is needed.

## Run on Linux

```bash
# 1. Install Node 18+ if you don't have it (Ubuntu/Debian example)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v

# 2. Go to the project folder
cd benefits-portal

# 3. Start with the real AI (get a key at console.anthropic.com)
export ANTHROPIC_API_KEY="sk-ant-..."
node server.js

# Or start in offline demo mode (canned answers, no PDF reading)
node server.js
```

Open http://localhost:3000. Use `PORT=8080 node server.js` for another port.

## Files

| File | Purpose |
|------|---------|
| `server.js` | Static server + `/api/member` + `/api/chat` (calls the Claude API, reads PDFs) |
| `member.json` | Demo member, household, plans, records. Edit this to change the data |
| `public/index.html`, `app.js` | Home page: plans, diagram, calculator |
| `public/assistant.html`, `chat.js` | Chat page with PDF attach |
| `public/styles.css` | Brand theme |

## Notes

- Keep the API key on the server (as an env var). Never put it in front-end code.
- The member data is fictional. Replace `member.json` with a real data source later.
- This is an unofficial prototype and uses no Lincoln logos or trademarks.
