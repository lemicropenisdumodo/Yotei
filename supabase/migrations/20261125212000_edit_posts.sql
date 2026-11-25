grant update (source_title,content) on public.posts to authenticated;
create policy edit_own_recommendation on public.posts for update to authenticated
using ((select yotei_private.active()) and user_id=(select auth.uid()) and source_title is not null)
with check ((select yotei_private.active()) and user_id=(select auth.uid()) and source_title is not null);

create policy retired_likes on public.likes as restrictive for all to authenticated using(false) with check(false);
create policy retired_comments on public.comments as restrictive for all to authenticated using(false) with check(false);
