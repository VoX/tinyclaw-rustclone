# Rustclone Development Rules

## MANDATORY: Pre-Deploy Testing

**NEVER deploy without running `bash deploy.sh`** — it includes automated checks that MUST pass:

1. Client bundle builds without errors
2. Client bundle passes scope/reference verification (`tests/verify-client.js`)
3. Server syntax check passes (`node --check server/index.js`)
4. Server starts and a bot can connect successfully

If any check fails, deployment is blocked. Fix the issue first.

## Code Change Rules

- **Never use sed/awk for code refactoring.** Use the Edit tool or have an agent do it properly. sed doesn't understand JavaScript scope and causes cascading bugs.
- **Never use esbuild `--minify`** — it breaks closure references in the renderer. Use `--sourcemap` instead.
- **Read before editing.** Always read the full function you're modifying, not just the target line.
- **Test after every change.** At minimum: build succeeds + server starts.

## Architecture

- Server: Node.js + bitECS v0.4 + WebSocket, port 8780
- Client: Canvas 2D renderer, esbuild bundled
- Movement: client-authoritative (server validates speed + collisions)
- Deployed via Docker to claw.bitvox.me/rustclone/
- Docker volume at /app/data for persistence

## Key Files

- `shared/components.js` — ECS components (plain array objects)
- `shared/constants.js` — Game balance, items, recipes
- `server/index.js` — Server entry, WebSocket, game loop
- `client/renderer/` — Modular renderer (terrain, entities, ui-overlays, particles)
- `tests/` — E2E tests, playtester, bot framework, verify-client
- `deploy.sh` — Pre-deploy checks + Docker rebuild + deploy
