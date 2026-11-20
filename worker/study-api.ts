import {profileApi} from "./profiles";
import {community} from "./community";
import {tutor} from "./tutor";
import { isOwner } from "../lib/owner";
type Env = Cloudflare.Env & { BUCKET: R2Bucket };
const subjects = ["physics", "chemistry", "maths", "biology"];
const mediums = ["English", "Tamil", "Sinhala"];
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export const words = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() && v.length <= max;
const defaults = {
  uploads: true,
  starters: true,
  release: {
    enabled: true,
    version: "1.0",
    title: "Meet your study monitor",
    details:
      "Plan your week with colour-coded study blocks and reminders. Start a Pomodoro from any block, set your own focus and break lengths, and see how much time you studied today.",
    action: "details",
    url: "",
    revision: "study-monitor-1.0",
  },
};
export const toMeta = (v: unknown) =>
  btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(v)), (n) =>
      String.fromCharCode(n),
    ).join(""),
  );
const fromMeta = (s: string) =>
  JSON.parse(
    new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0))),
  );
export async function all(bucket: R2Bucket, prefix: string) {
  const items: any[] = [];
  let cursor: string | undefined;
  do {
    const page: any = await bucket.list({
      prefix,
      cursor,
      limit: 500,
      include: ["customMetadata"],
    } as any);
    for (const o of page.objects)
      if (o.customMetadata?.entry) items.push(fromMeta(o.customMetadata.entry));
      else if(o.customMetadata?.payload==="body"){const obj=await bucket.get(o.key);if(obj)items.push(await obj.json());}
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return items;
}
export const published=(n:{archived?:boolean;status?:string})=>!n.archived && (!n.status || n.status==="published");
const badgeKey=(user:string)=>"verification/"+encodeURIComponent(user);
const publicNote = ({ owner, ...rest }: any) => rest;
export const validId = (s: string) => /^[a-f\d-]{36}$/i.test(s);
const validDay = (s: unknown) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + "T12:00Z")) &&
  new Date(s + "T12:00Z").toISOString().startsWith(s);
const validTime = (s: unknown) =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export async function studyApi(req: Request, env: Env) {
  const url = new URL(req.url),
    path = url.pathname.slice(5).split("/"),
    method = req.method,
    b = env.BUCKET;
  const user = req.headers.get("oai-authenticated-user-id") || "",
    email = req.headers.get("oai-authenticated-user-email") || "";
  const admin = isOwner(user,email,env.PADIKKALAM_ADMIN_EMAIL);
  if (
    !["GET", "HEAD"].includes(method) &&
    req.headers.get("Origin") !== url.origin
  )
    return json({ error: "Please submit from Padikkalam.lk." }, 403);
  if (!b) return json({ error: "Study storage is unavailable." }, 503);
  const config = async () =>
    (await (await b.get("settings/site"))?.json<typeof defaults>()) || defaults;
  if(path[0]==="profile")return profileApi(req,b,path,user);
  if(path[0]==="tutor")return tutor(req,env,user,b);
  if(["explore","quick","papers","reader","follow"].includes(path[0]))return community(req,b,path,user,admin,(await config()).starters);
  if ((path[0] === "home" || path[0] === "admin") && method === "GET") {
    const dashboard=path[0]==="admin";
    if(dashboard && !admin)return json({error:"Owner access required."},403);
    const [settings,notes,profiles,topics]=await Promise.all([config(),all(b,"note/"),all(b,"verification/"),all(b,"topic/")]);
    const metadata=new Map(topics.map(t=>[t.id,t]));
    const badges=new Map(profiles.map(p=>[p.owner,p]));
    const roster=new Map<string,{sample:string,name:string,verified:boolean,total:number,revision:string}>();
    if(dashboard)for(const n of notes){const p=badges.get(n.owner);const c=roster.get(n.owner);if(c)c.total++;else roster.set(n.owner,{sample:n.id,name:p?.name||n.author,verified:!!p?.verified,total:1,revision:p?.revision||""});}
    return json({
      settings:dashboard || settings.release.enabled ? settings : {...settings,release:{...defaults.release,enabled:false,details:"",action:"details",url:"",revision:"",title:"What’s new",version:""}},
      admin,
      account: user,
      canPublish:admin || !!badges.get(user)?.verified,
      ...(dashboard?{contributors:[...roster.values()]}:{}),
      notes: notes
        .filter((n) => published(n) || dashboard || n.owner === user)
        .map((n) => ({ ...publicNote(n),...metadata.get(n.id),status:n.status||"published", verifiedName:badges.get(n.owner)?.verified?badges.get(n.owner)?.name:undefined, mine: n.owner === user }))
        .sort((a, b) => b.created.localeCompare(a.created)),
    });
  }
  if((path[0]==="verification"||path[0]==="review")&&method==="PUT"){
    if(!admin)return json({error:"Owner access required."},403);
    if(!validId(path[1]||""))return json({error:"Unknown submission."},404);
    const key="note/"+path[1], obj=await b.get(key);if(!obj)return json({error:"Submission no longer exists."},404);
    const note=await obj.json<any>(),input:any=await req.json();
    if(path[0]==="review"){
      if(note.revision!==input.revision||note.status!=="pending"||note.archived)return json({error:"This submission changed. Refresh the queue."},409);
      if(!["approve","return"].includes(input.action))return json({error:"Choose a review action."},400);
      const next={...note,status:input.action==="approve"?"published":"returned",revision:crypto.randomUUID()};
      const saved=await b.put(key,JSON.stringify(next),{onlyIf:{etagMatches:obj.etag},customMetadata:{entry:toMeta(next)}});return saved?json({ok:true}):json({error:"Submission changed. Refresh the queue."},409);
    }
    if(!words(input.name,80)||typeof input.verified!=="boolean")return json({error:"Enter a verified display name."},400);
    const profileKey=badgeKey(note.owner),old=await b.get(profileKey),prev=await old?.json<any>();
    if((prev?.revision||"")!==input.revision)return json({error:"Contributor changed. Refresh the dashboard."},409);
    const profile={owner:note.owner,name:input.name.trim(),verified:input.verified,revision:crypto.randomUUID()};
    const saved=await b.put(profileKey,JSON.stringify(profile),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:"*"},customMetadata:{entry:toMeta(profile)}});
    return saved?json({ok:true}):json({error:"Contributor changed. Refresh the dashboard."},409);
  }
  if (path[0] === "settings" && method === "PUT") {
    if (!admin) return json({ error: "Owner access required." }, 403);
    const v: any = await req.json(),
      r = v.release;
    if (
      typeof v.uploads !== "boolean" ||
      typeof v.starters !== "boolean" ||
      !r ||
      typeof r.enabled !== "boolean" ||
      !words(r.version, 40) ||
      !words(r.title, 120) ||
      typeof r.details !== "string" ||
      r.details.length > 3000 ||
      (r.enabled && !r.details.trim()) ||
      !["details", "refresh", "link"].includes(r.action)
    )
      return json(
        { error: "Check the release title, version and details." },
        400,
      );
    if (r.action === "link") {
      try {
        const u = new URL(r.url);
        if (u.protocol !== "https:" || u.username || u.password) throw 0;
      } catch {
        return json({ error: "Enter a full HTTPS update link." }, 400);
      }
    }
    const prev = await config(),
      release = {
        enabled: r.enabled,
        version: r.version,
        title: r.title,
        details: r.details,
        action: r.action,
        url: r.action === "link" ? r.url : "",
        revision: prev.release.revision,
      };
    if (JSON.stringify(release) !== JSON.stringify(prev.release))
      release.revision = crypto.randomUUID();
    const next = { uploads: v.uploads, starters: v.starters, release };
    await b.put("settings/site", JSON.stringify(next));
    return json(next);
  }
  if (path[0] === "blocks") {
    if (!user) return json({ error: "Sign in to save study blocks." }, 401);
    const prefix = "plan/" + encodeURIComponent(user) + "/";
    if (method === "GET") return json(await all(b, prefix));
    if (!validId(path[1] || "")) return json({ error: "Invalid block." }, 400);
    const key = prefix + path[1],
      revision = req.headers.get("If-Match");
    if (method === "DELETE") {
      const current = await b.get(key);
      if (!current) return json({ ok: true });
      if (revision && (await current.json<any>()).revision !== revision)
        return json({ error: "This block changed. Refresh the planner." }, 409);
      await b.delete(key);
      return json({ ok: true });
    }
    if (method === "PUT") {
      const t: any = await req.json();
      if (
        !words(t.title, 120) ||
        !validDay(t.date) ||
        !validTime(t.start) ||
        !validTime(t.end) ||
        t.end <= t.start ||
        (!["once", "daily", "weekdays", "weekly"].includes(t.repeat) && !(typeof t.repeat==="string" && /^days:[1-9]\d{0,2}$/.test(t.repeat)&&Number(t.repeat.slice(5))<=127)) ||
        !["none", "0", "5", "10", "15", "30"].includes(String(t.reminder)) ||
        !["gold", "green", "blue", "purple", "rose"].includes(t.color)
      )
        return json({ error: "Check the date, time range and reminder." }, 400);
      const old = await b.get(key);
      if (old && (await old.json<any>()).revision !== revision)
        return json({ error: "This block changed. Refresh the planner." }, 409);
      if (!old && revision)
        return json(
          { error: "This block was removed on another device." },
          409,
        );
      const record = {
        id: path[1],
        title: t.title.trim(),
        date: t.date,
        start: t.start,
        end: t.end,
        repeat: t.repeat,
        reminder: String(t.reminder),
        color: t.color,
        revision: crypto.randomUUID(),
      };
      const stored = await b.put(key, JSON.stringify(record), {
        onlyIf: old ? { etagMatches: old.etag } : { etagDoesNotMatch: "*" },
        customMetadata: { entry: toMeta(record) },
      });
      return stored
        ? json(record)
        : json({ error: "This block changed. Refresh the planner." }, 409);
    }
  }
  if (path[0] === "notes" && method === "POST") {
    if (!user) return json({ error: "Sign in to upload a note." }, 401);
    if (!(await config()).uploads)
      return json({ error: "Uploads are paused by the admin." }, 403);
    if (Number(req.headers.get("content-length")) > 22 * 1024 * 1024)
      return json({ error: "Keep uploads under 20 MB." }, 413);
    const f = await req.formData(),
      title = f.get("title"),
      author = f.get("author"),
      subject = String(f.get("subject")),
      medium = String(f.get("medium")),
      format = String(f.get("format")),
      file = f.get("file"),
      cover = f.get("cover");
    if (
      !words(title, 120) ||
      !words(author, 80) ||
      !subjects.includes(subject) ||
      !mediums.includes(medium) ||
      !["pdf", "picture", "photos", "written", "voice"].includes(format) ||
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 20 * 1024 * 1024 ||
      (format === "voice"
        ? !/^audio\/(mpeg|mp4|ogg|webm|wav|x-wav|aac|x-m4a)$/.test(file.type)
        : format==="picture" ? !["image/jpeg","image/png","image/webp"].includes(file.type) : file.type !== "application/pdf")
    )
      return json(
        { error: "Check all fields and use a supported file under 20 MB." },
        400,
      );
    if (
      cover &&
      (!(cover instanceof File) ||
        cover.type !== "image/jpeg" ||
        cover.size > 500000)
    )
      return json({ error: "Invalid cover." }, 400);
    if (
      format !== "picture" && format !== "voice" &&
      !(await file.slice(0, 5).text()).startsWith("%PDF-")
    )
      return json({ error: "The file must be a PDF." }, 400);
    if(format==="picture"){
      const h=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const matches=(nums:number[],offset=0)=>nums.every((n,i)=>h[offset+i]===n);
      const ok=file.type==="image/jpeg"?matches([255,216,255]):file.type==="image/png"?matches([137,80,78,71,13,10,26,10]):matches([82,73,70,70])&&matches([87,69,66,80],8);
      if(!ok)return json({error:"Choose a valid JPG, PNG or WebP picture."},400);
    }
    const id = crypto.randomUUID(),
      note = {
        id,
        title: String(title).trim(),
        author: String(author).trim(),
        subject,
        medium,
        format,
        owner: user,
        status:admin || (await (await b.get(badgeKey(user)))?.json<any>())?.verified ? "published":"pending",
        created: new Date().toISOString(),
        archived: false,
        hasCover: !!cover,
        revision: crypto.randomUUID(),
      };
    const topic={id,lesson:String(f.get("lesson")||"").trim().slice(0,45),unit:String(f.get("unit")||"").trim().slice(0,45),tags:String(f.get("tags")||"").split(",").map(t=>t.trim().slice(0,20)).filter(Boolean).slice(0,5)};
    const summary=String(f.get("summary")||"").trim().slice(0,600);
    try {
      await b.put("topic/"+id,JSON.stringify({...topic,summary}),{customMetadata:{entry:toMeta(topic)}});
      await b.put("file/" + id, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      if (cover instanceof File)
        await b.put("cover/" + id, await cover.arrayBuffer(), {
          httpMetadata: { contentType: "image/jpeg" },
        });
      await b.put("note/" + id, JSON.stringify(note), {
        customMetadata: { entry: toMeta(note) },
      });
    } catch (e) {
      await Promise.all([b.delete("file/" + id), b.delete("cover/" + id),b.delete("topic/"+id)]);
      throw e;
    }
    return json({ ...publicNote(note), mine: true }, 201);
  }
  if (path[0] === "notes" && validId(path[1] || "")) {
    const id = path[1],
      key = "note/" + id,
      obj = await b.get(key);
    if (!obj) return json({ error: "Note not found." }, 404);
    const n: any = await obj.json();
    if (method === "PATCH") {
      if (!admin && (!user || n.owner !== user))
        return json({ error: "Permission required." }, 403);
      const change: any = await req.json();
      if (!words(change.title, 120) || typeof change.archived !== "boolean")
        return json({ error: "Enter a title." }, 400);
      if (change.revision !== n.revision)
        return json({ error: "The note changed. Reload and try again." }, 409);
      const recheck=n.title!==change.title.trim() || (n.status==="returned" && change.resubmit===true);
      const trusted=admin || (recheck && (await (await b.get(badgeKey(user)))?.json<any>())?.verified);
      const next = {
        ...n,
        status:recheck&&!admin?(trusted?"published":"pending"):(n.status||"published"),
        title: change.title.trim(),
        archived: change.archived,
        revision: crypto.randomUUID(),
      };
      const result = await b.put(key, JSON.stringify(next), {
        customMetadata: { entry: toMeta(next) },
        onlyIf: { etagMatches: obj.etag },
      });
      return result
        ? json(publicNote(next))
        : json({ error: "The note changed. Try again." }, 409);
    }
    if (
      method === "GET" &&
      ["file", "cover"].includes(path[2]) &&
      (published(n) || admin || n.owner === user)
    ) {
      const asset = await b.get(path[2] + "/" + id);
      if (asset)
        return new Response(asset.body, {
          headers: {
            "content-type":
              asset.httpMetadata?.contentType || "application/octet-stream",
            "cache-control": "private,no-store",
            "x-content-type-options": "nosniff",
            "content-disposition": "inline",
          },
        });
    }
  }
  return json({ error: "Page not found." }, 404);
}
