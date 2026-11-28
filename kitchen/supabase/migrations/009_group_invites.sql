alter table invites add column if not exists max_uses int not null default 1;
alter table invites add column if not exists uses int not null default 0;
alter table invites drop constraint if exists invites_group_ok;
alter table invites add constraint invites_group_ok check (max_uses between 1 and 10 and (max_uses = 1 or not with_library));
create table if not exists invite_joins (
  code       text not null references invites on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  name       text,
  joined_at  timestamptz not null default now(),
  primary key (code, user_id)
);
alter table invite_joins enable row level security;
drop policy if exists "see joins on own invites" on invite_joins;
create policy "see joins on own invites" on invite_joins for select using (exists (select 1 from invites i where i.code = invite_joins.code and i.created_by = auth.uid()));
create or replace function stop_invite(c text) returns void language sql security definer set search_path = public as $$
  update invites set expires_at = now() where code = c and created_by = auth.uid() and expires_at > now();
$$;
revoke all on function stop_invite(text) from public, anon;
grant execute on function stop_invite(text) to authenticated;
