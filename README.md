# Childhood Brain (2h hackathon kit)

## Why

Most people who build something big can point to a few childhood moments that changed the weights: a parent who left, a school that didn't fit, a year where you were the translator for your whole family. Those moments are the adapter. They are also the part of a person that no resume, no onboarding form, and no AI assistant ever sees, so every tool treats a person as a blank profile and misses what actually shaped them.

This kit inverts that. It generates childhoods, finds the one that recognizes you, and hands you a page that says, in seven lines, who and what shaped you. For someone with a complex childhood that page does three things: it names the pattern instead of leaving it as a private feeling, it separates the people and experiences that made you from the noise around them, and it gives you an artifact you can hand to a cofounder, a therapist, or an AI so they start from who you are. The people who need this most are the ones whose childhood was hardest, because that is where the adapter is strongest and least understood.

A GBrain that holds generated childhoods. A person's childhood = parent + parent + school + a few life-changing events, concatenated. Seven taps, then `gbrain search` finds the childhood that recognizes you.

## Run order (gbrain 0.59, keyless PGLite)
Quick path: `export ANTHROPIC_API_KEY=...` then `./setup.sh`. It runs the steps below and starts the server.

1. `bun install -g github:garrytan/gbrain` then `gbrain init --pglite --no-embedding` (keyless: keyword search, no embedding key needed).
2. `export ANTHROPIC_API_KEY=...` then `N=100 bun run generate.ts`. Pages land in `./brain/childhoods/childhood-*`.
3. Ingest: `gbrain import ./brain --no-embed` (SYNC_CMD in server.ts).
4. `gbrain search "the translator the storm" --json` in a terminal to check results come back (QUERY_CMD in server.ts). The UI keeps the childhood pages from whatever shape it returns and falls back to raw text.
5. `bun run server.ts` and open http://localhost:3000

Pages carry no `slug:` frontmatter on purpose: gbrain derives slugs from paths and skips pages whose frontmatter slug disagrees.

## What to edit
- `seeds.json` is the taste layer: parents, schools, rank-changing events. Change these, not prompts, if strangers do not go quiet at the end.
- Person pages are written to `brain/people/` at demo time. That page is the person's LoRA and the shareable artifact.

## Evals
`evals/` scores how accurately a brain reconstructs a real person: held-out recall vs a base-rate guesser, a five-way self-recognition lineup, and consistency across paraphrases. `bun run eval --brain prototype --eval all` prints one table. See `evals/README.md`.

## Pitch
We did not collect anyone's childhood. We generated a hundred and let GBrain find yours. A childhood is not one person's; it is parents plus school plus a few moments that changed the weights. That adapter fits in seven lines, and it fits anyone.
