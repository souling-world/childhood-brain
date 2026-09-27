// bun run server.ts  -> http://localhost:3000
// POST /match {query, base}  -> nearest childhood page via gbrain
// POST /person {name, picks} -> writes brain/people/<name>.md (the person's LoRA) and returns its path
import { writeFileSync, readFileSync, existsSync } from "fs";

// edit these two lines if your gbrain version uses different flags (run: gbrain query --help)
const QUERY_CMD = (q: string) => ["gbrain", "search", q, "--json", "--limit", "3"];
const SYNC_CMD = ["gbrain", "import", "./brain"];

async function gquery(q: string) {
  const p = Bun.spawn(QUERY_CMD(q), { stdout: "pipe", stderr: "pipe" });
  const txt = await new Response(p.stdout).text();
  const err = await new Response(p.stderr).text();
  try { return JSON.parse(txt); } catch { return { raw: txt, err }; }
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") return new Response(readFileSync("./index.html"), { headers: { "content-type": "text/html" } });
    if (req.method === "GET" && url.pathname === "/seeds.json") return new Response(readFileSync("./seeds.json"), { headers: { "content-type": "application/json" } });
    if (req.method === "GET" && url.pathname === "/childhoods.json") {
      // slug -> list of linked slugs, read from the generated pages so the questioner can split the repertoire
      const { readdirSync } = await import("fs");
      const dir = "./brain/childhoods";
      const rows = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".md")).map(f => {
        const md = readFileSync(`${dir}/${f}`, "utf8");
        const links = [...md.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
        const body = md.split("\n# ")[1]?.split("\n## Links")[0]?.split("\n").slice(1).join("\n").trim() ?? "";
        return { slug: f.replace(".md", ""), base: /Lima/.test(md.split("\n")[3] ?? "") ? "Lima, Peru" : "United States", links, body };
      }) : [];
      return Response.json(rows);
    }
    if (req.method === "POST" && url.pathname === "/match") {
      const { query, base } = await req.json();
      const q = base ? `${query} childhood in ${base}` : query;
      return Response.json(await gquery(q));
    }
    if (req.method === "POST" && url.pathname === "/person") {
      const { name, picks } = await req.json(); // picks: array of {slug, name}
      const slug = `person-${slugify(name)}`;
      const md = `---\ntype: person\nslug: ${slug}\ntitle: ${name}\n---\n# ${name}\n\nSeven moments that explain ${name}.\n\n## Adapter\n${picks.map((p: any) => `- [[${p.slug}]] ${p.name}`).join("\n")}\n`;
      writeFileSync(`./brain/people/${slug}.md`, md);
      Bun.spawn(SYNC_CMD); // let gbrain pick it up in the background
      return Response.json({ path: `brain/people/${slug}.md`, md });
    }
    return new Response("not found", { status: 404 });
  },
});
console.log("tap loop on http://localhost:3000");
