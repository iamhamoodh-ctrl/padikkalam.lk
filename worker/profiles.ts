import {all,json,published,toMeta} from "./study-api";

export async function publicId(value:string){
 const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode("padikkalam:contributor:"+value)));
 return [...bytes].map(n=>n.toString(16).padStart(2,"0")).join("");
}
const handlePattern=/^[a-z][a-z0-9_]{2,23}$/;
type Profile={key:string;handle:string;name:string;bio:string;school:string;batch:string;picture:string;revision:string};
const validText=(v:unknown,max:number)=>typeof v==="string"&&v.length<=max;
function summary(p:Profile){const {picture,...profile}=p;return {...profile,avatar:!!picture};}
export async function profileApi(req:Request,b:R2Bucket,path:string[],user:string){
 const me=user?await publicId(user):"",own=path[1]==="me", method=req.method;
 if(own&&!user)return json({error:"Sign in to create your student profile."},401);
 let key=own?me:path[1];
 if(!own&&!/^[a-f0-9]{64}$/.test(key||"")){
  if(!handlePattern.test(key||""))return json({error:"Profile not found."},404);
  key=await (await b.get("username/"+key))?.text()||"";
 }
 if(!key)return json({error:"Profile not found."},404);
 const location="profile/"+key,object=await b.get(location),p=object?await object.json<Profile>():null;
 if(method==="GET"&&path[2]==="avatar"){
  if(!p?.picture)return json({error:"Picture unavailable."},404);
  return new Response(Uint8Array.from(atob(p.picture),c=>c.charCodeAt(0)),{headers:{"Content-Type":"image/jpeg","X-Content-Type-Options":"nosniff","Cache-Control":"private,max-age=300"}});
 }
 if(method==="GET"){
  const [notes,edges,badges]=await Promise.all([all(b,"note/"),all(b,"social-follow/"),all(b,"verification/")]);
  const mine:any[]=[];
  const keys=new Map<string,string>();
  for(const n of notes.filter(published)){let author=keys.get(n.owner);if(!author){author=await publicId(n.owner);keys.set(n.owner,author)}if(author===key)mine.push(n)}
  if(!p&&!mine.length&&!own)return json({error:"Profile unavailable."},404);
  const badge=mine.length?badges.find(v=>v.owner===mine[0].owner):own?badges.find(v=>v.owner===user):undefined;
  return json({profile:p?summary(p):null,key,display:badge?.verified?badge.name:mine[0]?.author||"Student",verified:!!badge?.verified,own:key===me,following:edges.filter(e=>e.from===key).length,followers:edges.filter(e=>e.id===key).length,followed:edges.some(e=>e.from===me&&e.id===key),notes:mine.map(n=>({id:n.id,title:n.title,subject:n.subject,format:n.format,medium:n.medium}))});
 }
 if(method!=="PUT"||!own)return json({error:"Profile editing requires your own account."},403);
 if(Number(req.headers.get("content-length"))>185000)return json({error:"Choose a smaller picture."},413);
 const v:any=await req.json(),handle=String(v.handle||"").trim().toLowerCase(),name=String(v.name||"").trim(),batch=String(v.batch||"");
 if(!handlePattern.test(handle)||handle==="me"||/^[a-f0-9]{64}$/.test(handle)||!name||name.length>48||!validText(v.school,80)||!validText(v.bio,150)||(batch!==""&&(!/^\d{4}$/.test(batch)||+batch<1950||+batch>new Date().getFullYear()+10)))return json({error:"Check your username, display name, school and batch year."},400);
 if(p&&handle!==p.handle)return json({error:"This profile already has a permanent username."},400);
 if((p?.revision||"")!==v.revision)return json({error:"Your profile changed. Reload before saving."},409);
 const picture=v.picture===undefined?(p?.picture||""):v.picture;
 if(typeof picture!=="string"||picture.length>160000||picture&&(!picture.startsWith("/9j/")||!/^[A-Za-z0-9+/]+={0,2}$/.test(picture)||picture.length%4!==0))return json({error:"Use a smaller JPEG profile picture."},400);
 const index="username/"+handle;
 if(!p){const claimed=await b.put(index,me,{onlyIf:{etagDoesNotMatch:"*"}});if(!claimed&&await (await b.get(index))?.text()!==me)return json({error:"That username is already in use."},409)}
 const next:Profile={key:me,handle,name,bio:v.bio.trim(),school:v.school.trim(),batch,picture,revision:crypto.randomUUID()};
 const preview={key:me,handle,name,avatar:!!picture,revision:next.revision};
 const saved=await b.put(location,JSON.stringify(next),{onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:"*"},customMetadata:{entry:toMeta(preview)}});
 if(!saved){const winner=await (await b.get(location))?.json<Profile>();if(!p&&winner&&winner.handle!==handle)await b.delete(index);return json({error:"Profile changed. Reload before trying again."},409)}
 return json({ok:true});
}

