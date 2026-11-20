import fs from "node:fs";
const name=process.env.WORKER_NAME||"padikkalam",bucket=process.env.R2_BUCKET||"padikkalam-uploads";
const key=process.env.SUPABASE_PUBLISHABLE_KEY, url=process.env.SUPABASE_URL;
if(!/^[a-z0-9-]{3,63}$/.test(name)||!/^[a-z0-9-]{3,63}$/.test(bucket))throw Error("Check WORKER_NAME and R2_BUCKET.");
if(!key||!url||new URL(url).protocol!=="https:")throw Error("Set the Supabase project URL and publishable key.");
const config={name,main:"index.js",no_bundle:true,compatibility_date:"2026-05-15",compatibility_flags:["nodejs_compat"],rules:[{type:"ESModule",globs:["**/*.js","**/*.mjs"]}],r2_buckets:[{binding:"BUCKET",bucket_name:bucket}],ai:{binding:"AI"},assets:{directory:"../client",binding:"ASSETS",run_worker_first:["/*","!/_next/*","!/assets/*","!/favicon.svg","!/art/*","!/vendor/*","!/sw.js","!/manifest.webmanifest"]},vars:{PADIKKALAM_DEPLOYMENT:"standalone",SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,PADIKKALAM_PROVIDERS:process.env.PADIKKALAM_PROVIDERS||"email",PADIKKALAM_ACCESS:process.env.PADIKKALAM_ACCESS==="members"?"members":"owner"}};
fs.writeFileSync("dist/server/independent.json",JSON.stringify(config,null,2));
