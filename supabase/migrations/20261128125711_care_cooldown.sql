alter table yotei_private.companions add column care_ready_at timestamptz;

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
  care_applied boolean := false;
  care_ready boolean;
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
  care_ready := not asleep and (pet.care_ready_at is null or pet.care_ready_at<=clock_timestamp());
  if expected=pet.version then
    if action='rename' then pet.nickname:=trim(detail); changed:=true;
    elsif action='company' and care_ready and pet.company>0 then
      care_applied:=true; pet.company:=0; pet.company_due:=now()+interval '1 minute'*(20+random()*25); changed:=true; completed:=true;
    elsif action='feed' and care_ready and pet.food>0 then
      care_applied:=true; pet.food:=pet.food-1; changed:=true;
      if pet.food=0 then pet.food_due:=now()+interval '1 minute'*(30+random()*30); completed:=true; end if;
    elsif action='pat' and care_ready and pet.mood>0 then
      care_applied:=true; pet.mood:=pet.mood-1; changed:=true;
      if pet.mood=0 then pet.mood_due:=now()+interval '1 minute'*(25+random()*25); completed:=true; end if;
    end if;
  end if;
  if care_applied then pet.care_ready_at:=clock_timestamp()+interval '3 seconds'; end if;
  if completed and not today=any(pet.days) then
    pet.streak:=case when today-1=any(pet.days) then pet.streak+1 else 1 end;
    pet.best:=greatest(pet.streak,pet.best);
    pet.affection:=pet.affection+1;
    pet.days:=array(select d from unnest(pet.days||today) d where d>=today-6 order by d);
  end if;
  if changed then
    pet.version:=pet.version+1;
    update yotei_private.companions set care_ready_at=pet.care_ready_at,company=pet.company,company_due=pet.company_due,nickname=pet.nickname, food=pet.food,mood=pet.mood,
      food_due=pet.food_due,mood_due=pet.mood_due,days=pet.days,streak=pet.streak,
      best=pet.best,affection=pet.affection,version=pet.version where owner_id=uid;
  end if;
  return (to_jsonb(pet)-'owner_id') || jsonb_build_object(
    'care_applied',care_applied,
    'care_wait_ms',greatest(0,ceil(extract(epoch from (pet.care_ready_at-clock_timestamp()))*1000)),
    'today',today,'asleep',asleep,'streak',
    case when today=any(pet.days) or today-1=any(pet.days) then pet.streak else 0 end);
end $$;
