// Every brain answers through one interface: brain.query(person_facts, question) -> answer.
// Pick one with a string, the way the Vertex eval SDK takes any model id:
//   baseline          most common answer for the field across everyone else (the floor)
//   nearest           the 5 people whose known answers overlap most vote (a deterministic matcher)
//   llm[:model]       Claude reads the facts and picks an option (ANTHROPIC_API_KEY)
//   cmd:<command>     bring your own brain: gets {facts, question} as JSON on stdin, prints the answer
export type Fact = { id: string; type: string; question: string; options: string[]; answer: string; accept?: string[] };
export type Person = { id: string; childhood?: unknown; facts: Fact[] };
export type Question = { id: string; type: string; question: string; options: string[] };
export type Brain = { name: string; query(facts: Fact[], q: Question, self: string): Promise<string> };

const tally = (answers: string[], opts: string[]) => {
  const c = Object.fromEntries(opts.map(o => [o, 0]));
  for (const a of answers) if (a in c) c[a]++;
  return opts.reduce((a, b) => (c[b] > c[a] ? b : a));
};

export function makeBrain(spec: string, population: Person[]): Brain {
  // population brains never see the person being scored: `self` is left out
  const others = (self: string) => population.filter(p => p.id !== self);
  const answerOf = (p: Person, id: string) => p.facts.find(f => f.id === id)?.answer;

  if (spec === "baseline") return {
    name: spec,
    async query(_facts, q, self) { return tally(others(self).map(p => answerOf(p, q.id)!).filter(Boolean), q.options); },
  };

  if (spec === "nearest") return {
    name: spec,
    async query(facts, q, self) {
      const ranked = others(self).map(p => [facts.filter(f => answerOf(p, f.id) === f.answer).length, p] as const).sort((a, b) => b[0] - a[0]);
      return tally(ranked.slice(0, 5).map(([, p]) => answerOf(p, q.id)!).filter(Boolean), q.options);
    },
  };

  if (spec === "llm" || spec.startsWith("llm:")) {
    const model = spec.slice(4) || "claude-sonnet-4-6";
    return { name: spec, query: (facts, q) => limit(() => claude(model, prompt(facts, q))) };
  }

  if (spec.startsWith("cmd:")) {
    const cmd = spec.slice(4);
    return {
      name: spec,
      async query(facts, q) {
        const p = Bun.spawn(["sh", "-c", cmd], { stdin: new TextEncoder().encode(JSON.stringify({ facts, question: q })), stdout: "pipe", stderr: "inherit" });
        return (await new Response(p.stdout).text()).trim();
      },
    };
  }

  throw new Error(`unknown brain "${spec}" (baseline | nearest | llm[:model] | cmd:<command>)`);
}

const prompt = (facts: Fact[], q: Question) => `Here is what is known about one person.
${facts.map(f => `- ${f.question} ${f.answer}`).join("\n")}

${q.question}
${q.options.map(o => `- ${o}`).join("\n")}

Answer with exactly one option, copied verbatim, and nothing else.`;

// a few calls in flight at once, so 429s stay rare
let active = 0; const waiting: (() => void)[] = [];
async function limit<T>(f: () => Promise<T>, max = Number(process.env.CONCURRENCY ?? 4)): Promise<T> {
  if (active >= max) await new Promise<void>(r => waiting.push(r));
  active++;
  try { return await f(); } finally { active--; waiting.shift()?.(); }
}

async function claude(model: string, content: string, tries = 4): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 50, messages: [{ role: "user", content }] }),
  });
  const j: any = await r.json().catch(() => ({}));
  if ((r.status === 429 || r.status >= 500) && tries > 1) { await Bun.sleep(2000 * (5 - tries)); return claude(model, content, tries - 1); }
  if (!r.ok) console.error("anthropic error", r.status, JSON.stringify(j.error ?? j));
  return j.content?.map((c: any) => c.text ?? "").join("").trim() ?? "";
}
