-- 005 · Shopping list: Skip, and retire "Not tracked"
-- Run once in Supabase → SQL Editor → New query → paste → Run.
--
-- 1. Skip: "not buying it this week". The ingredient stays off Shopping until this date, then comes back by itself.
alter table ingredients add column if not exists skip_until date;

-- 2. "Not tracked" is gone from the choices. The list already treated it exactly like Out,
--    so existing Not tracked ingredients become Out (nothing changes on the list; Pantry reads OUT instead).
update ingredients set stock_status = 'out' where stock_status = 'not_tracked';

-- 3. New ingredients (from recipes) start as Out too.
alter table ingredients alter column stock_status set default 'out';
