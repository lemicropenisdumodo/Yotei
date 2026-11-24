-- Keep nicknames and their owner-only policies when retiring mutual requests.
alter table public.friend_nicknames
 drop constraint friend_nicknames_friend_id_owner_id_fkey,
 drop constraint friend_nicknames_owner_id_friend_id_fkey,
 add foreign key(owner_id) references public.members(id) on delete cascade,
 add foreign key(friend_id) references public.members(id) on delete cascade,
 add check(owner_id <> friend_id);
alter policy own_nicknames on public.friend_nicknames
 with check(owner_id=(select auth.uid()) and (select yotei_private.active())
 and exists(select 1 from public.members m where m.id=friend_id and not m.suspended));
revoke all on public.friend_requests from authenticated,anon,public;
revoke insert(sender,recipient) on public.friend_requests from authenticated;
