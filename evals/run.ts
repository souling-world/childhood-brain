// bun run eval --brain nearest,llm --eval all [--data evals/data/synthetic/people.json] [--reuse] [--people 10]
// Two phases, as in the Vertex Gen AI eval SDK: run inference into a dataset you can keep
// (evals/runs/<brain>/<eval>.jsonl), then score that dataset. Several brains land side by side
// in one table, and `baseline` is always added so every score sits next to the floor.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { makeBrain, type Fact, type Person, type Question } from "./brains";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1] ?? "true"; };
const flag = (k: string) => process.argv.includes(`--${k}`);
const EVALS = ["held_out_recall", "self_recognition", "consistency"] as const;
type Eval = (typeof EVALS)[number];

const dataPath = arg("data", "evals/data/synthetic/people.json")!;
const population: Person[] = JSON.parse(readFileSync(dataPath, "utf8"));
const people = population.slice(0, Number(arg("people", String(population.length))));
const brains = [...new Set(["baseline", ...arg("brain", "nearest")!.split(",")])];
const evals = (arg("eval", "all") === "all" ? EVALS : arg("eval")!.split(",")) as Eval[];

// deterministic, so every brain is scored on the same split and the same lineups
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const shuffle = <T,>(a: T[], key: string) => [...a].sort((x, y) => hash(key + JSON.stringify(x)) - hash(key + JSON.stringify(y)));

type Case = { person: string; facts: Fact[]; q: Question; reference: string[]; phrasing?: number };

// held_out_recall: see 70% of a person's facts, predict the hidden 30%
const split = (p: Person) => {
  const hidden = p.facts.filter(f => hash(p.id + f.id) < 0.3);
  if (!hidden.length) hidden.push(p.facts[0]);
  return { known: p.facts.filter(f => !hidden.includes(f)), hidden };
};
const ref = (f: Fact) => f.accept ?? [f.answer];
const ask = (f: Fact): Question => ({ id: f.id, type: f.type, question: f.question, options: f.options });

const PHRASINGS = [
  (q: string) => q,
  (q: string) => `Quick one: ${q}`,
  (q: string) => `If you had to bet, ${q[0].toLowerCase()}${q.slice(1)}`,
  (q: string) => `${q} Go with your best read.`,
  (q: string) => `Based only on the facts above, ${q[0].toLowerCase()}${q.slice(1)}`,
  (q: string) => `A friend asks you: "${q}" What do you tell them?`,
  (q: string) => `${q} One option only.`,
  (q: string) => `Think about who this person is. ${q}`,
  (q: string) => `Fill in the profile. ${q}`,
  (q: string) => `Last question. ${q}`,
];

const build: Record<Eval, () => Case[]> = {
  held_out_recall: () => people.flatMap(p => {
    const { known, hidden } = split(p);
    return hidden.map(f => ({ person: p.id, facts: known, q: ask(f), reference: ref(f) }));
  }),
  // consistency: 20 held-out questions, 10 phrasings each, options rotated so order cannot carry the answer
  consistency: () => people.flatMap(p => { const { known, hidden } = split(p); return hidden.map(f => ({ p, known, f })); }).slice(0, 20)
    .flatMap(({ p, known, f }) => PHRASINGS.map((phrase, i) => ({
      person: p.id, facts: known, phrasing: i, reference: ref(f),
      q: { ...ask(f), question: phrase(f.question), options: [...f.options.slice(i % f.options.length), ...f.options.slice(0, i % f.options.length)] },
    }))),
  // self_recognition (simulated): the brain sees everything but the childhood facts and picks this
  // person's childhood out of 5, the 4 decoys sharing their school when possible. Chance is 20%.
  self_recognition: () => people.filter(p => p.childhood).map(p => {
    const c = (x: Person) => x.childhood as { parents: string[]; school: string; events: string[] };
    const describe = (x: Person) => `Parents: ${c(x).parents.join(", ")}. School: ${c(x).school}. Events: ${c(x).events.join(", ")}.`.replace(/(parent|school|event)-/g, "").replace(/-/g, " ");
    const pool = shuffle(population.filter(x => x.id !== p.id && x.childhood), p.id);
    const decoys = [...pool.filter(x => c(x).school === c(p).school), ...pool.filter(x => c(x).school !== c(p).school)].slice(0, 4);
    const options = shuffle([p, ...decoys].map(describe), p.id + "lineup");
    return {
      person: p.id, facts: p.facts.filter(f => f.type !== "childhood"), reference: [describe(p)],
      q: { id: "lineup", type: "lineup", question: "Which of these childhoods belongs to this person?", options },
    };
  }),
};

// map free text back onto an option: exact first, then the longest option the reply contains
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const toOption = (reply: string, options: string[]) =>
  options.find(o => norm(o) === norm(reply)) ?? options.filter(o => norm(reply).includes(norm(o))).sort((a, b) => b.length - a.length)[0] ?? reply;

type Row = Omit<Case, "facts"> & { brain: string; eval: Eval; response: string; answer: string; correct: boolean };

async function inference(spec: string, e: Eval): Promise<Row[]> {
  const file = `evals/runs/${spec.replace(/[^a-z0-9.-]+/gi, "_")}/${e}.jsonl`;
  if (flag("reuse") && existsSync(file)) return readFileSync(file, "utf8").trim().split("\n").map(l => JSON.parse(l));
  const brain = makeBrain(spec, population);
  const rows = await Promise.all(build[e]().map(async ({ facts, ...c }) => {
    const response = await brain.query(facts, c.q, c.person);
    const answer = toOption(response, c.q.options);
    return { brain: spec, eval: e, ...c, response, answer, correct: c.reference.includes(answer) };
  }));
  // a failed call would score as a wrong answer forever under --reuse, so do not cache it
  const empty = rows.filter(r => !r.response).length;
  if (empty) { console.error(`${spec} ${e}: ${empty} empty responses, not saving ${file}`); return rows; }
  mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  writeFileSync(file, rows.map(r => JSON.stringify(r)).join("\n") + "\n");
  return rows;
}

// scoring works on saved rows only, so a dataset from any run can be rescored without calling a brain
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const chance = (rows: Row[]) => mean(rows.map(r => 1 / r.q.options.length));
function score(e: Eval, rows: Row[]): Record<string, number> {
  if (e !== "consistency") {
    const out: Record<string, number> = { [e]: mean(rows.map(r => +r.correct)) };
    if (e === "held_out_recall") for (const t of [...new Set(rows.map(r => r.q.type))].sort()) out[`  ${t}`] = mean(rows.filter(r => r.q.type === t).map(r => +r.correct));
    return out;
  }
  // agreement: share of the 10 phrasings that give the question's most common answer
  const groups = Object.values(Object.groupBy(rows, r => `${r.person}/${r.q.id}`)) as Row[][];
  return { consistency: mean(groups.map(g => { const n: Record<string, number> = {}; for (const r of g) n[r.answer] = (n[r.answer] ?? 0) + 1; return Math.max(...Object.values(n)) / g.length; })) };
}

const table: Record<string, Record<string, number>> = {};
const floor: Record<string, number> = {};
for (const e of evals) for (const b of brains) {
  const rows = await inference(b, e);
  for (const [k, v] of Object.entries(score(e, rows))) (table[k] ??= {})[b] = v;
  floor[e] ??= chance(rows);
  for (const t of e === "held_out_recall" ? [...new Set(rows.map(r => r.q.type))] : []) floor[`  ${t}`] ??= chance(rows.filter(r => r.q.type === t));
}

const pct = (x: number) => (Number.isNaN(x) ? "-" : `${(100 * x).toFixed(1)}%`);
const label = (b: string) => (b.length > 12 ? "…" + b.slice(-11) : b);
const cols = [...brains.map(label), "chance"];
const w = Math.max(18, ...Object.keys(table).map(k => k.length));
console.log(`data: ${dataPath} (${people.length} people)\n`);
console.log("metric".padEnd(w), ...cols.map(c => c.padStart(12)));
for (const [k, v] of Object.entries(table)) console.log(k.padEnd(w), ...brains.map(b => pct(v[b]).padStart(12)), pct(floor[k]).padStart(12));
console.log("\nrows saved under evals/runs/<brain>/<eval>.jsonl; rescore with --reuse");
