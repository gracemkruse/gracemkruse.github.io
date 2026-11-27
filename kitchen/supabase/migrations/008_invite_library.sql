alter table invites add column if not exists with_library boolean not null default false;
alter table invites add column if not exists with_meals boolean not null default false;
alter table profiles add column if not exists seeded_at timestamptz;
update profiles set seeded_at = now() where seeded_at is null;
update profiles set onboarded_at = now() where onboarded_at is null;
