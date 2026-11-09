-- Disinfo Desk: allow category 'satire' on gt_headlines.
-- Run this yourself. The app was not pointed at Supabase for this change.
--
-- Existing categories observed in the app: top, politics, weird, us, world, tech,
-- sports, entertainment, pop-culture. The new id is satire.
--
-- The check constraint's name is not in the repo. This finds the CHECK on
-- gt_headlines whose definition already lists pop-culture, drops it, and adds
-- one that includes satire.

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'gt_headlines'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%pop-culture%'
    AND pg_get_constraintdef(con.oid) ILIKE '%category%';
  IF cname IS NULL THEN
    RAISE EXCEPTION 'No category check constraint found on public.gt_headlines';
  END IF;
  EXECUTE format('ALTER TABLE public.gt_headlines DROP CONSTRAINT %I', cname);
END $$;

ALTER TABLE public.gt_headlines
  ADD CONSTRAINT gt_headlines_category_check
  CHECK (category IN (
    'top', 'politics', 'weird', 'us', 'world', 'tech',
    'sports', 'entertainment', 'pop-culture', 'satire'
  ));

-- ---------------------------------------------------------------------------
-- RPCs. The function bodies are not in this repo. Behavior below is inferred
-- from how the Next.js app calls them (lib/db.ts) and from the README note
-- that gt_fix_ingest_filter drops bad rows instead of failing the batch.
--
-- gt_ingest(p_key text, p_items jsonb) -> integer
--   The app posts up to 1500 rows: id, title, link, source, category, image,
--   ts, outlets, breaking. category is the lead outlet's desk, so satire
--   jokes are sent as category "satire" with breaking false and outlets 0
--   (they do not count as clearance). Assumption: the function allow-lists
--   category the same way the table check did, and a disallowed category is
--   dropped as a bad row (the rest of the batch is kept). After the table
--   check above, update that allow-list inside gt_ingest so satire rows are
--   stored for search. Do not replace the function from this file; edit the
--   live definition and add 'satire' next to 'pop-culture'.
--
-- gt_search(p_q text, p_limit integer)
--   The search page shows every row the RPC returns and badges category
--   "satire". No SQL change. Satire in search is intended.
--
-- gt_trending(p_limit integer)
--   Home and /trending render this list as the hard-news heat ranking.
--   The app also drops category "satire" before render. The RPC should do
--   the same so a joke's votes cannot occupy a trending slot that a news
--   story would have filled. Assumption: the function reads gt_headlines
--   and does not already exclude a desk. Add this predicate to its
--   gt_headlines filter:
--
--     AND h.category <> 'satire'
--
--   If the headline alias is not h, use the alias in the current function.
-- ---------------------------------------------------------------------------
