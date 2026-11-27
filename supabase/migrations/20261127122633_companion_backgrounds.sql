alter table yotei_private.wallets
  add column motifs text[] not null default '{}',
  add column character_skin text not null default 'plain',
  add column clicker_skin text not null default 'plain';

create function yotei_private.motif_prices() returns jsonb language sql immutable set search_path='' as $$
 select '{"stars":25,"clouds":40,"waves":60,"mesh":80,"blossoms":100}'::jsonb
$$;
revoke all on function yotei_private.motif_prices() from public,anon,authenticated;

create or replace function public.circle_game(action text default 'read', request_id uuid default null, taps bigint default 0)
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
     if wallet.points<price then raise exception 'Il faut 20 cœurs pour tourner.'; end if;
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
 return jsonb_build_object('points',wallet.points,'version',wallet.version,'video',coalesce(chosen,wallet.last_video),'price',price,
   'gallery',jsonb_build_object('owned',wallet.motifs,'prices',yotei_private.motif_prices(),
   'character',wallet.character_skin,'clicker',wallet.clicker_skin));
end $$;

create function public.choose_companion_background(surface text, motif text, palette integer, purchase boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); w yotei_private.wallets; cost integer; skin text;
begin
 if uid is null or not yotei_private.active() then raise exception 'Accès membre requis'; end if;
 if not exists(select from yotei_private.companions where owner_id=uid) then raise exception 'Choisis ton personnage.'; end if;
 if surface is null or surface not in ('character','clicker') or motif is null or palette is null or palette not between 0 and 3 then raise exception 'Choix invalide'; end if;
 cost:=(yotei_private.motif_prices()->>motif)::int;
 if motif<>'plain' and cost is null then raise exception 'Motif inconnu'; end if;
 insert into yotei_private.wallets(owner_id) values(uid) on conflict do nothing;
 select * into strict w from yotei_private.wallets where owner_id=uid for update;
 if motif<>'plain' and not motif=any(w.motifs) then
   if purchase is not true then raise exception 'Ce fond est verrouillé.'; end if;
   if w.points<cost then raise exception 'Pas assez de cœurs.'; end if;
   w.motifs:=array_append(w.motifs,motif); w.points:=w.points-cost;
 end if;
 skin:=case when motif='plain' then motif else motif||':'||palette end;
 update yotei_private.wallets set points=w.points, motifs=w.motifs, version=version+1,
   character_skin=case when surface='character' then skin else character_skin end,
   clicker_skin=case when surface='clicker' then skin else clicker_skin end
 where owner_id=uid;
 return public.circle_game('read');
end $$;
revoke all on function public.choose_companion_background(text,text,int,boolean) from public,anon;
grant execute on function public.choose_companion_background(text,text,int,boolean) to authenticated;

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
      pet.company:=0; pet.company_due:=now()+interval '1 minute'*(20+random()*25); changed:=true; completed:=true;
    elsif action='feed' and not asleep and pet.food>0 then
      pet.food:=pet.food-1; changed:=true;
      if pet.food=0 then pet.food_due:=now()+interval '1 minute'*(30+random()*30); completed:=true; end if;
    elsif action='pat' and not asleep and pet.mood>0 then
      pet.mood:=pet.mood-1; changed:=true;
      if pet.mood=0 then pet.mood_due:=now()+interval '1 minute'*(25+random()*25); completed:=true; end if;
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


-- Bring long outstanding waits into the new ranges without delaying a need already due.
update yotei_private.companions set
  food_due=case when food_due>now()+interval '1 hour' then now()+interval '1 minute'*(30+random()*30) else food_due end,
  mood_due=case when mood_due>now()+interval '50 minutes' then now()+interval '1 minute'*(25+random()*25) else mood_due end,
  company_due=case when company_due>now()+interval '45 minutes' then now()+interval '1 minute'*(20+random()*25) else company_due end
where food_due>now()+interval '1 hour' or mood_due>now()+interval '50 minutes' or company_due>now()+interval '45 minutes';
