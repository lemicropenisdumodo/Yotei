create or replace function yotei_private.motif_prices() returns jsonb language sql immutable set search_path='' as $$
 select '{"stars":350,"clouds":600,"waves":1000,"mesh":1500,"blossoms":2200}'::jsonb
$$;

alter table yotei_private.roulette_videos add column in_rotation boolean not null default true;
update yotei_private.roulette_videos set in_rotation=false where video in ('YqMJvUEgFLc', '15q0bGw3p_w', 'C7t5FdLBvtk', 'Tud4YsNxuPM', '3GSH37__hDY', 'cobKo9MHXRk', 'YNMl9aIoaeE');
insert into yotei_private.roulette_videos(video) values
 ('KujHGTFnELA'),
 ('CADwHvRnq3U'),
 ('2CLVoXJiTqY'),
 ('mxSUTfPgIts'),
 ('w_O6bZo1rVU'),
 ('3WVYaQ44FSk'),
 ('HXPEXGwQz84'),
 ('ZtZaZvAePO4');

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
