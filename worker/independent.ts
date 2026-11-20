import { createServerClient,parseCookieHeader,serializeCookieHeader } from "@supabase/ssr";
type Hosted=(r:Request)=>Promise<Response>|Response;
function redirect(path:string,status=303){return new Response(null,{status,headers:{Location:path,"Cache-Control":"private, no-store"}})}
function back(value:unknown){return typeof value==="string" && ["/","/profile","/upload","/admin","/my-uploads","/monitor","/tutor","/explore"].includes(value)?value:"/"}
export async function independent(request:Request,env:Cloudflare.Env,hosted:Hosted){
 const url=new URL(request.url),p=url.pathname;
 if(!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.PADIKKALAM_ADMIN_EMAIL)return new Response("Set up the authentication and owner settings listed in HOSTING.md.",{status:503});
 const cookies=new Map(parseCookieHeader(request.headers.get("cookie")||"").map(c=>[c.name,c.value||""])),out:string[]=[];
 const client=createServerClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>{for(const i of items){cookies.set(i.name,i.value);out.push(serializeCookieHeader(i.name,i.value,{...i.options,httpOnly:true,secure:true,sameSite:"lax",path:"/"}));}}}});
 const done=(r:Response)=>{const response=new Response(r.body,r);for(const c of out)response.headers.append("Set-Cookie",c);response.headers.set("Cache-Control","private, no-store");return response};
 const failed=()=>done(redirect("/login?message=failed"));
 if(p.startsWith("/auth/")){
  if(p==="/auth/callback"&&request.method==="GET"){
    const code=url.searchParams.get("code");if(!code)return failed();
    const {error}=await client.auth.exchangeCodeForSession(code);return error?failed():done(redirect(back(url.searchParams.get("next"))));
  }
  if(request.method!=="POST"||request.headers.get("Origin")!==url.origin)return new Response("Open the sign-in form to continue.",{status:403});
  const form=await request.formData(),returnTo=back(form.get("next")),cb=url.origin+"/auth/callback?next="+encodeURIComponent(returnTo);
  if(p==="/auth/logout"){await client.auth.signOut({scope:"local"});return done(redirect("/login"))}
  if(p==="/auth/email"){
    const email=String(form.get("email")||"").trim();if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return failed();
    const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:cb}});return error?failed():done(redirect("/login?message=sent"));
  }
  const provider=p==="/auth/google"?"google":p==="/auth/facebook"?"facebook":null;
  if(!provider||!(env.PADIKKALAM_PROVIDERS||"email").split(",").includes(provider))return failed();
  const {data,error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:cb,skipBrowserRedirect:true}});
  return error||!data.url?failed():done(redirect(data.url));
 }
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.startsWith("oai-authenticated-"))headers.delete(name);
 const hasSession=[...cookies.keys()].some(k=>k.startsWith("sb-")&&k.includes("auth-token")&&!k.includes("verifier"));
 const person=hasSession?(await client.auth.getUser()).data.user:null;
 if(person?.email_confirmed_at && person.email){headers.set("oai-authenticated-user-id",person.id);headers.set("oai-authenticated-user-email",person.email)}
 const accepted=!!headers.get("oai-authenticated-user-id");
 if(p.startsWith("/signin-with-chatgpt")||p.startsWith("/signout-with-chatgpt"))return done(redirect("/login"));
 if(p!=="/login"&&(!accepted||(env.PADIKKALAM_ACCESS!=="members"&&person?.email?.toLowerCase()!==env.PADIKKALAM_ADMIN_EMAIL.toLowerCase()))){
  if(p.startsWith("/api/"))return done(Response.json({error:accepted?"Owner access required.":"Sign in to access Padikkalam."},{status:accepted?403:401}));
  return accepted?done(new Response("This Padikkalam site is currently owner-only.",{status:403})):done(redirect("/login?next="+encodeURIComponent(back(p))));
 }
 return done(await hosted(new Request(request,{headers})));
}
