import {createClient} from 'npm:@supabase/supabase-js@2.99.2'
import webpush from 'npm:web-push@3.6.7'

const origin='https://lemicropenisdumodo.github.io'
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Cache-Control':'no-store'}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers})
const url=Deno.env.get('SUPABASE_URL')!
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
function validEndpoint(value:unknown){
  if(typeof value!=='string'||value.length>2048)return false
  try{
    const u=new URL(value)
    return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(
      ['fcm.googleapis.com','web.push.apple.com','updates.push.services.mozilla.com','push.services.mozilla.com'].includes(u.hostname)
      ||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'))
  }catch{return false}
}
async function keys(){
  const table=service.from('push_keys')
  const current=await table.select('public_key,private_key').eq('singleton',true).maybeSingle().throwOnError()
  if(current.data)return current.data
  const pair=webpush.generateVAPIDKeys()
  const inserted=await table.insert({singleton:true,public_key:pair.publicKey,private_key:pair.privateKey})
  if(inserted.error && inserted.error.code!=='23505')throw Error('keys')
  return (await table.select('public_key,private_key').eq('singleton',true).single().throwOnError()).data!
}
async function deliver(ticket:string){
  const job=(await service.from('push_jobs').select('owner_id,endpoint,post_id').eq('ticket',ticket).maybeSingle().throwOnError()).data
  if(!job)return reply({},404)
  const [device,post,member]=await Promise.all([
    service.from('push_devices').select('keys').eq('endpoint',job.endpoint).eq('owner_id',job.owner_id).maybeSingle().throwOnError(),
    service.from('posts').select('source_title,user_id').eq('id',job.post_id).maybeSingle().throwOnError(),
    service.from('members').select('suspended').eq('id',job.owner_id).maybeSingle().throwOnError()
  ])
  if(device.data&&post.data?.source_title&&member.data&&!member.data.suspended&&validEndpoint(job.endpoint)){
    const {data:author}=await service.from('profiles').select('username').eq('id',post.data.user_id).maybeSingle()
    const pair=await keys()
    const request=webpush.generateRequestDetails({endpoint:job.endpoint,keys:device.data.keys},JSON.stringify({
      post:job.post_id,title:(author?.username||'Un ami')+' a publié une recommandation',body:post.data.source_title
    }),{TTL:86400,vapidDetails:{subject:origin+'/Yotei/',publicKey:pair.public_key,privateKey:pair.private_key}})
    const sent=await fetch(job.endpoint,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:AbortSignal.timeout(9000)})
    if(sent.status===404||sent.status===410)await service.from('push_devices').delete().eq('endpoint',job.endpoint).eq('owner_id',job.owner_id).throwOnError()
    else if(!sent.ok)return reply({},503)
  }
  await service.from('push_jobs').delete().eq('ticket',ticket).throwOnError()
  return reply({ok:true})
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers})
  if(req.method!=='POST')return reply({},405)
  try{
    const body=await req.json()
    if(typeof body.ticket==='string'&&/^[0-9a-f-]{36}$/i.test(body.ticket))return await deliver(body.ticket)
    const token=req.headers.get('Authorization')
    if(!token)return reply({},401)
    const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:token}}})
    const {data:{user}}=await client.auth.getUser(token.replace(/^Bearer /i,''))
    if(!user)return reply({},401)
    const member=(await client.from('members').select('id').eq('id',user.id).eq('suspended',false).maybeSingle()).data
    if(!member)return reply({},403)
    if(body.action==='key')return reply({publicKey:(await keys()).public_key})
    const endpoint=body.subscription?.endpoint
    if(!validEndpoint(endpoint))return reply({},400)
    const table=service.from('push_devices')
    if(body.action==='remove')await table.delete().eq('endpoint',endpoint).eq('owner_id',user.id).throwOnError()
    else if(body.action==='subscribe'){
      const {p256dh,auth}=body.subscription.keys||{}
      if(!/^[A-Za-z0-9_-]{87}$/.test(p256dh)||!/^[A-Za-z0-9_-]{22}$/.test(auth))return reply({},400)
      await table.upsert({owner_id:user.id,endpoint,keys:{p256dh,auth}}).throwOnError()
    }else return reply({},400)
    return reply({ok:true})
  }catch{return reply({error:'Notifications temporairement indisponibles.'},503)}
})
