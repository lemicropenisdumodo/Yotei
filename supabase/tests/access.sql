-- Execute as postgres in a disposable database or the SQL Editor. Every fixture rolls back.
begin;
insert into auth.users(id,email,invited_at) values
 ('10000000-0000-4000-8000-000000000001','rls-a@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','rls-b@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000003','rls-c@example.invalid',now());
set constraints all immediate;
insert into public.push_devices(endpoint,owner_id,keys) values
 ('https://example.invalid/test-sender','10000000-0000-4000-8000-000000000001','{}'),
 ('https://example.invalid/test-recipient','10000000-0000-4000-8000-000000000002','{}');
do $$ begin
 begin
 insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000004','rls-outsider@example.invalid');
 raise exception 'Unexpected signup' using errcode='XX000';
 exception when raise_exception then if sqlerrm<>'Invitation requise' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare pet jsonb; initial int; version_before int; tz text;
begin
 select name into tz from pg_timezone_names where extract(hour from now() at time zone name)=12 limit 1;
 pet:=public.companion_care('adopt','Nonna',tz,null);
 if pet->>'model'<>'Nonna' or (pet->>'asleep')::boolean then raise exception 'Adoption invalide'; end if;
 initial:=(pet->>'food')::int;
 if initial not between 2 and 4 then raise exception 'Demande invalide'; end if;
 version_before:=(pet->>'version')::int;
 pet:=public.companion_care('feed','','UTC',version_before);
 pet:=public.companion_care('feed','','UTC',version_before);
 if (pet->>'food')::int<>initial-1 then raise exception 'Double bouchée'; end if;
 while (pet->>'food')::int>0 loop pet:=public.companion_care('feed','','UTC',(pet->>'version')::int); end loop;
 while (pet->>'mood')::int>0 loop pet:=public.companion_care('pat','','UTC',(pet->>'version')::int); end loop;
 if pet->>'streak'<>'1' or pet->>'affection'<>'1' or pet->>'best'<>'1' then raise exception 'Double récompense'; end if;
 pet:=public.companion_care('rename','Nona','UTC',(pet->>'version')::int);
 if pet->>'nickname'<>'Nona' then raise exception 'Surnom perdu'; end if;
end $$;
do $$
declare stream uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); w jsonb; first_video text; pet jsonb;
begin
 w:=public.circle_game('tap',stream,40);
 w:=public.circle_game('tap',stream,40);
 if (w->>'points')::int<>40 then raise exception 'Taps crédités en double'; end if;
 w:=public.circle_game('spin',request); first_video:=w->>'video';
 w:=public.circle_game('spin',request);
 if (w->>'points')::int<>20 or w->>'video'<>first_video then raise exception 'Débit en double'; end if;
 w:=public.circle_game('spin',gen_random_uuid());
 if (w->>'points')::int<>0 or w->>'video'=first_video then raise exception 'Doublon vidéo'; end if;
 begin perform public.circle_game('spin',gen_random_uuid()); raise exception 'Solde négatif';
 exception when raise_exception then if sqlerrm<>'Il faut 20 cœurs pour tourner.' then raise; end if; end;
 begin perform public.choose_companion_background('clicker','stars',1,true); raise exception 'Achat sans solde';
 exception when raise_exception then if sqlerrm<>'Pas assez de cœurs.' then raise; end if; end;
 w:=public.circle_game('tap',stream,65);
 begin perform public.choose_companion_background('character','clouds',0,false); raise exception 'Fond verrouillé appliqué';
 exception when raise_exception then if sqlerrm<>'Ce fond est verrouillé.' then raise; end if; end;
 w:=public.choose_companion_background('character','stars',1,true);
 w:=public.choose_companion_background('clicker','stars',2,true);
 if (w->>'points')::int<>0 or w#>>'{gallery,character}'<>'stars:1' or w#>>'{gallery,clicker}'<>'stars:2'
 or jsonb_array_length(w#>'{gallery,owned}')<>1 then raise exception 'Double achat ou sélection perdue'; end if;
 pet:=public.companion_care();
 pet:=public.companion_care('company','','UTC',(pet->>'version')::int);
 if (pet->>'food_due')::timestamptz not between now()+interval '30 minutes' and now()+interval '60 minutes'
 or (pet->>'mood_due')::timestamptz not between now()+interval '25 minutes' and now()+interval '50 minutes'
 or (pet->>'company_due')::timestamptz not between now()+interval '20 minutes' and now()+interval '45 minutes'
 then raise exception 'Délai de soin inattendu'; end if;
 if pet->>'company'<>'0' then raise exception 'Compagnie ignorée'; end if;
end $$;
insert into public.posts(source_title,category,user_id,content) values('Sans lien','Cinéma',auth.uid(),'Sans lien');
insert into public.posts(source_url,source_title,category,user_id,content) values('https://example.org/watch','Titre','Vidéo',auth.uid(),'RLS transaction test');
insert into public.posts(source_url,source_title,user_id,content,category,rating) values('https://example.org/watch','Titre',auth.uid(),'Une recommandation','Cinéma',4);
do $$ begin
 begin
 insert into public.posts(source_url,source_title,user_id,content,rating) values('https://example.org/watch','Titre',auth.uid(),'Une note sans catégorie',4);
 raise exception 'Note sans catégorie autorisée';
 exception when check_violation then null; end;
 begin
 insert into public.posts(source_url,source_title,user_id,content,category,rating) values('https://example.org/watch','Titre',auth.uid(),'Note hors limites','Musique',6);
 raise exception 'Note hors limites autorisée';
 exception when check_violation then null; end;
end $$;
do $$ begin
 update public.posts set source_title='Titre modifié',content='Texte modifié' where source_title='Sans lien';
 if not found then raise exception 'Modification personnelle refusée'; end if;
end $$;
insert into storage.objects(bucket_id,name) values('yotei-media',auth.uid()::text||'/rls-test.png');
do $$ begin
 begin
 insert into storage.objects(bucket_id,name) values('yotei-media','10000000-0000-4000-8000-000000000002/rls-test.png');
 raise exception 'Écriture dans un dossier tiers';
 exception when insufficient_privilege then null;end;
end $$;
insert into public.rooms(title,participants) values('RLS transaction test',array[auth.uid(),'10000000-0000-4000-8000-000000000002'::uuid]);
insert into public.messages(room_id,user_id,content) select id,auth.uid(),'test privé' from public.rooms where title='RLS transaction test';
do $$ begin
 begin
 insert into public.posts(source_url,source_title,category,user_id,content) values('https://example.org/watch','Titre','Vidéo','10000000-0000-4000-8000-000000000002','test');
 raise exception 'Auteur usurpé';
 exception when insufficient_privilege then null; end;
 begin
 perform public.set_suspended('10000000-0000-4000-8000-000000000002',true);
 raise exception 'Escalade de privilège' using errcode='XX000';
 exception when raise_exception then if sqlerrm<>'Accès refusé' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if public.companion_care() is not null then raise exception 'Compagnon visible à un tiers'; end if;
 if (select count(*) from public.messages where content='test privé')<>1 then raise exception 'Message invisible au destinataire'; end if;
 if not exists(select 1 from storage.objects where bucket_id='yotei-media' and name='10000000-0000-4000-8000-000000000001/rls-test.png') then raise exception 'Média du cercle invisible';end if;
 if exists(select 1 from public.member_accounts()) then raise exception 'Annuaire administratif exposé';end if;
 if (select count(*) from public.notifications)<>1 then raise exception 'Notification absente'; end if;
end $$;
do $$ begin
 begin
 insert into public.friend_requests(sender,recipient) values(auth.uid(),'10000000-0000-4000-8000-000000000001');
 raise exception 'Demandes encore actives';
 exception when insufficient_privilege then null;end;
end $$;
insert into public.friend_nicknames values(auth.uid(),'10000000-0000-4000-8000-000000000001','Surnom personnel');
do $$ begin if not exists(select 1 from public.friend_nicknames where nickname='Surnom personnel') then raise exception 'Surnom inaccessible'; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin if exists(select 1 from public.friend_nicknames) then raise exception 'Surnom visible par son destinataire';end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin
  insert into public.likes(post_id,user_id) select id,auth.uid() from public.posts where content='RLS transaction test';
  raise exception 'Like autorisé';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.comments(post_id,user_id,content) select id,auth.uid(),'test' from public.posts where content='RLS transaction test';
  raise exception 'Commentaire autorisé';
 exception when insufficient_privilege then null; end;
 update public.posts set content='Modification par un tiers' where content='RLS transaction test';
 if found then raise exception 'Modification par un tiers'; end if;
end $$;
insert into public.post_reactions(post_id,user_id,emoji) select id,auth.uid(),'👀' from public.posts where content='RLS transaction test';
update public.post_reactions set emoji='🔥' where user_id=auth.uid();
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if not exists(select from public.post_reactions where emoji='🔥') then raise exception 'Réaction invisible'; end if;
 delete from public.post_reactions where emoji='🔥'; if found then raise exception 'Réaction tierce effacée'; end if;
end $$;
do $$ begin
 if exists(select 1 from public.messages where content='test privé') or exists(select 1 from public.rooms where title='RLS transaction test') or exists(select 1 from public.notifications) then raise exception 'Conversation accessible au tiers'; end if;
 delete from public.posts where content='RLS transaction test'; if found then raise exception 'Suppression par un tiers'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.push_jobs where endpoint='https://example.invalid/test-recipient')<>3
 or exists(select from public.push_jobs where endpoint='https://example.invalid/test-sender') then
   raise exception 'Destinataires des notifications incorrects';
 end if;
end $$;
update public.members set suspended=true where id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='yotei-media') then raise exception 'Stockage visible après suspension';end if;
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
