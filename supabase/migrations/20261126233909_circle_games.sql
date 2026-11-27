create table public.post_reactions (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references public.members on delete cascade,
  emoji text not null check (emoji in ('❤️','🔥','👀')),
  primary key (post_id,user_id)
);
alter table public.post_reactions enable row level security;
revoke all on public.post_reactions from public,anon,authenticated;
grant select, insert(post_id,user_id,emoji), update(emoji), delete on public.post_reactions to authenticated;
create policy reaction_read on public.post_reactions for select to authenticated using ((select yotei_private.active()));
create policy reaction_add on public.post_reactions for insert to authenticated with check
  ((select yotei_private.active()) and user_id=(select auth.uid()) and exists(select from public.posts p where p.id=post_id and p.source_title is not null));
create policy reaction_edit on public.post_reactions for update to authenticated using
  ((select yotei_private.active()) and user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy reaction_remove on public.post_reactions for delete to authenticated using
  ((select yotei_private.active()) and user_id=(select auth.uid()));

create table yotei_private.wallets (
  owner_id uuid primary key references public.members on delete cascade,
  points bigint not null default 0 check(points>=0),
  version bigint not null default 0, seen text[] not null default '{}', last_video text
);
create table yotei_private.tap_streams (
  owner_id uuid references yotei_private.wallets on delete cascade,
  stream_id uuid, taps bigint not null, primary key(owner_id,stream_id)
);
create table yotei_private.spins (
  owner_id uuid references yotei_private.wallets on delete cascade,
  request_id uuid, video text not null, primary key(owner_id,request_id)
);
create table yotei_private.roulette_videos (video text primary key);
revoke all on yotei_private.wallets,yotei_private.tap_streams,yotei_private.spins,yotei_private.roulette_videos from public,authenticated,anon;
alter table yotei_private.wallets enable row level security;
alter table yotei_private.tap_streams enable row level security;
alter table yotei_private.spins enable row level security;
alter table yotei_private.roulette_videos enable row level security;

create function public.circle_game(action text default 'read', request_id uuid default null, taps bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid(); wallet yotei_private.wallets; previous bigint; chosen text; pool text[];
 price constant integer := 20;
begin
 if not yotei_private.active() then raise exception 'Accès membre requis'; end if;
 insert into yotei_private.wallets(owner_id) values(uid) on conflict do nothing;
 select * into strict wallet from yotei_private.wallets where owner_id=uid for update;
 if action='tap' then
   if request_id is null or taps not between 1 and 2000000000 then raise exception 'Compteur invalide'; end if;
   if not exists(select from yotei_private.companions where owner_id=uid) then raise exception 'Choisis ton personnage.'; end if;
   select s.taps into previous from yotei_private.tap_streams s where s.owner_id=uid and s.stream_id=request_id;
   if taps>coalesce(previous,0) then
     insert into yotei_private.tap_streams values(uid,request_id,taps) on conflict(owner_id,stream_id) do update set taps=excluded.taps;
     wallet.points:=wallet.points+taps-coalesce(previous,0);
     wallet.version:=wallet.version+1;
   end if;
 elsif action='spin' then
   if request_id is null then raise exception 'Tirage invalide'; end if;
   select s.video into chosen from yotei_private.spins s where s.owner_id=uid and s.request_id=circle_game.request_id;
   if chosen is null then
     if wallet.points<price then raise exception 'Il faut 20 points pour tourner.'; end if;
     select array_agg(video) into pool from yotei_private.roulette_videos where not(video=any(wallet.seen));
     if pool is null then
       wallet.seen:='{}';
       select array_agg(video) into pool from yotei_private.roulette_videos where video is distinct from wallet.last_video;
     end if;
     if pool is null then raise exception 'Sélection indisponible.'; end if;
     chosen:=pool[1+floor(random()*cardinality(pool))::int];
     wallet.seen:=array_append(wallet.seen,chosen); wallet.last_video:=chosen;
     wallet.points:=wallet.points-price; wallet.version:=wallet.version+1;
     insert into yotei_private.spins values(uid,request_id,chosen);
   end if;
 elsif action<>'read' then raise exception 'Action inconnue';
 end if;
 if action<>'read' then
   update yotei_private.wallets set points=wallet.points,version=wallet.version,seen=wallet.seen,last_video=wallet.last_video where owner_id=uid;
 end if;
 return jsonb_build_object('points',wallet.points,'version',wallet.version,'video',coalesce(chosen,wallet.last_video),'price',price);
end $$;
revoke all on function public.circle_game(text,uuid,bigint) from public,anon;
grant execute on function public.circle_game(text,uuid,bigint) to authenticated;

alter table yotei_private.companions add column company int not null default 1, add column company_due timestamptz;
create or replace function public.companion_care(action text default 'read', detail text default '', zone_name text default 'UTC', expected int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  pet yotei_private.companions;
  uid uuid := auth.uid();
  local_now timestamp;
  today date;
  bedtime int;
  asleep boolean;
  changed boolean := false;
  completed boolean := false;
begin
  if uid is null or not yotei_private.active() then raise exception 'Accès membre requis'; end if;
  if action='adopt' then
    if not exists(select 1 from pg_timezone_names where name=zone_name) then raise exception 'Fuseau inconnu'; end if;
    insert into yotei_private.companions(owner_id,model,zone) values(uid,detail,zone_name) on conflict do nothing;
  end if;
  select * into pet from yotei_private.companions where owner_id=uid for update;
  if not found then return null; end if;
  local_now := now() at time zone pet.zone;
  today := local_now::date;
  bedtime := 22*60+mod(abs(hashtext(uid::text||today::text)::bigint),60);
  asleep := local_now::time < time '07:00' or local_now::time >= make_time(bedtime/60,bedtime%60,0);
  if not asleep and pet.food_due<=now() then
    pet.food := 2+floor(random()*3)::int; pet.food_due := null; changed := true;
  end if;
  if not asleep and pet.mood_due<=now() then
    pet.mood := 2+floor(random()*3)::int; pet.mood_due := null; changed := true;
  end if;
  if not asleep and pet.company_due<=now() then
    pet.company:=1; pet.company_due:=null; changed:=true;
  end if;
  if expected=pet.version then
    if action='rename' then pet.nickname:=trim(detail); changed:=true;
    elsif action='company' and not asleep and pet.company>0 then
      pet.company:=0; pet.company_due:=now()+interval '1 hour'*(2+random()*3); changed:=true; completed:=true;
    elsif action='feed' and not asleep and pet.food>0 then
      pet.food:=pet.food-1; changed:=true;
      if pet.food=0 then pet.food_due:=now()+interval '1 hour'*(2+random()*2); completed:=true; end if;
    elsif action='pat' and not asleep and pet.mood>0 then
      pet.mood:=pet.mood-1; changed:=true;
      if pet.mood=0 then pet.mood_due:=now()+interval '1 hour'*(2+random()*2); completed:=true; end if;
    end if;
  end if;
  if completed and not today=any(pet.days) then
    pet.streak:=case when today-1=any(pet.days) then pet.streak+1 else 1 end;
    pet.best:=greatest(pet.streak,pet.best);
    pet.affection:=pet.affection+1;
    pet.days:=array(select d from unnest(pet.days||today) d where d>=today-6 order by d);
  end if;
  if changed then
    pet.version:=pet.version+1;
    update yotei_private.companions set company=pet.company,company_due=pet.company_due,nickname=pet.nickname, food=pet.food,mood=pet.mood,
      food_due=pet.food_due,mood_due=pet.mood_due,days=pet.days,streak=pet.streak,
      best=pet.best,affection=pet.affection,version=pet.version where owner_id=uid;
  end if;
  return (to_jsonb(pet)-'owner_id') || jsonb_build_object('today',today,'asleep',asleep,'streak',
    case when today=any(pet.days) or today-1=any(pet.days) then pet.streak else 0 end);
end $$;

insert into yotei_private.roulette_videos(video) values
('XCZlx9bt1G4'),
('wFo6SiJOdaA'),
('mAK97i57th8'),
('k6OvOT3s6EU'),
('VBKwmc3s6Ts'),
('nL7g22DIwX8'),
('6Zt4O2jJOjc'),
('g29Hyn2xwiM'),
('2AsE4FAI_5w'),
('6Lb6W8uxCkM'),
('iQB-0fu5QPs'),
('sDULmmJ-VZc'),
('yA2J2kXGODs'),
('YqMJvUEgFLc'),
('15q0bGw3p_w'),
('C7t5FdLBvtk'),
('Tud4YsNxuPM'),
('3GSH37__hDY'),
('cobKo9MHXRk'),
('DG2DiSWjJyA'),
('YNMl9aIoaeE');
