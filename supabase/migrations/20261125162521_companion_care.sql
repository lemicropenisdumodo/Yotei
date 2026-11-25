create table yotei_private.companions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  model text not null check(model in ('Nonna','Rias','Tsunade')),
  nickname text not null default '' check(length(nickname)<=28),
  zone text not null,
  food int not null default (2+floor(random()*3)::int),
  mood int not null default (2+floor(random()*3)::int),
  food_due timestamptz, mood_due timestamptz,
  days date[] not null default '{}', streak int not null default 0,
  best int not null default 0, affection int not null default 0,
  version int not null default 1
);
alter table yotei_private.companions enable row level security;
revoke all on yotei_private.companions from public, anon, authenticated;

create function public.companion_care(action text default 'read', detail text default '', zone_name text default 'UTC', expected int default null)
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
  if expected=pet.version then
    if action='rename' then pet.nickname:=trim(detail); changed:=true;
    elsif action='feed' and not asleep and pet.food>0 then
      pet.food:=pet.food-1; changed:=true;
      if pet.food=0 then pet.food_due:=now()+interval '1 hour'*(4+random()*3); completed:=true; end if;
    elsif action='pat' and not asleep and pet.mood>0 then
      pet.mood:=pet.mood-1; changed:=true;
      if pet.mood=0 then pet.mood_due:=now()+interval '1 hour'*(3+random()*3); completed:=true; end if;
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
    update yotei_private.companions set nickname=pet.nickname, food=pet.food,mood=pet.mood,
      food_due=pet.food_due,mood_due=pet.mood_due,days=pet.days,streak=pet.streak,
      best=pet.best,affection=pet.affection,version=pet.version where owner_id=uid;
  end if;
  return (to_jsonb(pet)-'owner_id') || jsonb_build_object('today',today,'asleep',asleep,'streak',
    case when today=any(pet.days) or today-1=any(pet.days) then pet.streak else 0 end);
end $$;
revoke all on function public.companion_care(text,text,text,int) from public, anon;
grant execute on function public.companion_care(text,text,text,int) to authenticated;
