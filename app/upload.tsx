"use client";
import { useEffect, useState, useRef } from "react";
import {
  Files,
  Image as Photo,
  NotebookPen,
  Headphones,
  Sparkles,
  UploadCloud,
  Shuffle,
  ChevronUp,
  ChevronDown,
  X,
  Check,
} from "lucide-react";
import { subjects, api } from "./shared";
import { coverImage, createFile } from "./documents";
const formats = [
  ["pdf", "PDF", Files],
  ["picture", "Picture", Photo],
  ["photos", "Pages to PDF", Photo],
  ["written", "Written", NotebookPen],
  ["voice", "Voice", Headphones],
] as const;
export default function UploadPage({
  enabled,
  signed,
  canPublish,
  loaded,
}: {
  enabled: boolean;
  signed: boolean;
  canPublish:boolean;
  loaded: boolean;
}) {
  const [format, change] = useState("pdf"),
    [files, choose] = useState<File[]>([]),
    [title, t] = useState(""),
    [author, a] = useState(""),
    [sub, s] = useState("physics"),
    [medium, m] = useState("English"),
    [written, w] = useState(""),
    [ai, useAI] = useState(false),
    [seed, setSeed] = useState("1"),
    [prompt,setPrompt]=useState(""),
    [lesson,setLesson]=useState(""),[unit,setUnit]=useState(""),[tags,setTags]=useState(""),[summary,setSummary]=useState(""),
    [preview, setPreview] = useState(""),
    [working, work] = useState(false),
    [error, err] = useState(""),
    [result, setResult] = useState(""),
    [pending,setPending]=useState(false),
    [coverError, setCoverError] = useState("");
  const selector = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ai) {
      setPreview("");
      return;
    }
    let active = true,
      url = "";
    setCoverError("");
    const id = setTimeout(() => {
      coverImage(title, author, sub, medium, seed, prompt)
        .then((b) => {
          if (active) {
            url = URL.createObjectURL(b);
            setPreview(url);
          }
        })
        .catch((e: any) => {
          if (active) setCoverError(e.message);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(id);
      if (url) URL.revokeObjectURL(url);
    };
  }, [ai, seed, title, author, sub, medium, prompt]);
  function pick(list: File[]) {
    err("");
    const all = format === "photos" ? [...files, ...list] : list.slice(0, 1);
    if (
      all.length > 20 ||
      all.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024
    ) {
      err("Choose up to 20 pages and keep the total under 20 MB.");
      return;
    }
    choose(all);
  }
  function move(i: number, n: number) {
    const newFiles = [...files];
    [newFiles[i], newFiles[n]] = [newFiles[n], newFiles[i]];
    choose(newFiles);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (working) return;
    err("");
    if (format === "written" ? !written.trim() : !files.length) {
      err("Add the content of your note.");
      return;
    }
    work(true);
    try {
      const cover = ai
          ? await coverImage(title, author, sub, medium, seed, prompt)
          : null,
        file = await createFile(format, files, written, title, cover);
      if (!file || file.size > 20 * 1024 * 1024)
        throw Error(
          "The finished file exceeds 20 MB. Try fewer or smaller pages.",
        );
      const data = new FormData();
      Object.entries({ title, author, subject: sub, medium, format,lesson,unit,tags,summary }).forEach(
        ([k, v]) => data.set(k, v),
      );
      data.set("file", file);
      if (cover) data.set("cover", cover, "front.jpg");
      const note = await api<{ id: string;status:string }>("notes", {
        method: "POST",
        body: data,
      });
      setPending(note.status==="pending");setResult(note.id);
    } catch (e: any) {
      err(e.message || "Upload failed. Please retry.");
    } finally {
      work(false);
    }
  }
  if (result)
    return (
      <section className="panel success">
        <Check size={36} />
        <h1>{pending?"Submitted for review":"Note published"}</h1>
        <p>{title}{pending?" is waiting for the owner’s review. Track its status in My uploads.":" is now in the library."}</p>
        <div className="actions">
          <a
            className="btn yellow"
            href={"/read?id="+result}
            target="_blank"
            rel="noopener"
          >
            Open note
          </a>
          <a className="btn outline" href="/my-uploads">
            My uploads
          </a>
          <a href="/upload">Upload another</a>
        </div>
      </section>
    );
  return (
    <>
      <div className="pagetitle">
        <div className="eyebrow">CONTRIBUTE TO THE LIBRARY</div>
        <h1>Upload a note</h1>
        <p>
          Share a picture, a document, a set of scanned pages, a written note, or
          an audio recording.
        </p>
      </div>
      {!enabled && (
        <div className="warn">Uploads are currently paused by the admin.</div>
      )}
      {loaded && !signed && (
        <div className="warn">
          Sign in with the account that has access to this site to publish
          notes.{" "}
          <a target="_top" href="/login?next=%2Fupload">
            Sign in
          </a>
        </div>
      )}
      <form className="uploadlayout" onSubmit={submit}>
        <div className="panel">
          <h2>Note details</h2>
          <label>
            Title
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => t(e.target.value)}
              placeholder="e.g. Waves and oscillations"
            />
          </label>
          <div className="formgrid">
            <label>
              Subject
              <select value={sub} onChange={(e) => s(e.target.value)}>
                {Object.entries(subjects).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Medium
              <select value={medium} onChange={(e) => m(e.target.value)}>
                {["English", "Tamil", "Sinhala"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Author or display name
            <input
              required
              value={author}
              maxLength={80}
              onChange={(e) => a(e.target.value)}
              placeholder="Shown on your note"
            />
          </label>
          <details className="topicfields"><summary>Lesson, unit and overview (optional)</summary><div className="formgrid"><label>Lesson<input maxLength={45} value={lesson} onChange={e=>setLesson(e.target.value)}/></label><label>Unit<input maxLength={45} value={unit} onChange={e=>setUnit(e.target.value)}/></label></div><label>Keywords<input maxLength={100} placeholder="waves, frequency" value={tags} onChange={e=>setTags(e.target.value)}/></label><label>Overview<textarea maxLength={600} value={summary} onChange={e=>setSummary(e.target.value)}/></label>{format==="written"&&written.trim()&&<button type="button" className="btn compact" onClick={()=>{const sentences=written.match(/[^.!?\n]+[.!?]?/g)||[written];const terms=(title+" "+tags).toLowerCase().split(/[\s,]+/).filter(t=>t.length>2);const ranked=sentences.map((v,i)=>({v,i,score:(i===0?1:0)+terms.filter(t=>v.toLowerCase().includes(t)).length})).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,3).sort((a,b)=>a.i-b.i);setSummary(ranked.map(x=>x.v.trim()).join(" ").slice(0,600))}}>Draft overview from my text</button>}</details>
          <h3>Source</h3>
          <div className="formats">
            {formats.map(([k, l, I]) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === format}
                onClick={() => {
                  change(k);
                  choose([]);
                  err("");
                }}
              >
                <I size={17} />
                {l}
              </button>
            ))}
          </div>
          {format === "written" ? (
            <label>
              Note text
              <textarea
                required
                maxLength={30000}
                rows={9}
                value={written}
                onChange={(e) => w(e.target.value)}
                placeholder="Write in English, Tamil or Sinhala…"
              />
            </label>
          ) : (
            <>
              <input
                className="sr"
                tabIndex={-1}
                aria-label="Choose note files"
                key={format}
                ref={selector}
                type="file"
                multiple={format === "photos"}
                accept={
                  (format === "photos" || format === "picture")
                    ? "image/jpeg,image/png,image/webp"
                    : format === "voice"
                      ? "audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav,audio/x-wav,audio/aac,audio/x-m4a"
                      : "application/pdf"
                }
                onChange={(e) => {
                  pick(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="drop"
                onClick={() => selector.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  pick(Array.from(e.dataTransfer.files));
                }}
              >
                <UploadCloud size={28} />
                <strong>
                  {format === "photos"
                    ? "Choose page photos"
                    : format === "picture" ? "Choose a picture"
                    : format === "voice"
                      ? "Choose audio file"
                      : "Choose PDF file"}
                </strong>
                <small>
                  {format === "photos"
                    ? "JPG, PNG or WebP · up to 20 pages"
                    : "Up to 20 MB"}
                </small>
              </button>
              <ol className="filelist">
                {files.map((f, i) => (
                  <li key={i}>
                    <span>
                      {i + 1}. {f.name}
                    </span>
                    {format === "photos" && (
                      <>
                        <button
                          aria-label={"Move page " + (i + 1) + " up"}
                          type="button"
                          disabled={!i}
                          onClick={() => move(i, i - 1)}
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          aria-label={"Move page " + (i + 1) + " down"}
                          type="button"
                          disabled={i === files.length - 1}
                          onClick={() => move(i, i + 1)}
                        >
                          <ChevronDown size={15} />
                        </button>
                      </>
                    )}
                    <button
                      aria-label={"Remove " + f.name}
                      type="button"
                      onClick={() =>
                        choose(files.filter((_, idx) => idx !== i))
                      }
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          {error && (
            <p className="warn" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              disabled={!enabled || !loaded || !signed || working}
              className="btn yellow"
            >
              {working ? "Preparing and uploading…" : canPublish?"Publish note":"Submit for review"}
            </button>
            <a href="/my-uploads">My uploads</a>
          </div>
        </div>
        <aside className="panel coverpanel">
          <Sparkles size={25} />
          <h2>AI front page</h2>
          <p>
            Generate a subject illustration on your device using the title and
            author you enter.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={ai}
              onChange={(e) => useAI(e.target.checked)}
            />{" "}
            Generate a cover
          </label>
          {ai && (
            <>
              <label className="coverprompt">Design prompt (optional)<textarea rows={3} maxLength={300} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Try a dark blue cover with a grid and waves."/><small>Describe a colour, pattern or illustration. Leave it blank for the subject design.</small></label>
              {preview && (
                <img src={preview} alt="Generated front page preview" />
              )}
              <button
                type="button"
                className="btn outline"
                onClick={() => setSeed(crypto.randomUUID())}
              >
                <Shuffle size={15} />
                Try another design
              </button>
              {coverError && <small>{coverError}</small>}
              <small>
                {format === "voice"
                  ? "The cover appears on the library card for this recording."
                  : "The cover becomes the first page of your PDF."}
              </small>
            </>
          )}
        </aside>
      </form>
    </>
  );
}
