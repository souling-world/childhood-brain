// bun run evals/data/make-synthetic.ts  -> evals/data/synthetic/people.json
// Clearly fake people built from seeds.json. Traits are nudged by the parents, school and events
// a person drew, plus noise, so a brain that reads the childhood can beat the base rate but never ace it.
// env: N (default 40), SEED (default 7)
import seeds from "../../seeds.json";
import { writeFileSync } from "fs";

const N = Number(process.env.N ?? 40);
let s = Number(process.env.SEED ?? 7) >>> 0;
const rng = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(a: T[], k: number) => [...a].map(x => [rng(), x] as const).sort((x, y) => x[0] - y[0]).slice(0, k).map(x => x[1]);

export const FIELDS = {
  fear: { type: "fear", question: "What is this person most afraid of?", options: ["being left", "failing in public", "being a burden", "losing control"] },
  stress: { type: "stress", question: "Under stress, what does this person do first?", options: ["go quiet and withdraw", "work harder", "take care of everyone else", "pick a fight"] },
  work: { type: "preference", question: "Where does this person do their best work?", options: ["alone with the problem", "a small trusted crew", "in front of a crowd", "inside a clear structure"] },
  praise: { type: "preference", question: "How does this person want to be recognized?", options: ["privately, one on one", "publicly", "by results, not words", "praise makes them uneasy"] },
  birth_order: { type: "fact", question: "What was this person's birth order?", options: ["oldest", "middle", "youngest", "only"] },
  languages: { type: "fact", question: "How many languages were spoken at home?", options: ["one", "two", "three or more"] },
  moves: { type: "fact", question: "How often did this person move before 12?", options: ["never moved", "moved once", "moved two or three times", "moved four or more times"] },
  first_job: { type: "fact", question: "When did this person start earning money?", options: ["before 14", "14 to 16", "17 to 19", "20 or later"] },
  school: { type: "childhood", question: "What kind of school did this person attend?", options: seeds.schools.map(x => x.name) },
  parent: { type: "childhood", question: "Which of these describes one of this person's parents?", options: seeds.parents.map(x => x.name) },
  ev_move: { type: "childhood", question: "Did this person go through a move that changed everything?", options: ["yes", "no"] },
  ev_translator: { type: "childhood", question: "Did this person translate for their family as a child?", options: ["yes", "no"] },
  ev_responsibility: { type: "childhood", question: "Did this person carry adult responsibility early?", options: ["yes", "no"] },
  ev_money: { type: "childhood", question: "Did the family's money go away during this person's childhood?", options: ["yes", "no"] },
} as const;
type Field = keyof typeof FIELDS;

// slug -> {field: option}. One vote each; the trait is the argmax plus noise.
const VOTES: Record<string, Partial<Record<Field, string>>[]> = {
  "parent-the-provider": [{ praise: "by results, not words" }, { stress: "work harder" }, { first_job: "17 to 19" }],
  "parent-the-anxious-protector": [{ fear: "losing control" }, { stress: "go quiet and withdraw" }, { work: "inside a clear structure" }],
  "parent-the-golden-child-maker": [{ fear: "failing in public" }, { praise: "publicly" }, { work: "in front of a crowd" }],
  "parent-the-absent-one": [{ fear: "being left" }, { stress: "go quiet and withdraw" }, { work: "alone with the problem" }],
  "parent-the-friend": [{ stress: "take care of everyone else" }, { fear: "being a burden" }, { birth_order: "oldest" }],
  "parent-the-immigrant-striver": [{ languages: "two" }, { stress: "work harder" }, { first_job: "before 14" }, { fear: "being a burden" }],
  "parent-the-warm-constant": [{ praise: "privately, one on one" }, { work: "a small trusted crew" }],
  "parent-the-storm": [{ stress: "pick a fight" }, { fear: "losing control" }, { praise: "praise makes them uneasy" }],
  "school-suburban-public": [{ work: "inside a clear structure" }],
  "school-small-religious": [{ fear: "being a burden" }],
  "school-underfunded-urban": [{ first_job: "before 14" }],
  "school-elite-private": [{ fear: "failing in public" }, { praise: "publicly" }],
  "school-rural-consolidated": [{ work: "alone with the problem" }],
  "event-the-move": [{ moves: "moved two or three times" }, { moves: "moved two or three times" }],
  "event-being-the-translator": [{ languages: "two" }, { stress: "take care of everyone else" }],
  "event-early-responsibility": [{ birth_order: "oldest" }, { first_job: "before 14" }, { stress: "take care of everyone else" }],
  "event-money-went-away": [{ first_job: "14 to 16" }, { stress: "work harder" }],
  "event-public-humiliation": [{ fear: "failing in public" }],
  "event-the-rupture": [{ fear: "being left" }],
  "event-the-friend-who-left": [{ fear: "being left" }],
  "event-being-needed": [{ stress: "take care of everyone else" }],
  "event-the-win": [{ praise: "publicly" }],
  "event-first-thing-you-loved-alone": [{ work: "alone with the problem" }],
  "event-the-long-summer-alone": [{ work: "alone with the problem" }],
  "event-one-adult-saw-you": [{ praise: "privately, one on one" }],
  "event-caught-and-shamed": [{ praise: "praise makes them uneasy" }],
  "event-the-comparison": [{ fear: "failing in public" }],
  "event-the-illness": [{ fear: "losing control" }],
  "event-the-secret": [{ stress: "go quiet and withdraw" }],
};
// priors for fields most childhoods say nothing about
const PRIOR: Partial<Record<Field, Record<string, number>>> = {
  languages: { one: 0.8 }, moves: { "never moved": 0.6, "moved once": 0.5 }, first_job: { "17 to 19": 0.5, "14 to 16": 0.4 },
};
const NOISE = 0.2; // chance a trait ignores the childhood entirely

const trait = (f: Field, slugs: string[]) => {
  const opts = FIELDS[f].options as readonly string[];
  if (rng() < NOISE) return opts[Math.floor(rng() * opts.length)];
  const score = Object.fromEntries(opts.map(o => [o, (PRIOR[f]?.[o] ?? 0) + rng() * 0.6]));
  for (const sl of slugs) for (const v of VOTES[sl] ?? []) if (v[f]) score[v[f]!] += 1;
  return opts.reduce((a, b) => (score[b] > score[a] ? b : a));
};
const name = (sl: string) => [...seeds.parents, ...seeds.schools, ...seeds.events].find(x => x.slug === sl)!.name;

const people = Array.from({ length: N }, (_, i) => {
  const parents = pick(seeds.parents, 2).map(x => x.slug);
  const school = pick(seeds.schools, 1)[0].slug;
  const events = pick(seeds.events, 3 + Math.floor(rng() * 3)).map(x => x.slug);
  const all = [...parents, school, ...events];
  const has = (sl: string) => (events.includes(sl) ? "yes" : "no");
  const answer: Record<Field, string> = {
    fear: trait("fear", all), stress: trait("stress", all), work: trait("work", all), praise: trait("praise", all),
    birth_order: trait("birth_order", all), languages: trait("languages", all), moves: trait("moves", all), first_job: trait("first_job", all),
    school: name(school), parent: name(parents[0]),
    ev_move: has("event-the-move"), ev_translator: has("event-being-the-translator"),
    ev_responsibility: has("event-early-responsibility"), ev_money: has("event-money-went-away"),
  };
  return {
    id: `synthetic-${String(i + 1).padStart(3, "0")}`,
    synthetic: true,
    childhood: { parents, school, events },
    // either parent counts for the parent question
    facts: (Object.keys(FIELDS) as Field[]).map(f => ({ id: f, ...FIELDS[f], answer: answer[f], ...(f === "parent" ? { accept: parents.map(name) } : {}) })),
  };
});

writeFileSync(new URL("./synthetic/people.json", import.meta.url), JSON.stringify(people, null, 1) + "\n");
console.log(`wrote ${people.length} synthetic people to evals/data/synthetic/people.json`);
