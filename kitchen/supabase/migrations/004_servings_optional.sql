-- Up next batch (B-39): servings is optional.
alter table recipes alter column servings drop not null;
alter table recipes drop constraint if exists recipes_servings_check;
alter table recipes add constraint recipes_servings_check check (servings is null or servings > 0);

-- Clear the placeholder "serves 4" the Notion import gave every recipe.
-- The import added ~260 recipes within a few minutes, so "imported" = created in the busiest hour
-- (plus the hour either side, in case it crossed a boundary). Recipes you added yourself keep their number.
with batch as (
  select date_trunc('hour', created_at) as h from recipes group by 1 order by count(*) desc limit 1
)
update recipes set servings = null
where servings = 4
  and created_at >= (select h from batch) - interval '1 hour'
  and created_at <  (select h from batch) + interval '2 hours';
