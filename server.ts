// bun run server.ts  -> http://localhost:3000
// POST /match {query, base}  -> nearest childhood page via gbrain
// POST /person {name, picks} -> writes brain/people/<name>.md (the person's LoRA) and returns its path
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";

// gbrain 0.59, keyless PGLite (gbrain init --pglite --no-embedding). Edit here if your version differs (gbrain search --help).
// search --json prints an array of {slug, title, type, chunk_text, score}; the seed pages match too, so ask for
// more than we need and let index.html keep the childhood pages.
const QUERY_CMD = (q: string) => ["gbrain", "search", q, "--json", "--limit", "20"];
const SYNC_CMD = ["gbrain", "import", "./brain", "--no-embed"];

async function gquery(q: string) {
  try {
    const p = Bun.spawn(QUERY_CMD(q), { stdout: "pipe", stderr: "pipe" });
    const [txt, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    try { return JSON.parse(txt); } catch { return { raw: txt, err }; }
  } catch (e) {
    return { raw: "", err: `could not run ${QUERY_CMD("").slice(0, 2).join(" ")}: ${e}` };
  }
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
        // links are path slugs (parents/parent-x); the questioner compares bare seed slugs
        const links = [...md.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].split("/").pop()!);
        const body = md.split("\n# ")[1]?.split("\n## Links")[0]?.split("\n").slice(1).join("\n").trim() ?? "";
        // base: frontmatter when the page carries it, else the city in the title parens
        const base = md.match(/^base: (.+)$/m)?.[1].trim().replace(/^["'](.*)["']$/, "$1") ?? md.match(/^title: .*\((.+)\)$/m)?.[1] ?? "unknown";
        return { slug: f.replace(".md", ""), base, links, body };
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
      const slug = `person-${slugify(name) || "you"}`;
      const dir = (s: string) => s.startsWith("parent-") ? "parents" : s.startsWith("school-") ? "schools" : "events";
      // no slug: line, gbrain derives it from the path (people/person-x)
      const md = `---\ntype: person\ntitle: ${JSON.stringify(name)}\n---\n# ${name}\n\nSeven moments that explain ${name}.\n\n## Adapter\n${picks.map((p: any) => `- [[${dir(p.slug)}/${p.slug}]] ${p.name}`).join("\n")}\n`;
      mkdirSync("./brain/people", { recursive: true });
      writeFileSync(`./brain/people/${slug}.md`, md);
      try { Bun.spawn(SYNC_CMD, { stdout: "ignore", stderr: "ignore" }); } catch {} // let gbrain pick it up in the background
      return Response.json({ path: `brain/people/${slug}.md`, md });
    }
    return new Response("not found", { status: 404 });
  },
});
console.log("tap loop on http://localhost:3000");
