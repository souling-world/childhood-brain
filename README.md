# Childhood Brain (2h hackathon kit)

A GBrain that holds generated childhoods. A person's childhood = parent + parent + school + a few life-changing events, concatenated. Seven taps, then `gbrain search` finds the childhood that recognizes you. Swap the base to Lima and ask again.

## Run order (gbrain 0.59, keyless PGLite)
Quick path: `export ANTHROPIC_API_KEY=...` then `./setup.sh`. It runs the steps below and starts the server.

1. `bun install -g github:garrytan/gbrain` then `gbrain init --pglite --no-embedding` (keyless: keyword search, no embedding key needed).
2. `export ANTHROPIC_API_KEY=...` then `N=60 bun run generate.ts` (US base). Then `N=40 BASE="Lima, Peru" bun run generate.ts` for the Lima repertoire. Pages land in `./brain` (`childhoods/childhood-us-*`, `childhoods/childhood-lima-*`).
3. Ingest: `gbrain import ./brain --no-embed` (SYNC_CMD in server.ts).
4. `gbrain search "the translator the storm" --json` in a terminal to check results come back (QUERY_CMD in server.ts). The UI keeps the childhood pages from whatever shape it returns and falls back to raw text.
5. `bun run server.ts` and open http://localhost:3000

Pages carry no `slug:` frontmatter on purpose: gbrain derives slugs from paths and skips pages whose frontmatter slug disagrees.

## What to edit
- `seeds.json` is the taste layer: parents, schools, rank-changing events. Change these, not prompts, if strangers do not go quiet at the end.
- Person pages are written to `brain/people/` at demo time. That page is the person's LoRA and the shareable artifact.

## Pitch
We did not collect anyone's childhood. We generated a hundred and let GBrain find yours. A childhood is not one person's; it is parents plus school plus a few moments that changed the weights. That adapter fits in seven lines, and it composes with any base, so we can show you who you would be in Lima.
