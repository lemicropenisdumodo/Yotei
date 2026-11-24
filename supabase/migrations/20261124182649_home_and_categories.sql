alter table public.profiles add column wallpaper_path text;
alter table public.posts add column category text check (category in ('Cinéma','Musique','Jeux vidéo')),
  add column rating smallint check (rating is null or (rating between 1 and 5 and category is not null));
grant update(wallpaper_path) on public.profiles to authenticated;
grant insert(category,rating) on public.posts to authenticated;
-- Retire the guestbook without deleting existing entries.
revoke select on public.guestbook from authenticated;
revoke insert(recipient,user_id,content) on public.guestbook from authenticated;
