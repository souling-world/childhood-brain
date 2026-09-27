// bun run generate.ts            -> writes seed pages + N generated childhoods into ./brain
// env: ANTHROPIC_API_KEY, N (default 60), BASE (default "United States")
import seeds from "./seeds.json";
import { mkdirSync, writeFileSync } from "fs";

const N = Number(process.env.N ?? 60);
const BASE = process.env.BASE ?? "United States";
const MODEL = "claude-sonnet-4-6";
const out = "./brain";
for (const d of ["parents","schools","events","childhoods","people"]) mkdirSync(`${out}/${d}`, { recursive: true });

const page = (type: string, slug: string, name: string, body: string, links: string[] = []) =>
`---
type: ${type}
slug: ${slug}
title: ${name}
---
# ${name}

${body}

${links.length ? "## Links\n" + links.map(l => `- [[${l}]]`).join("\n") : ""}
`;

// 1. seed pages (the taste layer, edit seeds.json to change them)
for (const p of seeds.parents) writeFileSync(`${out}/parents/${p.slug}.md`, page("parent", p.slug, p.name, p.text));
for (const s of seeds.schools) writeFileSync(`${out}/schools/${s.slug}.md`, page("school", s.slug, s.name, s.text));
for (const e of seeds.events) writeFileSync(`${out}/events/${e.slug}.md`, page("event", e.slug, e.name, e.text));

// 2. childhood = parent1 + parent2 + school + 3..5 events, concatenated, then written as one vivid fragment
const pick = <T,>(a: T[], k: number) => [...a].sort(() => Math.random() - 0.5).slice(0, k);

async function write(prompt: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await r.json();
  return j.content?.map((c: any) => c.text ?? "").join("") ?? "";
}

const jobs = Array.from({ length: N }, async (_, i) => {
  const [p1, p2] = pick(seeds.parents, 2);
  const [school] = pick(seeds.schools, 1);
  const events = pick(seeds.events, 3 + Math.floor(Math.random() * 3));
  const slug = `childhood-${String(i + 1).padStart(3, "0")}`;
  const prompt = `Write a 140-word second-person childhood fragment set in the ${BASE}. No names, no dates, no em dashes, concrete sensory detail, one quiet line at the end that lands.
Parent one: ${p1.name}. ${p1.text}
Parent two: ${p2.name}. ${p2.text}
School: ${school.name}. ${school.text}
Life-changing events, in order: ${events.map(e => `${e.name} (${e.text})`).join(" | ")}
Return only the fragment.`;
  const body = await write(prompt);
  const links = [p1.slug, p2.slug, school.slug, ...events.map(e => e.slug)];
  writeFileSync(`${out}/childhoods/${slug}.md`, page("childhood", slug, `Childhood ${i + 1} (${BASE})`, body.trim(), links));
  console.log("wrote", slug);
});
await Promise.all(jobs);
console.log(`done: ${N} childhoods in ${out}/childhoods. Now: gbrain sync ${out}   (check gbrain --help for the exact ingest command)`);
