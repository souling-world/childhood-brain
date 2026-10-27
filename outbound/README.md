# Outbound

Cold DMs to founders, one personal hook per lead, then a fixed pitch.

1. Put the lead list at `outbound/data/leads.csv` (columns: `platform,name_or_handle,profile_url,company,product_url,fit_reason,source_url,fit_1to5,pay_likelihood,pay_reason`, optional `recent_posts`). `outbound/data/` is gitignored because it holds real people's data.
2. `export ANTHROPIC_API_KEY=...` then `bun run outbound/hooks.ts`. It writes the hooks to `outbound/data/hooks/` using the rules in `prompt.md`, and skips leads that already have one.
3. `bun run outbound/assemble.ts` writes `outbound/data/drafts.csv` and `drafts.md`.

Each lead gets two drafts:
- `message_a`: the long pitch (hook, proof, "would you like me to help you?", "[company] is cool!", 20 min).
- `message_b`: the same pitch in 3 sentences: hook, proof, one yes/no question. This follows dra's Q4 LinkedIn notes: short messages that are clearly about the lead's problem get more replies, and on LinkedIn the reply rate now decides how much an account can send.

Rows are sorted by `active_30d` (X post date from the status id, within 30 days), then `pay_likelihood`. Send from your own ID-verified account, A to half and B to half of the first 100. Check the reply rate weekly, then keep the winner. Log "reach out later" replies in `follow_up_on` with a date.

Nothing here sends messages. Automated sending breaks LinkedIn's and X's terms and gets the account restricted.
