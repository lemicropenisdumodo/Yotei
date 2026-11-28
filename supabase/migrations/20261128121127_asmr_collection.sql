-- The rarity belongs to the recording. Retired French entries have no collection card.
alter table yotei_private.roulette_videos add column rarity text
  check (rarity in ('Rare','Épique','Légendaire'));
update yotei_private.roulette_videos set in_rotation=false;
insert into yotei_private.roulette_videos(video,rarity,in_rotation) values
 ('nL7g22DIwX8','Épique',true),
 ('6Zt4O2jJOjc','Rare',false),
 ('g29Hyn2xwiM','Épique',true),
 ('2AsE4FAI_5w','Épique',true),
 ('6Lb6W8uxCkM','Rare',false),
 ('iQB-0fu5QPs','Rare',true),
 ('sDULmmJ-VZc','Épique',true),
 ('yA2J2kXGODs','Légendaire',true),
 ('YqMJvUEgFLc','Rare',false),
 ('15q0bGw3p_w','Rare',false),
 ('C7t5FdLBvtk','Rare',false),
 ('Tud4YsNxuPM','Épique',false),
 ('3GSH37__hDY','Épique',false),
 ('cobKo9MHXRk','Rare',false),
 ('DG2DiSWjJyA','Épique',true),
 ('YNMl9aIoaeE','Rare',false),
 ('KujHGTFnELA','Rare',true),
 ('CADwHvRnq3U','Épique',true),
 ('2CLVoXJiTqY','Légendaire',true),
 ('mxSUTfPgIts','Épique',false),
 ('w_O6bZo1rVU','Légendaire',true),
 ('3WVYaQ44FSk','Épique',true),
 ('HXPEXGwQz84','Rare',true),
 ('ZtZaZvAePO4','Rare',true),
 ('HeCSMKuvmvM','Rare',true),
 ('_k9T0PBwkpQ','Rare',true),
 ('qkJfF9fIyjE','Légendaire',true),
 ('SHNtU3MK3W8','Légendaire',true)
on conflict(video) do update set rarity=excluded.rarity, in_rotation=excluded.in_rotation;
alter table yotei_private.roulette_videos add check (not in_rotation or rarity is not null);

alter table public.profiles add column show_asmr boolean not null default false;
grant update(show_asmr) on public.profiles to authenticated;

create function public.asmr_discoveries(target uuid) returns table(video text)
language sql stable security definer set search_path='' as $$
  select distinct s.video from yotei_private.spins s
  join yotei_private.roulette_videos v on v.video=s.video
  join public.profiles p on p.id=s.owner_id
  join public.members m on m.id=p.id
  where s.owner_id=target and yotei_private.active() and not m.suspended
    and (target=auth.uid() or p.show_asmr) and v.rarity is not null
  order by s.video
$$;
revoke all on function public.asmr_discoveries(uuid) from public,anon;
grant execute on function public.asmr_discoveries(uuid) to authenticated;

create or replace function public.circle_game(action text default 'read', request_id uuid default null, taps bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid(); wallet yotei_private.wallets; previous bigint; chosen text; pool text[];
 price constant integer := 250;
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
     if wallet.points<price then raise exception 'Il faut % cœurs pour tourner.',price; end if;
     select array_agg(video) into pool from yotei_private.roulette_videos where in_rotation and not(video=any(wallet.seen));
     if pool is null then
       wallet.seen:='{}';
       select array_agg(video) into pool from yotei_private.roulette_videos where in_rotation and video is distinct from wallet.last_video;
     end if;
     if pool is null then raise exception 'Sélection indisponible.'; end if;
     -- Weighted sampling without replacement within the current collection cycle.
     select video into strict chosen from yotei_private.roulette_videos where video=any(pool)
       order by -ln(1-random()) / case rarity when 'Rare' then 6 when 'Épique' then 3 else 1 end
       limit 1;
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
