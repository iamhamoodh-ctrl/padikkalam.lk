declare namespace Cloudflare {
  interface Env {
    PADIKKALAM_ADMIN_EMAIL?: string;
    PADIKKALAM_DEPLOYMENT?:string;
    PADIKKALAM_PROVIDERS?:string;
    PADIKKALAM_ACCESS?:string;
    SUPABASE_URL?:string;
    SUPABASE_PUBLISHABLE_KEY?:string;
    GEMINI_API_KEY?:string;
    AI?:{run(model:string,input:unknown):Promise<{response?:string}>};
    ASSETS?:{fetch(r:Request):Promise<Response>};
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
