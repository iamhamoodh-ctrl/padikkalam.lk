import { env } from "cloudflare:workers";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { isOwner } from "../../lib/owner";
import OwnerConsole from "./console";
export const dynamic = "force-dynamic";
export const metadata = {title:"Owner workspace · Padikkalam.lk",robots:{index:false,follow:false}};
export default async function OwnerPage(){
  const person=await getChatGPTUser();
  const allowed=isOwner(person?.userId,person?.email,(env as Cloudflare.Env).PADIKKALAM_ADMIN_EMAIL);
  return <><header className="ownerbar"><div className="topin"><a className="brand" href="/admin"><img src="/art/icon-192.png" alt=""/><strong>Padikkalam.lk</strong></a><span>Owner workspace</span><a className="back-library" href="/">Student library</a></div></header><main className="wrap">{allowed?<OwnerConsole/>:<section className="panel loginpanel"><div className="eyebrow">OWNER ACCESS</div><h1>Admin workspace</h1><p>{person?"This account has student access. Sign in with the owner account to manage the library.":"Sign in with the site owner account to manage notes and opening notices."}</p><div className="actions">{!person&&<a target="_top" className="btn yellow" href={chatGPTSignInPath("/admin")}>Owner sign-in</a>}<a className="btn outline" href="/login">Account options</a></div></section>}</main><footer><div className="footin"><span>Designed by Hamoodh Mohideen</span></div></footer></>
}
