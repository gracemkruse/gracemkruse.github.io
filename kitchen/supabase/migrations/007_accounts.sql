-- 007 · Accounts: profiles, invites, and a daily limit on AI recipe reading
-- Run once in Supabase → SQL Editor. (Paste without these comment lines if the editor complains.)

-- One profile per person. Only you can see or change your own.
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  birth_year    int check (birth_year is null or birth_year between 1900 and 2100),
  gender        text,
  onboarded_at  timestamptz,
  can_invite    boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table profiles enable row level security;
drop policy if exists "own profile" on profiles;
drop policy if exists "read own profile" on profiles;
drop policy if exists "make own profile" on profiles;
drop policy if exists "change own profile" on profiles;
create policy "read own profile" on profiles for select using (id = auth.uid());
create policy "make own profile" on profiles for insert with check (id = auth.uid() and can_invite = false);
create policy "change own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- nobody can give themselves invite rights from the app (only Grace, here in the SQL Editor)
create or replace function guard_can_invite() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and new.can_invite is distinct from old.can_invite then
    raise exception 'can_invite can only be changed by the owner';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_can_invite on profiles;
create trigger profiles_guard_can_invite before update on profiles for each row execute function guard_can_invite();

-- Invite links. Only people allowed to invite can make them; each works once and lasts 14 days.
create table if not exists invites (
  code        text primary key default replace(replace(rtrim(encode(gen_random_bytes(9), 'base64'), '='), '+', '-'), '/', '_'),
  created_by  uuid not null default auth.uid() references auth.users on delete cascade,
  name        text,
  used_by     uuid references auth.users on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz not null default now() + interval '14 days',
  created_at  timestamptz not null default now()
);
alter table invites enable row level security;
drop policy if exists "see own invites" on invites;
drop policy if exists "make invites" on invites;
drop policy if exists "cancel own invites" on invites;
create policy "see own invites" on invites for select using (created_by = auth.uid());
create policy "make invites" on invites for insert with check (created_by = auth.uid() and exists (select 1 from profiles p where p.id = auth.uid() and p.can_invite));
create policy "cancel own invites" on invites for delete using (created_by = auth.uid() and used_by is null);

-- AI recipe reading per person per day (only the server functions read or write this).
create table if not exists ai_usage (
  user_id  uuid not null references auth.users on delete cascade,
  day      date not null default current_date,
  count    int  not null default 0,
  primary key (user_id, day)
);
alter table ai_usage enable row level security;

-- The existing household account (kitchen@gracekruse.com) gets a profile and can invite.
insert into profiles (id, display_name, can_invite, onboarded_at)
select id, 'Grace', true, now() from auth.users where email = 'kitchen@gracekruse.com'
on conflict (id) do update set can_invite = true;
