"use client";
import { useState, useEffect } from "react";
import type {Contributor} from "../verification";
import { Admin } from "../manage";
import { api, type Note,type Settings } from "../shared";
type Dashboard={settings:Settings;notes:Note[];contributors:Contributor[]};
export default function OwnerConsole(){
 const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState("");
 async function refresh(){try{const d=await api<Dashboard>("admin");setData(d);setError("");return d}catch(e){setError(e instanceof Error?e.message:"Could not load the dashboard.")}}
 useEffect(()=>{document.documentElement.dataset.theme=localStorage.getItem("pad.theme")||"system";refresh()},[]);
 return <>{error&&<div className="warn" role="alert">{error} <button onClick={refresh}>Retry</button></div>}{data?<Admin home={data} refresh={refresh}/>:!error&&<p role="status">Loading the owner dashboard…</p>}</>
}
