create table yotei_private.spotify_app (
  singleton boolean primary key default true check (singleton),
  client_id text not null check (client_id ~ '^[0-9a-f]{32}$')
);
revoke all on yotei_private.spotify_app from public,anon,authenticated;
alter table yotei_private.spotify_app enable row level security;

-- The Edge Function exclusively reads and writes credentials via the service role.
create table public.spotify_connections (
  user_id uuid primary key references public.members(id) on delete cascade,
  client_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  sharing boolean not null default true
);
alter table public.spotify_connections enable row level security;
revoke all on public.spotify_connections from public,anon,authenticated;
grant select,insert,update,delete on public.spotify_connections to service_role;

create function public.spotify_gate(target uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when yotei_private.active() and exists(select from public.members where id=target and not suspended)
    then jsonb_build_object('client_id',(select client_id from yotei_private.spotify_app),
      'own',target=auth.uid()) end
$$;
create function public.spotify_configure(app_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not yotei_private.admin() then raise exception 'Accès administrateur requis'; end if;
  insert into yotei_private.spotify_app(client_id) values(lower(trim(app_id)));
end $$;
revoke all on function public.spotify_gate(uuid), public.spotify_configure(text) from public,anon,authenticated;
grant execute on function public.spotify_gate(uuid), public.spotify_configure(text) to authenticated;
