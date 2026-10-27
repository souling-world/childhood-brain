// bun run outbound/assemble.ts   -> outbound/data/drafts.csv + drafts.md, one DM per lead
// reads outbound/data/leads.csv and every outbound/data/hooks/*.jsonl ({id, first_name, company, hook, intensity})
// The pitch is fixed here; only the hook, name, company and closing phrase vary per lead.
// message_a is the long pitch; message_b is the same pitch in dra's 3-sentence shape (proof line + 1 yes/no question).
// Send B and A to separate halves on LinkedIn first: reply rate now sets how much an account can send.
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { parseCsv, toCsv } from "./csv";

const DATA = "./outbound/data";
const PHRASE: Record<number, string> = { 1: "is cool", 2: "is really onto something", 3: "is gonna be a big company" };

const message = (h: any) =>
`Hey ${h.first_name}! ${h.hook}

I've scaled products for founders like you before: 30,000+ paying customers, and I did product insight for Zach Yadegari, founder of Cal AI and Persona (9-figure valuation).

Would you like me to help you? ${h.company} ${PHRASE[h.intensity] ?? PHRASE[1]}! We'll figure out scaling in 20 min.`;

const messageB = (h: any) =>
`${h.first_name}, ${lower(h.hook)} I've scaled a product to 30,000+ paying customers and did product insight for Zach Yadegari at Cal AI (9-figure valuation). Open to 20 min on how we'd scale ${h.company === "What you're building" ? "yours" : h.company}?`;
const lower = (s: string) => /^[A-Z][a-z]/.test(s) && !/^(I|I'm|I've)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

// X status ids are snowflakes, so the post date comes free: ms = (id >> 22) + twitter epoch.
// "posted in the last 30 days" is dra's non-negotiable filter; LinkedIn rows here carry no post, so they stay unknown.
const TODAY = Date.now();
const postDate = (url: string) => {
  const id = url.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/)?.[1];
  return id ? new Date(Number((BigInt(id) >> 22n) + 1288834974657n)) : null;
};

const leads = parseCsv(readFileSync(`${DATA}/leads.csv`, "utf8"));
const hooks = new Map<number, any>();
for (const f of readdirSync(`${DATA}/hooks`).filter(f => f.endsWith(".jsonl")))
  for (const line of readFileSync(`${DATA}/hooks/${f}`, "utf8").split("\n").filter(Boolean)) {
    const h = JSON.parse(line);
    hooks.set(Number(h.id), h);
  }

const rows = leads.map((l, id) => {
  const d = postDate(l.source_url);
  const days = d ? Math.floor((TODAY - d.getTime()) / 864e5) : null;
  return { id, ...l, h: hooks.get(id), post_date: d?.toISOString().slice(0, 10) ?? "", active: days === null ? "unknown" : days <= 30 ? "yes" : "no" };
});
const missing = rows.filter(r => !r.h).map(r => r.id);
if (missing.length) console.error(`no hook for ${missing.length} leads: ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ", ..." : ""}`);

// active first, then best leads, so the top of the file is where you start sending
const rank = { yes: 0, unknown: 1, no: 2 } as Record<string, number>;
const done = rows.filter(r => r.h).sort((a, b) => rank[a.active] - rank[b.active] || Number(b.pay_likelihood) - Number(a.pay_likelihood) || Number(b.fit_1to5) - Number(a.fit_1to5));
const out = done.map(r => ({
  id: r.id, platform: r.platform, name: r.name_or_handle, profile_url: r.profile_url, company: r.h.company,
  intensity: r.h.intensity, pay_likelihood: r.pay_likelihood, fit_1to5: r.fit_1to5, active_30d: r.active, post_date: r.post_date,
  source_url: r.source_url, message_a: message(r.h), message_b: messageB(r.h), variant_sent: "", sent: "", replied: "", follow_up_on: "",
}));
writeFileSync(`${DATA}/drafts.csv`, toCsv(out));
writeFileSync(`${DATA}/drafts.md`, out.map(o => `## ${o.name} (${o.platform}, pay ${o.pay_likelihood}, active ${o.active_30d})\n${o.profile_url}\n\n**A**\n\n${o.message_a}\n\n**B**\n\n${o.message_b}\n`).join("\n"));
console.log(`wrote ${out.length} drafts to ${DATA}/drafts.csv and drafts.md`);
