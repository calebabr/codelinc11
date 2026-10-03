# Project rules
@docs/CONVENTIONS.md
@docs/FEATURES.md

- Backend rules: backend/CLAUDE.md. Frontend rules: frontend/CLAUDE.md.
- Edit only your own folders (FEATURES.md §1).
- Agent team: agents/README.md (rules for every agent, roster and ownership). Each role has a brief in agents/<role>-agent.md; the orchestrator is agents/orchestrator.md.
- Open decisions: docs/decisions/. Where the prototypes live: docs/prototypes/. Never edit, delete or rewrite a prototype branch.
- Git: only the orchestrator runs git, under the user's own identity. Never add Claude as author or co-author. Never force-push.
