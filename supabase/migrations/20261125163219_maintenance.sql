create table yotei_private.maintenance (
  singleton boolean primary key default true check(singleton),
  owner_id uuid not null references auth.users(id),
  enabled boolean not null default false
);
-- Only bind an unambiguous administrator. No row means maintenance is off.
insert into yotei_private.maintenance(owner_id,enabled)
select id,false from public.members where admin and not suspended
and (select count(*) from public.members where admin and not suspended)=1;
revoke all on yotei_private.maintenance from public, anon, authenticated;
alter table yotei_private.maintenance enable row level security;

create function public.maintenance_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',exists(select from yotei_private.maintenance where enabled),'owner',exists(
    select 1 from public.members m where m.id in (select owner_id from yotei_private.maintenance) and m.id=auth.uid() and m.admin and not m.suspended
  ))
$$;
create function public.set_maintenance(requested boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  update yotei_private.maintenance s set enabled=requested
  where singleton and exists(select 1 from public.members m where m.id=s.owner_id and m.id=auth.uid() and m.admin and not m.suspended);
  if not found then raise exception 'Accès réservé au propriétaire'; end if;
end $$;
revoke all on function public.maintenance_status(), public.set_maintenance(boolean) from public,anon,authenticated;
grant execute on function public.maintenance_status() to anon,authenticated;
grant execute on function public.set_maintenance(boolean) to authenticated;

create or replace function yotei_private.active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members m
   where m.id=auth.uid() and not m.suspended and not exists(select from yotei_private.maintenance s where s.enabled and (s.owner_id<>m.id or not m.admin)))
$$;
create or replace function yotei_private.admin() returns boolean language sql stable security definer set search_path='' as $$
 select yotei_private.active() and exists(select 1 from public.members m where m.id=auth.uid() and m.admin)
$$;
create or replace function public.heartbeat() returns void language sql security definer set search_path='' as $$
 update public.members set last_seen=now() where id=auth.uid() and yotei_private.active()
$$;
