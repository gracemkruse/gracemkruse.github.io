-- Kitchen app — database schema (Supabase / Postgres)
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Every row belongs to an owner (the signed-in household account), and
-- Row Level Security makes sure an account can only ever see its own rows.

create extension if not exists "pgcrypto";

-- ---------- Lookup tables (editable data, not hard-coded) ----------

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  name_norm   text generated always as (lower(trim(name))) stored,
  icon        text,
  sort        int  not null default 0,
  unique (owner_id, name_norm)
);

create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  name_norm   text generated always as (lower(trim(name))) stored,
  sort        int  not null default 0,
  unique (owner_id, name_norm)
);

create table if not exists units (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  name_norm   text generated always as (lower(trim(name))) stored,
  unique (owner_id, name_norm)
);

-- ---------- Ingredients (de-duplicated by normalized name) ----------

create table if not exists ingredients (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null,
  name_norm     text generated always as (lower(trim(name))) stored,
  category_id   uuid references categories on delete set null,
  icon          text,
  stock_status  text not null default 'not_tracked'
                check (stock_status in ('in_stock','low','out','not_tracked')),
  created_at    timestamptz not null default now(),
  unique (owner_id, name_norm)
);

-- ---------- Recipes ----------

create table if not exists recipes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users on delete cascade,
  title          text not null,
  image_url      text,
  servings       int  not null check (servings > 0),
  total_minutes  int  check (total_minutes is null or total_minutes > 0),
  steps          text[] not null default '{}',
  notes          text,
  source_url     text,
  source_notes   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz            -- soft delete: archived recipes are hidden, never destroyed
);

create table if not exists recipe_tags (
  recipe_id   uuid not null references recipes on delete cascade,
  tag_id      uuid not null references tags on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (recipe_id, tag_id)
);

create table if not exists recipe_ingredients (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users on delete cascade,
  recipe_id      uuid not null references recipes on delete cascade,
  ingredient_id  uuid not null references ingredients on delete restrict,
  amount         numeric,
  unit           text,
  prep           text,
  position       int not null default 0
);

-- ---------- This Week (slice 2) ----------

create table if not exists meal_plan (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  plan_date   date not null,
  recipe_id   uuid not null references recipes on delete restrict,
  status      text not null default 'planned' check (status in ('planned','made','skipped')),
  created_at  timestamptz not null default now()
);

-- ---------- Shopping List extras: hand-added items (slice 3) ----------

create table if not exists shopping_extras (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  category_id  uuid references categories on delete set null,
  in_cart      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- Helpful indexes ----------

create index if not exists recipes_owner_active on recipes (owner_id) where archived_at is null;
create index if not exists recipe_ingredients_recipe on recipe_ingredients (recipe_id, position);
create index if not exists meal_plan_owner_date on meal_plan (owner_id, plan_date);

-- ---------- Keep updated_at fresh ----------

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists recipes_touch on recipes;
create trigger recipes_touch before update on recipes for each row execute function touch_updated_at();

-- ---------- Row Level Security: owner-only access on every table ----------

do $$
declare t text;
begin
  foreach t in array array['categories','tags','units','ingredients','recipes','recipe_tags','recipe_ingredients','meal_plan','shopping_extras']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "owner access" on %I', t);
    execute format('create policy "owner access" on %I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;
