alter table public.posts
  drop constraint posts_category_check,
  add constraint posts_category_check check (category in ('Cinéma','Musique','Vidéo','Jeux vidéo')),
  add column source_url text,
  add column source_title text,
  add column thumbnail_url text,
  add constraint recommendation_fields check (
    category is not null and category in ('Cinéma','Musique','Vidéo')
    and source_url is not null and source_url ~ '^https://[^[:space:]]+$' and length(source_url) <= 2048
    and source_title is not null and length(trim(source_title)) between 1 and 300
    and (thumbnail_url is null or (thumbnail_url like 'https://%' and length(thumbnail_url) <= 2048))
  ) not valid;
grant select(source_url,source_title,thumbnail_url), insert(source_url,source_title,thumbnail_url) on public.posts to authenticated;
