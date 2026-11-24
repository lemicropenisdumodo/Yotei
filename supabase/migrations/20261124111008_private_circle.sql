-- Baseline inspected on 2026-11-24: twelve owner/read policies on the four existing tables.
create schema yotei_private;
revoke all on schema yotei_private from public;
grant usage on schema yotei_private to authenticated;
create table yotei_private.bootstrap (email text primary key);

create table public.members (
 id uuid primary key references auth.users on delete cascade,
 admin boolean not null default false, suspended boolean not null default false,
 last_seen timestamptz, joined_at timestamptz not null default now()
);
alter table public.profiles add column music text not null default '';
create function yotei_private.active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members where id=(select auth.uid()) and not suspended)
$$;
create function yotei_private.admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members where id=(select auth.uid()) and admin and not suspended)
$$;
create function public.can_bootstrap(target_email text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from yotei_private.bootstrap where email=lower(trim(target_email))) and not exists(select 1 from public.members where admin)
$$;
revoke all on function public.can_bootstrap(text) from public, anon, authenticated;
grant execute on function public.can_bootstrap(text) to service_role;

-- GoTrue can populate invited_at after INSERT in the same transaction.
create function yotei_private.admit() returns trigger language plpgsql security definer set search_path='' as $$
declare address text; owner_account boolean;
begin
 select lower(email) into address from auth.users where id=new.id and invited_at is not null;
 if address is null then raise exception 'Invitation requise'; end if;
 delete from yotei_private.bootstrap where email=address;
 owner_account := found;
 insert into public.members(id,admin) values(new.id,owner_account);
 insert into public.profiles(id,username) values(new.id,'ami-' || new.id::text);
 return null;
end $$;
create constraint trigger yotei_invitation after insert on auth.users deferrable initially deferred for each row execute function yotei_private.admit();

create table public.friend_requests (
 sender uuid references public.members on delete cascade, recipient uuid references public.members on delete cascade,
 primary key(sender,recipient), check(sender<>recipient)
);
create table public.guestbook (
 id uuid primary key default gen_random_uuid(), recipient uuid not null references public.members on delete cascade,
 user_id uuid not null references public.members on delete cascade, content text not null check(length(trim(content)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create table public.rooms (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title)<=80),
 participants uuid[] not null check(cardinality(participants) between 2 and 20), created_at timestamptz not null default now()
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms on delete cascade,
 user_id uuid not null references public.members on delete cascade,
 content text not null check(length(trim(content)) between 1 and 4000), created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), recipient uuid not null references public.members on delete cascade,
 room_id uuid not null references public.rooms on delete cascade, created_at timestamptz not null default now()
);
create index on public.notifications(recipient,created_at desc);
create index on public.messages(room_id,created_at desc);
create index on public.posts(created_at desc);
create index on public.comments(post_id,created_at);
create index on public.guestbook(recipient,created_at desc);
create index on public.friend_requests(recipient);
create function yotei_private.notify_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(recipient,room_id)
 select m.id,new.room_id from public.rooms r join public.members m on m.id=any(r.participants)
 where r.id=new.room_id and m.id<>new.user_id and not m.suspended;
 return new;
end $$;
create trigger notify_message after insert on public.messages for each row execute function yotei_private.notify_message();

do $$
declare t text;
begin
 foreach t in array array['profiles','posts','comments','likes','members','friend_requests','guestbook','rooms','messages','notifications'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy active_members on public.%I as restrictive for all to authenticated using ((select yotei_private.active())) with check ((select yotei_private.active()))',t);
 end loop;
end $$;
grant update(username,bio,theme_color,avatar_url,banner_url,music) on public.profiles to authenticated;
grant insert(user_id,content,image_url) on public.posts to authenticated;
grant insert(post_id,user_id,content) on public.comments to authenticated;
grant insert(post_id,user_id) on public.likes to authenticated;
grant delete on public.posts,public.comments,public.likes,public.notifications,public.friend_requests to authenticated;
create policy moderation on public.posts for delete to authenticated using ((select yotei_private.admin()));
create policy read_members on public.members for select to authenticated using(true);
create function public.set_suspended(member_id uuid, value boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not yotei_private.admin() then raise exception 'Accès refusé'; end if;
 update public.members set suspended=value where id=member_id and not admin;
 if not found then raise exception 'Membre introuvable ou protégé'; end if;
end $$;
create function public.heartbeat() returns void language sql security definer set search_path='' as $$
 update public.members set last_seen=now() where id=(select auth.uid()) and not suspended
$$;
grant insert(sender,recipient) on public.friend_requests to authenticated;
create policy my_requests on public.friend_requests for select to authenticated using(true);
create policy send_request on public.friend_requests for insert to authenticated with check(sender=(select auth.uid()));
create policy cancel_request on public.friend_requests for delete to authenticated using((select auth.uid()) in (sender,recipient));
grant insert(recipient,user_id,content) on public.guestbook to authenticated;
create policy read_guestbook on public.guestbook for select to authenticated using(true);
create policy sign_guestbook on public.guestbook for insert to authenticated with check(user_id=(select auth.uid()));
grant insert(title,participants) on public.rooms to authenticated;
create policy room_read on public.rooms for select to authenticated using((select auth.uid())=any(participants));
create function yotei_private.valid_room(ids uuid[]) returns boolean language sql stable security invoker set search_path='' as $$
 select count(*)=cardinality(ids) from public.members where not suspended and id=any(ids)
$$;
create policy start_room on public.rooms for insert to authenticated with check((select auth.uid())=any(participants) and yotei_private.valid_room(participants));
grant insert(room_id,user_id,content) on public.messages to authenticated;
create policy read_chat on public.messages for select to authenticated using(exists(select 1 from public.rooms where id=room_id));
create policy send_chat on public.messages for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.rooms where id=room_id));
create policy my_notifications on public.notifications for select to authenticated using(recipient=(select auth.uid()));
create policy clear_notifications on public.notifications for delete to authenticated using(recipient=(select auth.uid()));
alter publication supabase_realtime add table public.messages,public.notifications;
revoke execute on all functions in schema yotei_private from public,anon,authenticated;
grant execute on function yotei_private.active(),yotei_private.admin(),yotei_private.valid_room(uuid[]) to authenticated;
revoke execute on function public.set_suspended(uuid,boolean),public.heartbeat() from public,anon;
grant execute on function public.set_suspended(uuid,boolean),public.heartbeat() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('yotei-media','yotei-media',false,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
create policy circle_media_read on storage.objects for select to authenticated using(bucket_id='yotei-media' and (select yotei_private.active()));
create policy circle_media_write on storage.objects for insert to authenticated with check(bucket_id='yotei-media' and (select yotei_private.active()) and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy circle_media_remove on storage.objects for delete to authenticated using(bucket_id='yotei-media' and (select yotei_private.active()) and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Administrative labels stay invisible to other members.
create function public.member_accounts()
returns table(member_id uuid, email text, pending boolean)
language sql stable security definer set search_path='' as $$
 select u.id,u.email::text,u.last_sign_in_at is null
 from auth.users u join public.members m on m.id=u.id
 where (select yotei_private.admin())
$$;
revoke all on function public.member_accounts() from public,anon;
grant execute on function public.member_accounts() to authenticated;
grant select on public.members to service_role;
