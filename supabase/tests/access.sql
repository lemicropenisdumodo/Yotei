-- Execute as postgres in a disposable database or the SQL Editor. Every fixture rolls back.
begin;
insert into auth.users(id,email,invited_at) values
 ('10000000-0000-4000-8000-000000000001','rls-a@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','rls-b@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000003','rls-c@example.invalid',now());
set constraints all immediate;
do $$ begin
 begin
 insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000004','rls-outsider@example.invalid');
 raise exception 'Unexpected signup' using errcode='XX000';
 exception when raise_exception then if sqlerrm<>'Invitation requise' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.posts(user_id,content) values(auth.uid(),'RLS transaction test');
insert into public.rooms(title,participants) values('RLS transaction test',array[auth.uid(),'10000000-0000-4000-8000-000000000002'::uuid]);
insert into public.messages(room_id,user_id,content) select id,auth.uid(),'test privé' from public.rooms where title='RLS transaction test';
do $$ begin
 begin
 insert into public.posts(user_id,content) values ('10000000-0000-4000-8000-000000000002','test');
 raise exception 'Auteur usurpé';
 exception when insufficient_privilege then null; end;
 begin
 perform public.set_suspended('10000000-0000-4000-8000-000000000002',true);
 raise exception 'Escalade de privilège' using errcode='XX000';
 exception when raise_exception then if sqlerrm<>'Accès refusé' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.messages where content='test privé')<>1 then raise exception 'Message invisible au destinataire'; end if;
 if (select count(*) from public.notifications)<>1 then raise exception 'Notification absente'; end if;
end $$;
insert into public.likes(post_id,user_id) select id,auth.uid() from public.posts where content='RLS transaction test';
insert into public.comments(post_id,user_id,content) select id,auth.uid(),'commentaire' from public.posts where content='RLS transaction test';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.messages where content='test privé') or exists(select 1 from public.rooms where title='RLS transaction test') or exists(select 1 from public.notifications) then raise exception 'Conversation accessible au tiers'; end if;
 delete from public.posts where content='RLS transaction test'; if found then raise exception 'Suppression par un tiers'; end if;
end $$;
reset role;
update public.members set suspended=true where id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.posts) or exists(select 1 from public.profiles) or exists(select 1 from public.messages) then raise exception 'Compte suspendu autorisé'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000099',true);
do $$ begin if exists(select 1 from public.profiles) then raise exception 'Non-membre autorisé'; end if;end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.posts; raise exception 'Accès anonyme';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
