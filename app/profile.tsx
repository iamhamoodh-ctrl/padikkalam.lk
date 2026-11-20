"use client";
import {useEffect,useState} from "react";
import {api,send,subjects} from "./shared";
import {Tick} from "./verification";
type Person={handle:string;name:string;school:string;bio:string;batch:string;avatar:boolean;revision:string};
type Data={profile:Person|null;key:string;display:string;verified:boolean;own:boolean;followers:number;following:number;followed:boolean;notes:{id:string;title:string;subject:string;medium:string}[]};
const blank:Person={handle:"",name:"",school:"",bio:"",batch:"",avatar:false,revision:""};
async function portrait(file:File){
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>6*1024*1024)throw Error("Choose a JPG, PNG or WebP under 6 MB.");
 const bmp=await createImageBitmap(file,{resizeWidth:512,resizeQuality:"high"});
 try{const canvas=document.createElement("canvas");canvas.width=canvas.height=256;const ctx=canvas.getContext("2d");if(!ctx)throw Error("Try another picture.");const side=Math.min(bmp.width,bmp.height);ctx.fillStyle="#fff";ctx.fillRect(0,0,256,256);ctx.drawImage(bmp,(bmp.width-side)/2,(bmp.height-side)/2,side,side,0,0,256,256);return canvas.toDataURL("image/jpeg",0.82).split(",")[1]}finally{bmp.close()}
}
export default function Profile({signed}:{signed:boolean}){
 const [id,setId]=useState(""),[data,view]=useState<Data|null>(null),[form,set]=useState<Person>(blank),[pic,setPic]=useState<string|undefined>(),[editing,edit]=useState(false),[message,msg]=useState(""),[busy,work]=useState(false);
 useEffect(()=>{setId(new URLSearchParams(location.search).get("u")||"me")},[]);
 async function refresh(){const d=await api<Data>("profile/"+encodeURIComponent(id));view(d);set(d.profile||blank);edit(d.own&&!d.profile);setPic(undefined)}
 useEffect(()=>{if(id&&(id!=="me"||signed))refresh().catch(e=>msg(e.message))},[id,signed]);
 const change=(k:keyof Person,value:string)=>set(x=>({...x,[k]:value}));
 if(id==="me"&&!signed)return <section className="panel"><h1>Your student profile</h1><p>Create an account to add your photo and join the study community.</p><a className="btn yellow" href="/login?next=%2Fprofile">Create account or sign in</a></section>;
 if(!data)return <section className="panel"><h1>Student profile</h1><p role="status">{message||"Loading profile…"}</p></section>;
 const p=data.profile, img=editing&&pic!==undefined?(pic?"data:image/jpeg;base64,"+pic:""):p?.avatar?"/api/profile/"+data.key+"/avatar?v="+p.revision:"";
 async function save(e:React.FormEvent){e.preventDefault();work(true);try{await api("profile/me",send("PUT",{...form,picture:pic}));await refresh();edit(false);msg("Profile saved.")}catch(e){msg((e as Error).message)}finally{work(false)}}
 async function follow(){work(true);try{await api("follow/"+data!.key,send("PUT",{enabled:!data!.followed}));await refresh();msg("")}catch(e){msg((e as Error).message)}finally{work(false)}}
 return <><div className="profilehead panel"><div className="portrait">{img?<img src={img} alt="Profile picture"/>:(p?.name||data.display||"S").slice(0,1).toUpperCase()}</div><div><h1>{p?.name||data.display} {data.verified&&<Tick/>}</h1>{p&&<p>@{p.handle}</p>}{p?.bio&&<p>{p.bio}</p>}{(p?.school||p?.batch)&&<p>{[p?.school,p?.batch&&"A/L batch "+p.batch].filter(Boolean).join(" · ")}</p>}<p>{data.notes.length} notes · {data.followers} followers · {data.following} following</p>{data.own?<button className="btn outline" onClick={()=>{set(p||blank);setPic(undefined);edit(!editing)}}>{editing?"Close editor":p?"Edit profile":"Create profile"}</button>:signed?<button className="btn yellow" disabled={busy} onClick={follow}>{data.followed?"Unfollow":"Follow"}</button>:<a href="/login">Sign in to follow</a>}</div></div>
 {data.own&&editing&&<form className="panel profileform" onSubmit={save}><h2>{p?"Edit profile":"Create your student profile"}</h2><p>Students can see the details you save here. School, batch year, bio and picture are optional.</p><div className="formgrid"><label>Username<input required disabled={!!p} minLength={3} maxLength={24} pattern="[a-z][a-z0-9_]{2,23}" placeholder="e.g. physics_with_me" value={form.handle} onChange={e=>change("handle",e.target.value.toLowerCase())}/><small>3–24 letters, digits or underscores. Start with a letter. Your username is permanent.</small></label><label>Display name<input required maxLength={48} value={form.name} onChange={e=>change("name",e.target.value)}/></label><label>School (optional)<input maxLength={80} value={form.school} onChange={e=>change("school",e.target.value)}/></label><label>A/L batch year (optional)<input type="number" min="1950" max={new Date().getFullYear()+10} placeholder="2026" value={form.batch} onChange={e=>change("batch",e.target.value)}/></label></div><label>Bio (optional)<textarea maxLength={150} value={form.bio} onChange={e=>change("bio",e.target.value)}/></label><label>Profile picture<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;work(true);try{setPic(await portrait(file));msg("")}catch(err){msg((err as Error).message)}finally{work(false)}}}/></label><div className="actions">{img&&<button type="button" className="btn outline" onClick={()=>setPic("")}>Remove picture</button>}<button className="btn yellow" disabled={busy}>Save profile</button></div></form>}
 <p role="status">{message}</p><section className="panel"><h2>Published notes</h2>{data.notes.length?data.notes.map(n=><p key={n.id}><a href={"/read?id="+n.id}>{n.title}</a> · {subjects[n.subject]} · {n.medium}</p>):<p>No published notes yet.</p>}</section></>
}

