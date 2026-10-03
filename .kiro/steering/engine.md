# Engine rules (Kiro)
Read docs/CONVENTIONS.md and docs/FEATURES.md first.

- Only edit backend/app/engine/, backend/tests/test_engine*.py, docs/MATH.md and .kiro/.
- Pure functions only: no web code, no LLM calls, no file access except reading backend/data/. Input in, result + trace out.
- Write the golden test file (backend/tests/test_engine.py) from FEATURES.md §2 FIRST, before engine code.
- Never change a golden expected value to make a test pass. Stop and tell M instead.
