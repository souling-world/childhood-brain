// bun run outbound/hooks.ts   -> outbound/data/hooks/hooks-api.jsonl, the personal line for every lead
// env: ANTHROPIC_API_KEY. Rules live in outbound/prompt.md, shared with any hand-written hooks.
// Optional column recent_posts in leads.csv (e.g. a scraper export of their last 3 posts, separated by " || ")
// is weighted above fit_reason. Leads that already have a hook in any hooks/*.jsonl are skipped.
import { readFileSync, readdirSync, appendFileSync, mkdirSync } from "fs";
import { parseCsv } from "./csv";

const DATA = "./outbound/data";
const MODEL = "claude-opus-5-5";
const BATCH = 20;
const RULES = readFileSync("./outbound/prompt.md", "utf8");
mkdirSync(`${DATA}/hooks`, { recursive: true });

const have = new Set<number>();
for (const f of readdirSync(`${DATA}/hooks`).filter(f => f.endsWith(".jsonl")))
  for (const line of readFileSync(`${DATA}/hooks/${f}`, "utf8").split("\n").filter(Boolean)) have.add(Number(JSON.parse(line).id));

const leads = parseCsv(readFileSync(`${DATA}/leads.csv`, "utf8"))
  .map((l, id) => ({ id, platform: l.platform, name: l.name_or_handle, company: l.company, product_url: l.product_url,
    recent_posts: l.recent_posts ?? "", post_or_job: l.fit_reason, bio_notes: l.pay_reason }))
  .filter(l => !have.has(l.id));

async function ask(batch: object[], tries = 4): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: RULES,
      messages: [{ role: "user", content: `Leads, one JSON per line. Return only the output lines.\n${batch.map(b => JSON.stringify(b)).join("\n")}` }] }),
  });
  const j: any = await r.json().catch(() => ({}));
  if ((r.status === 429 || r.status >= 500) && tries > 1) { await Bun.sleep(2000 * (5 - tries)); return ask(batch, tries - 1); }
  if (!r.ok) console.error("anthropic error", r.status, JSON.stringify(j.error ?? j));
  return j.content?.map((c: any) => c.text ?? "").join("") ?? "";
}

for (let i = 0; i < leads.length; i += BATCH) {
  const batch = leads.slice(i, i + BATCH);
  const ids = new Set(batch.map(b => b.id));
  const lines = (await ask(batch)).split("\n").map(s => s.trim()).filter(s => s.startsWith("{"));
  for (const s of lines) {
    try {
      const h = JSON.parse(s);
      if (ids.has(Number(h.id)) && h.hook && !h.hook.includes("—")) appendFileSync(`${DATA}/hooks/hooks-api.jsonl`, JSON.stringify(h) + "\n");
    } catch {}
  }
  console.log(`hooks ${Math.min(i + BATCH, leads.length)}/${leads.length}`);
}
console.log("done. Now: bun run outbound/assemble.ts");
