import {createClient} from 'npm:@supabase/supabase-js@2.99.2'
const origin='https://lemicropenisdumodo.github.io'
const redirect=origin+'/Yotei/spotify-callback.html'
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Cache-Control':'no-store'}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers})
const commands={play:'PUT',pause:'PUT',next:'POST',previous:'POST'} as const
async function tokens(params:Record<string,string>){
  return fetch('https://accounts.spotify.com/api/token',{method:'POST',body:new URLSearchParams(params),signal:AbortSignal.timeout(8000)})
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers})
  if(req.method!=='POST')return json({},405)
  const authorization=req.headers.get('Authorization')||''
  const url=Deno.env.get('SUPABASE_URL')!
  const session=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}})
  const {data:{user}}=await session.auth.getUser(authorization.replace(/^Bearer /i,''))
  if(!user)return json({},401)
  try{
    const body=await req.json(), target=body.target||user.id
    const {data:gate,error}=await session.rpc('spotify_gate',{target})
    if(error||!gate||(!gate.own && body.action!=='read'))return json({},403)
    if(!gate.client_id)return json({configured:false})
    const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const table=()=>db.from('spotify_connections')
    if(body.action==='connect'){
      if(!/^[A-Za-z0-9._~-]{43,128}$/.test(body.verifier)||typeof body.code!=='string')return json({},400)
      const response=await tokens({grant_type:'authorization_code',code:body.code,redirect_uri:redirect,code_verifier:body.verifier,client_id:gate.client_id})
      if(!response.ok)return json({error:'Connexion Spotify expirée ou refusée. Recommence la connexion.'},400)
      const t=await response.json()
      const {error}=await table().upsert({user_id:user.id,client_id:gate.client_id,access_token:t.access_token,refresh_token:t.refresh_token,expires_at:new Date(Date.now()+1000*t.expires_in).toISOString(),sharing:body.share===true})
      if(error)throw error
      return json({ok:true})
    }
    if(body.action==='disconnect'||body.action==='sharing'){
      const q=body.action==='disconnect'?table().delete():table().update({sharing:body.share===true})
      const {error}=await q.eq('user_id',user.id)
      if(error)throw error
      return json({ok:true})
    }
    if(body.action!=='read'&&!Object.hasOwn(commands,body.action))return json({},400)
    let query=table().select('*').eq('user_id',target)
    if(!gate.own)query=query.eq('sharing',true)
    const {data:row,error:readError}=await query.maybeSingle()
    if(readError)throw readError
    if(!row)return json(gate.own?{configured:true,clientId:gate.client_id,connected:false}:{track:null})
    const self=gate.own?{configured:true,connected:true,sharing:row.sharing}:{}
    let access=row.access_token
    if(Date.parse(row.expires_at)<Date.now()+30000){
      const response=await tokens({grant_type:'refresh_token',refresh_token:row.refresh_token,client_id:row.client_id})
      if(!response.ok){
        const failure=await response.json()
        if(failure.error==='invalid_grant'){
          await table().delete().eq('user_id',target).eq('refresh_token',row.refresh_token).eq('expires_at',row.expires_at)
          return json(gate.own?{configured:true,clientId:gate.client_id,connected:false}:{track:null})
        }
        throw Error()
      }
      const t=await response.json()
      const updated=await table().update({access_token:t.access_token,refresh_token:t.refresh_token||row.refresh_token,expires_at:new Date(Date.now()+1000*t.expires_in).toISOString()}).eq('user_id',target).eq('expires_at',row.expires_at).select('user_id')
      if(updated.error)throw updated.error
      if(!updated.data?.length)return json({...self,track:null})
      access=t.access_token
    }
    const command=body.action as keyof typeof commands
    const read=body.action==='read'
    const response=await fetch('https://api.spotify.com/v1/me/player'+(read?'':'/'+command),{
      method:read?'GET':commands[command],headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(8000)})
    if(response.status===429)return json({...self,track:null,retry:Math.max(30,Number(response.headers.get('retry-after'))||60),error:gate.own?'Spotify demande une pause avant la prochaine actualisation.':undefined})
    if(response.status===204)return json({...self,track:null})
    if(!response.ok){
      if(!gate.own)return json({track:null})
      return json({...self,track:null,error:response.status===404?'Ouvre Spotify et lance un morceau sur ton appareil.':response.status===403?'Spotify refuse cet accès. Vérifie le compte Premium, les utilisateurs autorisés et l’appareil de lecture.':'Lecture Spotify temporairement indisponible.'})
    }
    if(!read)return json({ok:true})
    const player=await response.json(), item=player.item
    if(!item||player.device?.is_private_session||(!gate.own&&!player.is_playing))return json({...self,track:null})
    return json({...self,playing:player.is_playing,track:{title:item.name,artist:item.artists?.map((a:{name:string})=>a.name).join(', ')||'',image:item.album?.images?.[0]?.url||'',url:item.external_urls?.spotify||''}})
  }catch{return json({error:'Service Spotify temporairement indisponible.'},502)}
})
