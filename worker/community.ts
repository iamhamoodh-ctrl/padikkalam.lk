import {publicId} from "./profiles";
import { all, toMeta, json, published, validId, words } from "./study-api";
const subjects=["physics","chemistry","maths","biology"], mediums=["English","Tamil","Sinhala"];
function write(b:R2Bucket,key:string,v:unknown){
 const entry=toMeta(v);
 return b.put(key,JSON.stringify(v),{customMetadata:entry.length<1950?{entry}:{payload:"body"}});
}
const starterIds=new Set(subjects);
const read=async (b:R2Bucket,k:string)=>await (await b.get(k))?.json<any>();
const link=(v:unknown)=>{try{const u=new URL(String(v));return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<450?u.href:""}catch{return ""}};
const maxTip=240;
export async function community(req:Request,b:R2Bucket,path:string[],user:string,admin:boolean,starters:boolean){
 const [route,id,action]=path,method=req.method,uid=user?await publicId(user):"",me="person/"+uid+"/";
 if(method!=="GET"&&!user)return json({error:"Sign in to contribute."},401);
 if(route==="explore"&&method==="GET"){
  const [tips,papers,saved,following,notes,badges,accounts]=await Promise.all([all(b,"quick/"),all(b,"paper/"),user?all(b,me+"save/"):[],user?all(b,"social-follow/"+uid+"/"):[],all(b,"note/"),all(b,"verification/"),all(b,"profile/")]);
  const profiles=new Map<string,{key:string;name:string;count:number;verified:boolean}>();
  const names=new Map(badges.map(x=>[x.owner,x]));
  for(const n of notes.filter(published)){if(profiles.has(n.owner)){profiles.get(n.owner)!.count++;continue}const p=names.get(n.owner);profiles.set(n.owner,{key:await publicId(n.owner),name:p?.name||n.author,count:1,verified:!!p?.verified})}
  const directory=new Map([...profiles.values()].map(p=>[p.key,p]));
  for(const a of accounts){const old=directory.get(a.key);directory.set(a.key,{...a,count:old?.count||0,verified:!!old?.verified});}
  return json({self:uid,tips:tips.filter(t=>t.expires>Date.now()).map(({owner,...t})=>({...t,mine:owner===user})).sort((a,b)=>b.expires-a.expires),papers:papers.sort((a,b)=>b.year-a.year),saved:saved.map(s=>s.id),following:following.map(f=>f.id),profiles:[...directory.values()].sort((a,b)=>b.count-a.count)});
 }
 if(route==="quick"&&method==="POST"){const v:any=await req.json();if(!words(v.text,maxTip)||!words(v.author,50)||!subjects.includes(v.subject)||!mediums.includes(v.medium))return json({error:"Add your name and a tip of up to 240 characters."},400);
 const key=crypto.randomUUID(),t={id:key,text:v.text.trim(),author:v.author.trim(),subject:v.subject,medium:v.medium,owner:user,expires:Date.now()+86400000};await write(b,"quick/"+key,t);return json({ok:true},201)}
 if(route==="quick"&&method==="DELETE"&&validId(id||"")){const q=await read(b,"quick/"+id);if(!q)return json({ok:true});if(!admin&&q.owner!==user)return json({error:"Permission required."},403);await b.delete("quick/"+id);return json({ok:true})}
 if(route==="papers"){
  if(!admin)return json({error:"Owner access required."},403);
  if(method==="POST"){const v:any=await req.json();if(!words(v.title,100)||!subjects.includes(v.subject)||!mediums.includes(v.medium)||!Number.isInteger(v.year)||v.year<1950||v.year>new Date().getFullYear()+1||!link(v.paper)||v.scheme&&!link(v.scheme))return json({error:"Supply a title, year and valid HTTPS paper links."},400);
  const key=crypto.randomUUID();await write(b,"paper/"+key,{id:key,kind:v.kind==="model"?"model":"past",title:v.title.trim(),year:v.year,subject:v.subject,medium:v.medium,paper:link(v.paper),scheme:v.scheme?link(v.scheme):""});return json({ok:true},201)}
  if(method==="DELETE"&&validId(id||"")){await b.delete("paper/"+id);return json({ok:true})}
 }
 if(route==="follow"&&method==="PUT"&&/^[0-9a-f]{64}$/.test(id||"")){const v:any=await req.json();if(typeof v.enabled!=="boolean"||id===uid)return json({error:"Choose another contributor."},400);const edge="social-follow/"+uid+"/"+id;
 if(v.enabled){if(!await b.head("profile/"+id)){const records=await all(b,"note/");const owners=[...new Set(records.filter(published).map(n=>String(n.owner)))];if(!(await Promise.all(owners.map(publicId))).includes(id))return json({error:"Unknown contributor."},404)}await write(b,edge,{id,from:uid});}else await b.delete(edge);return json({ok:true})}
 if(route!=="reader" || !(starterIds.has(id)||validId(id||"")))return json({error:"Not found."},404);
 const n=starterIds.has(id)?(starters?{owner:"",id,status:"published"}:null):await read(b,"note/"+id);
 if(!n||(!published(n)&&!admin&&n.owner!==user))return json({error:"Note unavailable."},404);
 const target="read/"+id+"/";
 if(method==="GET"){const [comments,likes,saved,liked,details]=await Promise.all([all(b,target+"comment/"),all(b,target+"like/"),uid?b.head(me+"save/"+id):null,uid?b.head(target+"like/"+uid):null,read(b,"topic/"+id)]);
 return json({comments:comments.map(({owner,...c})=>({...c,mine:owner===user})).sort((a,b)=>a.at-b.at),likes:likes.length,saved:!!saved,liked:!!liked,details,displayName:user?(await read(b,"profile/"+uid))?.name||"":"",creator:n.owner?await publicId(n.owner):"",self:uid})}
 if(method==="PUT"&&["save","like"].includes(action)){const v:any=await req.json();if(typeof v.enabled!=="boolean")return json({error:"Invalid choice."},400);const key=action==="save"?me+"save/"+id:target+"like/"+uid;if(v.enabled)await write(b,key,{id});else await b.delete(key);return json({ok:true})}
 if(action==="comment"&&method==="POST"){const v:any=await req.json();if(!words(v.text,350)||!words(v.name,48))return json({error:"Enter a display name and a comment of up to 350 characters."},400);
 if(v.parent&&(!validId(v.parent)||!(await b.head(target+"comment/"+v.parent))))return json({error:"Reply target unavailable."},400);
 const profile=await read(b,"profile/"+uid);
 const key=crypto.randomUUID(),data={id:key,owner:user,profile:profile?.handle||"",text:v.text.trim(),name:profile?.name||v.name.trim(),parent:v.parent||"",at:Date.now()};await write(b,target+"comment/"+key,data);return json({ok:true},201)}
 if(action==="comment"&&method==="DELETE"&&validId(path[3]||"")){const key=target+"comment/"+path[3],c=await read(b,key);if(!c)return json({ok:true});if(!admin&&c.owner!==user)return json({error:"Not allowed."},403);await b.delete(key);return json({ok:true})}
 return json({error:"Unknown action."},404)
}
