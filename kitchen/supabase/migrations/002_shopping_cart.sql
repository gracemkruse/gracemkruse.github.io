-- Slice 3 (Shopping List): remember which ingredients are checked off ("in the cart").
alter table ingredients add column if not exists in_cart boolean not null default false;
