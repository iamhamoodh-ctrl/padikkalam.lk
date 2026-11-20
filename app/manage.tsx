"use client";
import { useState } from "react";
import {
  Archive,
  RotateCcw,
  Pencil,
  Settings2,
  Bell,
  BookOpen,
  Shield,
} from "lucide-react";
import Explore from "./explore";
import { Moderation,type Contributor } from "./verification";
import { api, send, type Settings, type Note, subjects } from "./shared";
export function ContributorInsights({notes}:{notes:Note[]}){
 const [id,select]=useState(""),[report,show]=useState<{likes:number;comments:{parent?:string}[]}|null>(null),[busy,work]=useState(false),[message,msg]=useState("");
 async function load(e:React.FormEvent){e.preventDefault();if(!id)return;work(true);show(null);msg("");try{show(await api("reader/"+id))}catch(e){msg((e as Error).message)}finally{work(false)}}
 return <section className="panel"><h2>My note insights</h2>{notes.length?<><form onSubmit={load}><label>Choose one of your notes<select value={id} onChange={e=>{select(e.target.value);show(null)}}><option value="">Select a note</option>{notes.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label><button disabled={!id||busy} className="btn outline">View activity</button></form>{report&&<p>{report.likes} hearts · {report.comments.filter(c=>!c.parent).length} questions or comments · {report.comments.filter(c=>c.parent).length} replies</p>}</>:<p>Activity will appear here after your first upload.</p>}{message&&<p role="status">{message}</p>}</section>
}
export function NoteManager({
  notes,
  refresh,
}: {
  notes: Note[];
  refresh: () => Promise<unknown>;
}) {
  const [edit, setEdit] = useState(""),
    [title, setTitle] = useState(""),
    [busy, working] = useState(false),
    [msg, status] = useState("");
  async function change(n: Note, name: string, archived: boolean,resubmit=false) {
    working(true);
    status("");
    try {
      await api(
        "notes/" + n.id,
        send("PATCH", { title: name, archived, revision: n.revision,resubmit }),
      );
      await refresh();
      setEdit("");
      status(archived ? "Note archived." : "Note saved.");
    } catch (e: any) {
      status(e.message);
    } finally {
      working(false);
    }
  }
  return (
    <section className="panel">
      <h2>Manage uploads</h2>
      {!notes.length ? (
        <p>
          No uploaded notes yet. <a href="/upload">Upload a note</a>
        </p>
      ) : (
        notes.map((n) => (
          <div className="manageitem" key={n.id}>
            <div>
              <small>
                {subjects[n.subject]} · {n.medium}
                {n.archived ? " · Archived" : n.status==="pending"?" · In review":n.status==="returned"?" · Changes requested":" · Published"}
              </small>
              {edit === n.id ? (
                <form
                  className="inline"
                  onSubmit={(e) => {
                    e.preventDefault();
                    change(n, title, !!n.archived);
                  }}
                >
                  <input
                    aria-label="Note title"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <button className="btn compact" disabled={busy}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn compact"
                    onClick={() => setEdit("")}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <h3>{n.title}</h3>
              )}
            </div>
            <div className="inline">
              <button
                className="btn compact"
                disabled={busy}
                onClick={() => {
                  setEdit(n.id);
                  setTitle(n.title);
                }}
              >
                <Pencil size={14} />
                Edit
              </button>
              {n.status==="returned" && !n.archived&&n.mine&&<button className="btn compact" disabled={busy} onClick={()=>change(n,n.title,false,true)}>Resubmit</button>}
              <button
                className="btn compact"
                disabled={busy}
                onClick={() => change(n, n.title, !n.archived)}
              >
                {n.archived ? <RotateCcw size={14} /> : <Archive size={14} />}{" "}
                {n.archived ? "Restore" : "Archive"}
              </button>
            </div>
          </div>
        ))
      )}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
export function Admin({
  home,
  refresh,
}: {
  home: { settings: Settings; notes: Note[];contributors:Contributor[] };
  refresh: () => Promise<unknown>;
}) {
  const [v, set] = useState<Settings>(home.settings),
    [msg, status] = useState(""),
    [busy, work] = useState(false);
  const r = v.release;
  function release(k: string, value: unknown) {
    set({ ...v, release: { ...r, [k]: value } });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    work(true);
    try {
      set(await api<Settings>("settings", send("PUT", v)));
      await refresh();
      status("Settings saved.");
    } catch (e: any) {
      status(e.message);
    } finally {
      work(false);
    }
  }
  return (
    <>
      <div className="pagetitle">
        <div className="eyebrow">OWNER WORKSPACE</div>
        <h1>Admin dashboard</h1>
        <p>
          Manage the library and decide what students see when they open
          Padikkalam.
        </p>
      </div>
      <div className="stats">
        <div>
          <BookOpen />
          <strong>{home.notes.filter((n) => !n.archived && (!n.status||n.status==="published")).length}</strong>
          <span>Published uploads</span>
        </div>
        <div>
          <Archive />
          <strong>{home.notes.filter((n) => n.archived).length}</strong>
          <span>Archived notes</span>
        </div>
        <div>
          <Bell />
          <strong>{home.settings.release.enabled ? "On" : "Off"}</strong>
          <span>Opening update notice</span>
        </div>
      </div>
      <Moderation notes={home.notes} contributors={home.contributors} refresh={refresh}/>
      <form onSubmit={submit} className="adminform panel">
        <h2>Library settings</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={v.uploads}
            onChange={(e) => set({ ...v, uploads: e.target.checked })}
          />
          Accept new uploads
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={v.starters}
            onChange={(e) => set({ ...v, starters: e.target.checked })}
          />
          Show starter notes
        </label>
        <hr />
        <h2>Opening update notice</h2>
        <p>
          Students see the notice once per device when you publish a change.
          They can reopen it from the footer.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={r.enabled}
            onChange={(e) => release("enabled", e.target.checked)}
          />
          Show notice when the app opens
        </label>
        <div className="formgrid">
          <label>
            Version
            <input
              required
              maxLength={40}
              value={r.version}
              onChange={(e) => release("version", e.target.value)}
            />
          </label>
          <label>
            Notice title
            <input
              required
              maxLength={120}
              value={r.title}
              onChange={(e) => release("title", e.target.value)}
            />
          </label>
        </div>
        <label>
          What changed?
          <textarea
            rows={4}
            required={r.enabled}
            maxLength={3000}
            value={r.details}
            onChange={(e) => release("details", e.target.value)}
            placeholder="Tell students about this release."
          />
        </label>
        <label>
          Update action
          <select
            value={r.action}
            onChange={(e) => release("action", e.target.value)}
          >
            <option value="details">Show details only</option>
            <option value="refresh">Refresh the web app</option>
            <option value="link">Open Play Store or another update link</option>
          </select>
        </label>
        {r.action === "link" && (
          <label>
            HTTPS update link
            <input
              required
              type="url"
              pattern="https://.*"
              value={r.url}
              onChange={(e) => release("url", e.target.value)}
            />
          </label>
        )}
        <div className="actions">
          <button disabled={busy} className="btn yellow">
            {busy ? "Saving…" : "Save settings"}
          </button>
          <span role="status">{msg}</span>
        </div>
      </form>
      <Explore notes={home.notes} signed={true} admin={true} curate/>
      <NoteManager notes={home.notes} refresh={refresh} />
    </>
  );
}
