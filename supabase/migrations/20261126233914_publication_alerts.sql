create table public.push_keys(singleton boolean primary key check(singleton), public_key text not null, private_key text not null);
create table public.push_devices(
  endpoint text primary key, owner_id uuid not null references public.members on delete cascade,
  keys jsonb not null
);
create index push_devices_owner on public.push_devices(owner_id);
create table public.push_jobs(
  ticket uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts on delete cascade,
  endpoint text not null references public.push_devices on delete cascade, owner_id uuid not null references public.members on delete cascade,
  created_at timestamptz not null default now(), next_attempt timestamptz not null default now(),
  unique(post_id,endpoint)
);
alter table public.push_keys enable row level security;
alter table public.push_devices enable row level security;
alter table public.push_jobs enable row level security;
revoke all on public.push_keys,public.push_devices,public.push_jobs from public,anon,authenticated;
grant select,insert on public.push_keys to service_role;
grant select,insert,update,delete on public.push_jobs,public.push_devices to service_role;

-- Production Supabase supplies pg_net and pg_cron; local PostgreSQL tests exercise the queue separately.
do $$ begin
 if exists(select from pg_available_extensions where name='pg_net') then create extension if not exists pg_net; end if;
 if exists(select from pg_available_extensions where name='pg_cron') then create extension if not exists pg_cron; end if;
end $$;
create function yotei_private.send_pending_pushes() returns void language plpgsql security definer set search_path='' as $$
declare job record;
begin
 delete from public.push_jobs where created_at<now()-interval '1 day';
 if to_regnamespace('net') is null then return; end if;
 for job in select ticket from public.push_jobs where next_attempt<=now() order by created_at limit 32 for update skip locked loop
   perform net.http_post(url:='https://liutzcmwbtkrfgzhyycp.supabase.co/functions/v1/publication-alerts',
      body:=jsonb_build_object('ticket',job.ticket), timeout_milliseconds:=15000);
   update public.push_jobs set next_attempt=now()+interval '5 minutes' where ticket=job.ticket;
 end loop;
end $$;
revoke all on function yotei_private.send_pending_pushes() from public,anon,authenticated;
create function yotei_private.notify_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.source_title is not null then
  insert into public.push_jobs(post_id,endpoint,owner_id)
   select new.id,d.endpoint,d.owner_id from public.push_devices d join public.members m on m.id=d.owner_id
   where d.owner_id<>new.user_id and not m.suspended and not exists(
     select from yotei_private.maintenance where enabled and owner_id<>d.owner_id);
  if found then
    begin perform yotei_private.send_pending_pushes();
    exception when others then raise warning 'Yotei push delivery deferred'; end;
  end if;
 end if;
 return new;
end $$;
revoke all on function yotei_private.notify_publication() from public,anon,authenticated;
create trigger notify_publication after insert on public.posts for each row execute function yotei_private.notify_publication();
do $$ begin
 if to_regnamespace('cron') is not null then
  perform cron.schedule('yotei-push-retry','*/5 * * * *','select yotei_private.send_pending_pushes()');
 end if;
end $$;
