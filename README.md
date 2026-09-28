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

`evals/` scores how accurately a brain reconstructs a real person. Any brain plugs in behind one interface, `brain.query(person_facts, question) -> answer`, and `bun run eval --brain <name> --eval all` prints one table.

- `held_out_recall`: feed 70% of a person's facts, predict the hidden 30%. Score vs a base-rate guesser that picks the most common answer per field. Broken down by fact type: facts, preferences, fears, stress reactions, childhood fragments.
- `self_recognition`: the matched childhood plus 4 same-bucket decoys. Percent who pick their own, chance 20%, plus a 1 to 5 "this is me" rating.
- `consistency`: 20 fact questions, 10 phrasings each, agreement rate.

Data lives in `evals/data/`. `synthetic/` is generated and clearly fake. `consented/` is gitignored and holds real entries added under CONSENT.md. `public/` holds public figures built from cited sources; public is not consent, and those records are for comparing brains only.

### Results, Sep 27 2026

Prototype brain (the quiz's 25-childhood nearest-neighbor matcher) on 4 public founders:

| Eval | Score | Baseline / chance |
|---|---|---|
| held_out_recall | 8.3% | 25.0% base rate |
| self_recognition (simulated) | 0.0% | 20% |
| consistency | 100% | n/a |

Weakest fact type: stress reactions.

### Analysis

- The prototype loses to a base-rate guesser on real people. Seven taps over 25 templates is a good intake and a bad predictor. The quiz stays as the front door; the brain has to be model-backed.
- Consistency at 100% is a property of a deterministic matcher, not evidence of accuracy.
- A separate run ranked the 4 founders above 16 synthetic distractors with AUC 1.00, and the model named 3 of 4 from their facts alone. That is recognition, not simulation: the model already knows these people. Public-figure results are reported as a leakage check, never as a prediction score.
- The number that matters is held-out recall on people the model cannot know. That requires consented entries, and none existed at the time of this run.

### Next steps

1. Run the llm brain on `synthetic/people.json`, then on `consented/` as entries arrive. Report held-out recall lift over baseline, by fact type.
2. Collect at least 5 consented entries from people the model has no public record of. Run `bun run lineup` with each of them in the room and log the 1 to 5 rating.
3. Retire the prototype as the default brain once the llm brain beats baseline on consented data. Keep it in the registry as the floor every new brain must clear.
4. Add a leakage flag to the runner: if a brain names the person from facts alone, mark the run `recognized` and exclude it from the headline table.
5. Publish the benchmark and the table so other childhood brains can be scored on the same interface.

## Pitch
We did not collect anyone's childhood. We generated a hundred and let GBrain find yours. A childhood is not one person's; it is parents plus school plus a few moments that changed the weights. That adapter fits in seven lines, and it fits anyone.
