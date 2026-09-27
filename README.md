# Childhood Brain (2h hackathon kit)

A GBrain that holds generated childhoods. A person's childhood = parent + parent + school + a few life-changing events, concatenated. Seven taps, then `gbrain query` finds the childhood that recognizes you. Swap the base to Lima and ask again.

## Run order
1. `gbrain init --pglite` (needs an embedding key: ZeroEntropy default, or OpenAI. Keyword-only works without one, vector is better.)
2. `export ANTHROPIC_API_KEY=...` then `N=60 bun run generate.ts` (US base). Then `N=40 BASE="Lima, Peru" bun run generate.ts` for the Lima repertoire. Pages land in `./brain`.
3. Ingest: `gbrain import ./brain` (run `gbrain --help` once; if your version uses `ingest` or `import`, change SYNC_CMD in server.ts).
4. `gbrain search "the translator the storm" --json` in a terminal. If the flags differ, edit QUERY_CMD in server.ts. This is the one thing to verify before touching the UI.
5. `bun run server.ts` and open http://localhost:3000

## What to edit
- `seeds.json` is the taste layer: parents, schools, rank-changing events. Change these, not prompts, if strangers do not go quiet at the end.
- Person pages are written to `brain/people/` at demo time. That page is the person's LoRA and the shareable artifact.

## Pitch
We did not collect anyone's childhood. We generated a hundred and let GBrain find yours. A childhood is not one person's; it is parents plus school plus a few moments that changed the weights. That adapter fits in seven lines, and it composes with any base, so we can show you who you would be in Lima.
