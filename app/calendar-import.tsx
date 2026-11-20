"use client";
import {useRef,useState} from "react";
import {Upload} from "lucide-react";
import {api,send} from "./shared";
import {type Block,save,read,blocksKey} from "./planner";
export const weekdays=["MO","TU","WE","TH","FR","SA","SU"];
export function readCalendar(source:string):Block[]{
 const rows=source.replace(/\r\n/g,"\n").replace(/\n[ \t]/g,"").split("\n");
 if(!rows.includes("BEGIN:VCALENDAR"))throw Error("Choose a Padikkalam .ics export.");
 const blocks:Block[]=[];let f:Record<string,string>|null=null;
 for(const row of rows){
  if(row==="BEGIN:VEVENT"){f={};continue}if(!f)continue;
  if(row!=="END:VEVENT"){const at=row.indexOf(":");if(at>0)f[row.slice(0,at)]=row.slice(at+1);continue}
  const uid=/^([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})@padikkalam\.lk$/i.exec(f.UID||"");
  const time=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})00$/,s=time.exec(f.DTSTART||""),e=time.exec(f.DTEND||"");
  if(!uid||!s||!e||s[0].slice(0,8)!==e[0].slice(0,8)||s[0]>=e[0])throw Error("This file contains an unsupported event.");
  let repeat="once";const rule=f.RRULE||"";
  if(rule==="FREQ=DAILY")repeat="daily";else if(rule==="FREQ=WEEKLY")repeat="weekly";else if(rule.startsWith("FREQ=WEEKLY;BYDAY=")){
   const days=rule.slice(18).split(",");if(days.some(v=>!weekdays.includes(v)))throw Error("Invalid repeat days.");
   const mask=days.reduce((a,v)=>a|(1<<weekdays.indexOf(v)),0);repeat=mask===31?"weekdays":mask===127?"daily":"days:"+mask;
  }else if(rule)throw Error("Unsupported recurrence.");
  const alarm=f.TRIGGER;if(alarm&&!/^-?PT(0|5|10|15|30)M$/.test(alarm))throw Error("Unsupported reminder.");
  const title=(f.SUMMARY||"").replace(/\\([nN,;\\])/g,(_,v)=>v.toLowerCase()==="n"?"\n":v).trim(),date=s[1]+"-"+s[2]+"-"+s[3],start=s[4]+":"+s[5],end=e[4]+":"+e[5];
  if(!title||title.length>120||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||new Date(date+"T12:00Z").toISOString().slice(0,10)!==date)throw Error("Check the event title, date and times.");
  const color=(f["X-PADIKKALAM-COLOR"]||"gold").toLowerCase();blocks.push({id:uid[1],title,date,start,end,repeat,color:["gold","green","blue","purple","rose"].includes(color)?color:"gold",reminder:alarm?alarm.replace(/\D/g,""):"none"});f=null;
 }
 if(f||!blocks.length||blocks.length>1000||new Set(blocks.map(b=>b.id)).size!==blocks.length)throw Error("Choose up to 1,000 distinct study blocks.");return blocks;
}
export default function ImportCalendar({account,notify}:{account:string;notify:(s:string)=>void}){
 const picker=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDialogElement>(null);
 const [batch,setBatch]=useState<Block[]>([]),[busy,work]=useState(false);
 async function importBlocks(){work(true);let saved=0;try{const key=blocksKey(account||"guest");const current=account?await api<Block[]>("blocks"):read<Block[]>(key,[]);const records=new Map(current.map(b=>[b.id,b]));
 for(const b of batch){const previous=records.get(b.id);let value=b;if(account){const init=send("PUT",b);value=await api<Block>("blocks/"+b.id,{...init,headers:{...init.headers,...(previous?.revision?{"If-Match":previous.revision}:{})}})}records.set(b.id,value);save(key,[...records.values()]);saved++}notify(saved+" study blocks imported.");}catch(e){notify(saved+" blocks imported. "+(e instanceof Error?e.message:"Import failed."))}finally{work(false);dialog.current?.close()}}
 return <><input hidden type="file" ref={picker} accept=".ics,text/calendar" onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{if(file.size>1048576)throw Error("Choose an export smaller than 1 MB.");setBatch(readCalendar(await file.text()));dialog.current?.showModal()}catch(t){notify(t instanceof Error?t.message:"Calendar could not be imported.")}}}/><button className="btn outline" onClick={()=>picker.current?.click()}><Upload size={16}/>Import calendar</button><dialog ref={dialog} onCancel={e=>{if(busy)e.preventDefault()}}><h2>Import study blocks?</h2><p>{batch.length} blocks from this file will be added or updated by their calendar ID.</p><div className="actions"><button disabled={busy} className="btn yellow" onClick={importBlocks}>{busy?"Importing…":"Import blocks"}</button><button disabled={busy} className="btn outline" onClick={()=>dialog.current?.close()}>Cancel</button></div></dialog></>
}
