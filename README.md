# Sai's benefits-portal prototype (preserved)

This branch holds Sai's hackathon prototype exactly as delivered, so it is not lost while the main product is built.

- `benefits-portal.tar.gz`: the original file Sai handed over (unmodified).
- `benefits-portal/`: the same contents extracted, for browsing.

Delivered on 2026-10-03. It is a Node server with no dependencies plus plain HTML/JS pages.
Features: plan tier comparison, dependent eligibility diagram, annual cost calculator, and an AI assistant that can read uploaded PDFs (needs an Anthropic API key; offline mode gives a few canned answers).

This branch is a standalone snapshot. It is not meant to be merged into `main`.
To run it: `cd benefits-portal && node server.js` then open http://localhost:3000.
