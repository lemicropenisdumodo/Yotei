// Test-only PostgreSQL instance with the baseline tables and Supabase role interfaces.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const db = new PGlite()
const root = new URL('../supabase/', import.meta.url)
const sql = (relative) => fs.readFileSync(new URL(relative, root), 'utf8')
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage; grant usage on schema auth,storage to anon,authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table auth.users(id uuid primary key,email text,last_sign_in_at timestamptz,invited_at timestamptz);
create table public.profiles(id uuid primary key references auth.users,username text unique,bio text,avatar_url text,banner_url text,theme_color text,created_at timestamptz default now());
create table public.posts(id uuid primary key default gen_random_uuid(),user_id uuid references profiles,content text,image_url text,created_at timestamptz default now());
create table public.comments(id uuid primary key default gen_random_uuid(),user_id uuid references profiles,post_id uuid references posts,content text,created_at timestamptz default now());
create table public.likes(post_id uuid references posts,user_id uuid references profiles,primary key(post_id,user_id));
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,name text,bucket_id text);
alter table storage.objects enable row level security; grant select,insert,delete on storage.objects to authenticated; create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
create publication supabase_realtime;`)
for (const t of ['profiles', 'posts', 'comments', 'likes']) {
  await db.exec(
    'create policy baseline_read on ' +
      t +
      ' for select to authenticated using(true)',
  )
  const owner = t === 'profiles' ? 'id' : 'user_id'
  await db.exec(
    'create policy baseline_insert on ' +
      t +
      ' for insert to authenticated with check(auth.uid()=' +
      owner +
      ')',
  )
  if (t !== 'profiles')
    await db.exec(
      'create policy baseline_delete on ' +
        t +
        ' for delete to authenticated using(auth.uid()=' +
        owner +
        ')',
    )
}
for (const name of fs.readdirSync(new URL('migrations/', root)).sort())
  await db.exec(sql('migrations/' + name))
await db.exec(sql('tests/access.sql'))
await db.close()
console.log('Migration et scénarios RLS validés en PostgreSQL local.')
