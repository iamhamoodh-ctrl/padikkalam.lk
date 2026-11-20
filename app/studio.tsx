"use client";
import { useEffect, useState, useRef } from "react";
import {
  BookOpen,
  Timer,
  Upload,
  Search,
  SlidersHorizontal,
  Sun,
  Moon,
  Menu,
  X,
  Library,
  FileText,
  Headphones,
  UserRound,
  CalendarDays,
  Plus,
  Info,
} from "lucide-react";
import Reader,{readerUrl} from "./reader";
import Explore from "./explore";
import Profile from "./profile";
import Tutor from "./tutor";
import {Tick} from "./verification";
import Install from "./install";
import Monitor, { ReminderEngine } from "./monitor";
import UploadPage from "./upload";
import { NoteManager,ContributorInsights } from "./manage";
import {
  api,
  subjects,
  starters,
  noteUrl,
  defaults,
  type Note,
  type Settings,
} from "./shared";
type Home = {
  notes: Note[];
  settings: Settings;
  admin: boolean;
  canPublish?: boolean;
  account: string;
};
const initial: Home = {
  notes: [],
  settings: defaults,
  admin: false,
  account: "",
};
const baseLinks = [
  ["/", "Library", BookOpen],
  ["/monitor", "Study monitor", Timer],
  ["/upload", "Upload", Upload],
  ["/explore","Explore",Library],
  ["/tutor","Study tutor",Info],
] as const;
function Book({ kind, name }: { kind: string; name: string }) {
  return (
    <div className={"book book-" + kind}>
      <div className="spine" />
      <small>PADIKKALAM &nbsp; / &nbsp; A·L</small>
      <strong>{name}</strong>
      <img src={"/art/" + kind + ".webp"} alt="" />
      <i>STUDY EDITION</i>
    </div>
  );
}
export default function Studio({ page }: { page: string }) {
  const [home, setHome] = useState<Home>(initial),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false),
    [theme, setTheme] = useState("system"),
    [showRelease, releaseOpen] = useState(false),
    [updated, update] = useState(false),
    [q, search] = useState(""),
    [sub, subject] = useState("all"),
    [med, medium] = useState("all"),
    [format, chooseFormat] = useState("all"),
    [more, filters] = useState(false),
    [toast, setToast] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  const notify = (s: string) => setToast(s);
  async function refresh() {
    try {
      const h = await api<Home>("home");
      setHome(h);
      setError("");
      return h;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    refresh().then((h) => {
      const r = h?.settings.release;
      if (r?.enabled && localStorage.getItem("pad.release") !== r.revision)
        releaseOpen(true);
    });
    setTheme(localStorage.getItem("pad.theme") || "system");
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pad.theme", theme);
  }, [theme]);
  useEffect(() => {
    if (showRelease) dlg.current?.showModal();
    else dlg.current?.close();
  }, [showRelease]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(id);
  }, [toast]);
  const settings = home.settings,
    r = settings.release;
  function dismiss() {
    if (r.revision) localStorage.setItem("pad.release", r.revision);
    releaseOpen(false);
  }
  const notes = [
      ...(settings.starters ? starters : []),
      ...home.notes.filter((n) => !n.archived && (!n.status || n.status==="published")),
    ],
    visible = notes.filter(
      (n) =>
        (sub === "all" || n.subject === sub) &&
        (med === "all" || n.medium === med) &&
        (format === "all" || n.format === format) &&
        (n.title + " " + n.author + " " + subjects[n.subject]+" "+[n.lesson,n.unit,...(n.tags||[])].filter(Boolean).join(" "))
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
    );
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="top">
        <div className="topin">
          <a className="brand" href="/">
            <img src="/art/icon-192.png" alt="" />
            <strong>
              Padikkalam<span>.lk</span>
            </strong>
          </a>
          <nav className={menu ? "show" : ""} aria-label="Main navigation">
            {baseLinks.map(([href, name, Icon]) => (
              <a
                key={href}
                href={href}
                aria-current={
                  (page === "library" ? "/" : "/" + page) === href
                    ? "page"
                    : undefined
                }
              >
                <Icon size={16} />
                {name}
              </a>
            ))}
            <a href="/login"><UserRound size={16}/>{home.account?"Account":"Sign in"}</a>
          </nav>
          <label className="theme" title="Colour theme">
            <Sun size={17} />
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              aria-label="Colour theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <button
            className="hamb"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="content" className="wrap">
        {error && (
          <div role="alert" className="warn">
            {error} <button onClick={refresh}>Retry connection</button>
          </div>
        )}
        {page === "library" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow light">
                  <span className="line" /> A/L STUDY LIBRARY
                </div>
                <h1>
                  Room to <em>learn.</em>
                </h1>
                <p>
                  Find notes for your next lesson, share what you know, and make
                  time to study.
                </p>
                <div className="actions">
                  <a className="btn yellow" href="#collection">
                    <Library size={18} />
                    Browse notes
                  </a>
                  <a className="btn ongreen" href="/monitor">
                    <Timer size={18} />
                    Study monitor
                  </a>
                </div>
                <small>Designed by Hamoodh Mohideen</small>
              </div>
              <div className="bookscene" aria-hidden="true">
                <div className="halo" />
                <Book kind="chemistry" name="Chemistry" />
                <Book kind="physics" name="Physics" />
              </div>
            </section>
            <section className="collection" id="collection">
              <div className="sectionhead">
                <div>
                  <div className="eyebrow">STUDY SHELF</div>
                  <h2>Note library</h2>
                </div>
                <a className="btn outline" href="/upload">
                  <Plus size={17} />
                  Upload a note
                </a>
              </div>
              <div className="toolbar">
                <label className="search">
                  <Search size={19} />
                  <input
                    aria-label="Search notes"
                    placeholder="Search notes, subjects or authors"
                    value={q}
                    onChange={(e) => search(e.target.value)}
                  />
                </label>
                <button
                  className={"btn outline" + (more ? " selected" : "")}
                  onClick={() => filters(!more)}
                  aria-expanded={more}
                >
                  <SlidersHorizontal size={16} />
                  Filters
                </button>
              </div>
              <div className="chips" aria-label="Subject filter">
                {[["all", "All subjects"], ...Object.entries(subjects)].map(
                  ([k, v]) => (
                    <button
                      key={k}
                      aria-pressed={sub === k}
                      onClick={() => subject(k)}
                    >
                      {v}
                    </button>
                  ),
                )}
              </div>
              {more && (
                <div className="filterrow">
                  <label>
                    Medium
                    <select
                      value={med}
                      onChange={(e) => medium(e.target.value)}
                    >
                      {["all", "English", "Tamil", "Sinhala"].map((v) => (
                        <option key={v} value={v}>
                          {v === "all" ? "All mediums" : v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Format
                    <select
                      value={format}
                      onChange={(e) => chooseFormat(e.target.value)}
                    >
                      {[
                        ["all", "All formats"],
                        ["pdf", "PDF"],
                        ["picture", "Picture"],["photos", "Page photos"],
                        ["written", "Written note"],
                        ["voice", "Voice note"],
                      ].map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="gridnotes">
                {visible.map((n) => (
                  <a
                    className={"notecard art-" + n.subject}
                    key={n.id}
                    href={readerUrl(n)}
                  >
                    <div className="art">
                      <span>{subjects[n.subject]}</span>
                      <img
                        src={
                          n.hasCover
                            ? "/api/notes/" + n.id + "/cover"
                            : n.format==="picture"?"/api/notes/"+n.id+"/file":"/art/" + n.subject + ".webp"
                        }
                        className={n.hasCover ? "actualcover" : ""}
                        alt=""
                      />
                    </div>
                    <div className="cardbody">
                      <div className="meta">
                        {n.format === "voice" ? (
                          <Headphones size={14} />
                        ) : (
                          <FileText size={14} />
                        )}{" "}
                        {n.format === "voice" ? "AUDIO" : n.format==="picture"?"PICTURE":"PDF"} <b>·</b>{" "}
                        {n.medium}
                      </div>
                      <h3>{n.title}</h3>
                      <small>{n.author}</small>{n.verifiedName&&<small className="byline">Shared by {n.verifiedName}<Tick/></small>}
                    </div>
                  </a>
                ))}
              </div>
              {!visible.length && (
                <div className="empty">
                  No notes match these filters.{" "}
                  <button
                    onClick={() => {
                      search("");
                      subject("all");
                      medium("all");
                      chooseFormat("all");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </section>
          </>
        )}
        {page==="profile"&&<Profile signed={!!home.account}/>}
        {page==="read"&&<Reader notes={notes} signed={!!home.account} admin={home.admin}/>}
        {page==="explore"&&<Explore notes={notes} signed={!!home.account} admin={home.admin}/>}
        {page==="tutor"&&<Tutor signed={!!home.account}/>}
        {page === "monitor" && (
          <Monitor account={home.account} loaded={loaded} notify={notify} />
        )}
        {page === "upload" && (
          <UploadPage
            enabled={settings.uploads}
            signed={!!home.account}
            canPublish={!!home.canPublish}
            loaded={loaded}
          />
        )}
        {page === "my-uploads" && (
          <>
            <div className="pagetitle">
              <div className="eyebrow">CONTRIBUTOR SPACE</div>
              <h1>My uploads</h1><a href="/profile">My student profile</a>
            </div>
            {home.account&&<ContributorInsights notes={home.notes.filter(n=>n.mine)}/>}
            <NoteManager
              notes={home.notes.filter((n) => n.mine)}
              refresh={refresh}
            />
          </>
        )}
        {page === "vision" && (
          <section className="vision">
            <div className="eyebrow">OUR VISION</div>
            <h1>
              A place to study,
              <br />
              <em>wherever you are.</em>
            </h1>
            <p>
              Every Sri Lankan A/L student should have access to clear study
              notes in the language they learn in, wherever they sit down to
              study.
            </p>
            <p>
              Our emblem shows a boy reading under a streetlight. Inspired by Dr
              A. P. J. Abdul Kalam’s curiosity and perseverance, it represents a
              student making the most of the light available.
            </p>
            <strong>Designed by Hamoodh Mohideen</strong>
            <img
              src="/art/scholar.webp"
              alt="A schoolboy reading beneath a warm streetlight"
            />
          </section>
        )}
      </main>
      <footer>
        <div className="footin">
          <strong>Padikkalam.lk</strong>
          <span>Designed by Hamoodh Mohideen</span>
          <Install />
          <a href="/my-uploads">My uploads</a>
          <a href="/vision">Our vision</a>
          {r.enabled && (
            <button onClick={() => releaseOpen(true)}>What’s new</button>
          )}
        </div>
      </footer>
      {loaded && home.account && (
        <ReminderEngine account={home.account} notify={notify} />
      )}
      <dialog ref={dlg} onCancel={dismiss} aria-labelledby="release-heading">
        <div className="eyebrow">UPDATE · {r.version}</div>
        <h2 id="release-heading">{r.title}</h2>
        <p className="pre">{r.details}</p>
        <div className="actions">
          {r.action === "link" && r.url && (
            <a
              className="btn yellow"
              href={r.url}
              target="_blank"
              rel="noopener"
              onClick={dismiss}
            >
              Get update
            </a>
          )}
          {r.action === "refresh" && (
            <button
              className="btn yellow"
              onClick={() => {
                dismiss();
                if (!updated) {
                  update(true);
                  location.reload();
                }
              }}
            >
              Refresh app
            </button>
          )}
          <button className="btn outline" onClick={dismiss}>
            {r.action === "details" ? "Got it" : "Close"}
          </button>
        </div>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
