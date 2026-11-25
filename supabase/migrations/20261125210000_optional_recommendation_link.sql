alter table public.posts
  drop constraint recommendation_fields,
  add constraint recommendation_fields check (
    category is not null and category in ('Cinéma','Musique','Vidéo')
    and (source_url is null or (source_url ~ '^https://[^[:space:]]+$' and length(source_url) <= 2048))
    and source_title is not null and length(trim(source_title)) between 1 and 300
    and (thumbnail_url is null or (thumbnail_url like 'https://%' and length(thumbnail_url) <= 2048))
  ) not valid;
