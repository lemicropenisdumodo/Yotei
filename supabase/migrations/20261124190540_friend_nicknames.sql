create table public.friend_nicknames (
 owner_id uuid not null,
 friend_id uuid not null,
 nickname text not null check (length(btrim(nickname)) between 1 and 40),
 primary key (owner_id,friend_id),
 foreign key (owner_id,friend_id) references public.friend_requests(sender,recipient) on delete cascade,
 foreign key (friend_id,owner_id) references public.friend_requests(sender,recipient) on delete cascade
);
alter table public.friend_nicknames enable row level security;
revoke all on public.friend_nicknames from public,anon,authenticated;
grant select,insert,update,delete on public.friend_nicknames to authenticated;
create policy own_nicknames on public.friend_nicknames for all to authenticated
 using (owner_id=(select auth.uid()) and (select yotei_private.active()))
 with check (owner_id=(select auth.uid()) and (select yotei_private.active()));
