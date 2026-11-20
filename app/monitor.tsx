"use client";
import { useState, useEffect, useRef } from "react";
import {
  Bell,
  CalendarDays,
  Timer,
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Pencil,
  Check,
  Trash2,
} from "lucide-react";
import ImportCalendar,{weekdays} from "./calendar-import";
import { api, send } from "./shared";
import {
  type Block,
  type Clock,
  type Mode,
  clockKey,
  blocksKey,
  read,
  save,
  freshClock,
  complete,
  dateKey,
  day,
  shift,
  occurs,
  modes,
  downloadCalendar,
} from "./planner";
const fmt = (n: number) => String(n).padStart(2, "0");
function defaultBlock(date: string): Block {
  return {
    id: crypto.randomUUID(),
    title: "",
    date,
    start: "09:00",
    end: "10:00",
    color: "gold",
    reminder: "10",
    repeat: "once",
  };
}
async function systemAlert(title: string, body: string, id: string) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    localStorage.getItem("pad.alerts") !== "yes"
  )
    return;
  try {
    const reg =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null;
    if (reg)
      await reg.showNotification(title, {
        body,
        tag: id,
        icon: "/art/icon-192.png",
      });
    else new Notification(title, { body, tag: id });
  } catch {}
}
export function ReminderEngine({
  account,
  notify,
}: {
  account: string;
  notify: (s: string) => void;
}) {
  const cb = useRef(notify);
  cb.current = notify;
  useEffect(() => {
    if (!account) return;
    let live = true,
      busy = false;
    const key = clockKey(account),
      plan = blocksKey(account),
      seenKey = "pad.seen." + account;
    const sync = async () => {
      if (account === "guest") return;
      try {
        const blocks = await api("blocks");
        if (live) save(plan, blocks);
      } catch {}
    };
    let next: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!live || busy) return;
      clearTimeout(next);
      busy = true;
      let delay = 60000;
      async function check() {
        if (!live) return;
        const now = Date.now(),
          c = read(key, freshClock());
        if (c.until > now) delay = Math.min(delay, c.until - now);
        if (c.until && now >= c.until) {
          const next = complete(c);
          save(key, next);
          const title =
            c.mode === "focus" ? "Focus session complete" : "Break complete";
          cb.current(title + ". " + modes[next.mode] + " is ready.");
          await systemAlert(title, modes[next.mode] + " is ready.", c.session);
        }
        const records = read<Block[]>(plan, []),
          seen = read<Record<string, number>>(seenKey, {});
        let changed = false;
        for (const [k, v] of Object.entries(seen))
          if (now - v > 172800000) {
            delete seen[k];
            changed = true;
          }
        for (const b of records) {
          if (b.reminder === "none") continue;
          for (const date of [new Date(now), shift(new Date(now), 1)]) {
            if (!occurs(b, date)) continue;
            const when = new Date(dateKey(date) + "T" + b.start).getTime(),
              due = when - Number(b.reminder) * 60000,
              id =
                b.id + "." + dateKey(date) + "." + b.start + "." + b.reminder;
            if (due > now) delay = Math.min(delay, due - now);
            if (!seen[id] && now >= due && now < due + 65000) {
              seen[id] = now;
              changed = true;
              localStorage.setItem(seenKey, JSON.stringify(seen));
              const msg = b.title + " starts at " + b.start;
              cb.current(msg);
              await systemAlert("Study block reminder", msg, id);
            }
          }
        }
        if (changed) localStorage.setItem(seenKey, JSON.stringify(seen));
      }
      try {
        if (navigator.locks)
          await navigator.locks.request(
            "pad.check." + account,
            { ifAvailable: true },
            async (lock) => {
              if (lock) await check();
            },
          );
        else await check();
      } finally {
        busy = false;
        if (live) next = setTimeout(tick, Math.max(100, delay));
      }
    };
    sync();
    tick();
    const syncTimer = setInterval(sync, 300000);
    window.addEventListener("pad-data", tick);
    window.addEventListener("storage", tick);
    const focus = () => {
      sync();
      tick();
    };
    window.addEventListener("focus", focus);
    return () => {
      live = false;
      clearTimeout(next);
      window.removeEventListener("pad-data", tick);
      window.removeEventListener("storage", tick);
      clearInterval(syncTimer);
      window.removeEventListener("focus", focus);
    };
  }, [account]);
  return null;
}
export default function Monitor({
  account,
  loaded,
  notify,
}: {
  account: string;
  loaded: boolean;
  notify: (s: string) => void;
}) {
  const owner = account || "guest",
    ck = clockKey(owner),
    bk = blocksKey(owner);
  const [clock, clockSet] = useState<Clock>(freshClock),
    [now, setNow] = useState(0),
    [blocks, setBlocks] = useState<Block[]>([]),
    [selected, setSelected] = useState(""),
    [draft, edit] = useState<Block | null>(null),
    [adjust, settings] = useState(false),
    [mins, setMins] = useState({ focus: 25, short: 5, long: 15 }),
    [problem, err] = useState(""),
    [busy, pending] = useState(false),
    [alarms, setAlarms] = useState(false),
    [confirmDelete, askDelete] = useState(false),
    [zone, setZone] = useState(""),
    [view, setView] = useState("Week");
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const id = setInterval(
      () => setNow(Date.now()),
      clock.until ? 1000 : 60000,
    );
    return () => clearInterval(id);
  }, [clock.until]);
  useEffect(() => {
    setSelected(dateKey(new Date()));
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setNow(Date.now());
    setAlarms(
      "Notification" in window &&
        Notification.permission === "granted" &&
        localStorage.getItem("pad.alerts") === "yes",
    );
  }, []);
  useEffect(() => {
    const pull = () => {
      clockSet(read(ck, freshClock()));
      setBlocks(read<Block[]>(bk, []));
      setNow(Date.now());
    };
    pull();
    window.addEventListener("pad-data", pull);
    window.addEventListener("storage", pull);
    return () => {
      window.removeEventListener("pad-data", pull);
      window.removeEventListener("storage", pull);
    };
  }, [ck, bk]);
  useEffect(() => {
    if (draft || adjust) modal.current?.showModal();
    else modal.current?.close();
  }, [!!draft, adjust]);
  const setClock = (v: Clock) => save(ck, v),
    v = clock,
    remain = v.until
      ? Math.max(0, Math.ceil((v.until - now) / 1000))
      : v.remaining;
  function selectMode(m: Mode) {
    if (v.until) return;
    setClock({
      ...v,
      mode: m,
      remaining: v.minutes[m] * 60,
      length: v.minutes[m],
      session: "",
    });
  }
  function start(block?: Block) {
    const c = read(ck, freshClock());
    if (block && c.until) {
      notify("Pause the current timer before starting a block.");
      return;
    }
    if (c.until && !block) {
      setClock({
        ...c,
        remaining: Math.max(1, Math.ceil((c.until - Date.now()) / 1000)),
        until: 0,
      });
      return;
    }
    const m = block ? "focus" : c.mode,
      secs = block ? c.minutes.focus * 60 : c.remaining;
    setNow(Date.now());
    setClock({
      ...c,
      mode: m,
      remaining: secs,
      length: block ? c.minutes.focus : c.length,
      until: Date.now() + secs * 1000,
      session: block || !c.session ? crypto.randomUUID() : c.session,
      label: block ? block.title : c.label,
    });
  }
  async function alerts() {
    if (alarms) {
      localStorage.setItem("pad.alerts", "no");
      setAlarms(false);
      return;
    }
    if (!("Notification" in window)) {
      notify(
        "Browser alerts are unavailable here. Export the blocks to your calendar for reminders.",
      );
      return;
    }
    try {
      const p = await Notification.requestPermission();
      if (p === "granted") {
        localStorage.setItem("pad.alerts", "yes");
        setAlarms(true);
        notify("Study alerts enabled on this device.");
      } else
        notify(
          "Allow notifications in browser settings, or export blocks to your calendar.",
        );
    } catch {
      notify(
        "This browser could not enable notifications. Calendar export is available.",
      );
    }
  }
  const date = selected ? day(selected) : new Date(2026, 0, 5),
    monday = shift(date, -((date.getDay() + 6) % 7)),
    dates = Array.from({ length: 7 }, (_, i) => shift(monday, i)),
    agenda = blocks
      .filter((b) => occurs(b, date))
      .sort((a, b) => a.start.localeCompare(b.start)),
    today = now ? dateKey(new Date(now)) : "",
    total = v.history.filter((h) => h.date === today),
    streak = total.length;
  const open = (b: Block) => {
    askDelete(false);
    err("");
    edit({ ...b });
  };
  const close = () => {
    edit(null);
    settings(false);
    err("");
    askDelete(false);
  };
  async function change(remove = false) {
    if (!draft || busy) return;
    const b = draft;
    if (!remove && (!b.title.trim() || b.end <= b.start)) {
      err("Add a title and an end time after the start.");
      return;
    }
    pending(true);
    try {
      let record = b;
      if (account) {
        const init = remove ? { method: "DELETE" } : send("PUT", b);
        record = await api<Block>("blocks/" + b.id, {
          ...init,
          headers: {
            ...init.headers,
            ...(b.revision ? { "If-Match": b.revision } : {}),
          },
        });
      }
      const current = read<Block[]>(bk, []).filter((i) => i.id !== b.id);
      if (!remove) current.push(record);
      save(bk, current);
      setSelected(b.date);
      close();
      notify(remove ? "Study block removed." : "Study block saved.");
    } catch (e: any) {
      err(e.message);
    } finally {
      pending(false);
    }
  }
  function field<K extends keyof Block>(k: K, value: Block[K]) {
    if (draft) edit({ ...draft, [k]: value });
  }
  return (
    <>
      <div className="pagetitle">
        <div className="eyebrow">FOCUS & PLANNING</div>
        <h1>Study monitor</h1>
        <p>
          A timer for the task in front of you. A calendar for what comes next.
        </p>
      </div>
      <div className="monitorgrid">
        <section className="timerpanel">
          <div className="timerhead">
            <span>
              <Timer size={18} />
              Pomodoro timer
            </span>
            <button
              aria-label="Timer settings"
              onClick={() => {
                setMins({ ...v.minutes });
                settings(true);
              }}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
          <div className="seg">
            {(Object.keys(modes) as Mode[]).map((m) => (
              <button
                key={m}
                disabled={!!v.until}
                aria-pressed={v.mode === m}
                onClick={() => selectMode(m)}
              >
                {modes[m]}
              </button>
            ))}
          </div>
          <div
            className="clock"
            role="timer"
            aria-label={modes[v.mode] + " time remaining"}
          >
            {fmt(Math.floor(remain / 60))}
            <span>:</span>
            {fmt(remain % 60)}
          </div>
          <p className="clocklabel">{v.label || "Independent study"}</p>
          <div className="timerbuttons">
            <button
              className="btn yellow"
              disabled={!loaded}
              onClick={() => start()}
            >
              {v.until ? <Pause size={17} /> : <Play size={17} />}{" "}
              {v.until
                ? "Pause"
                : v.session
                  ? "Resume"
                  : v.mode === "focus"
                    ? "Start focus"
                    : "Start break"}
            </button>
            <button
              className="reset"
              aria-label="Reset current timer"
              onClick={() =>
                setClock({
                  ...v,
                  until: 0,
                  remaining: v.minutes[v.mode] * 60,
                  length: v.minutes[v.mode],
                  label: "",
                  session: "",
                })
              }
            >
              <RotateCcw size={18} />
            </button>
          </div>
          <div className="timerfoot">
            <span>
              {streak} focus {streak === 1 ? "session" : "sessions"} today
            </span>
            <strong>{total.reduce((a, h) => a + h.minutes, 0)} min</strong>
          </div>
        </section>
        <section className="panel brief">
          <div className="eyebrow">DAILY AGENDA</div>
          <h2>{selected === today ? "Today’s blocks" : "Selected day"}</h2>
          <p>
            {selected
              ? date.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "Your study plan"}
          </p>
          <div className="briefitems">
            {agenda.length ? (
              agenda.map((b) => (
                <div className={"agendaitem c-" + b.color} key={b.id}>
                  <div>
                    <small>
                      {b.start} – {b.end}
                    </small>
                    <strong>{b.title}</strong>
                  </div>
                  <button
                    className="iconbtn"
                    aria-label={"Start focus for " + b.title}
                    onClick={() => start(b)}
                  >
                    <Play size={16} />
                  </button>
                </div>
              ))
            ) : (
              <div className="noagenda">
                <CalendarDays size={27} />
                <span>No study blocks for this day.</span>
              </div>
            )}
          </div>
          <button
            className="btn outline"
            onClick={() => open(defaultBlock(selected || today))}
          >
            <Plus size={16} />
            Add a block
          </button>
        </section>
      </div>
      <section className="panel calendar">
        <div className="sectionhead">
          <div>
            <div className="eyebrow">TIME BLOCKING</div>
            <h2>Study calendar</h2>
          </div>
          <button
            className="btn yellow"
            onClick={() => open(defaultBlock(selected || today))}
          >
            <Plus size={17} />
            New block
          </button>
        </div>
        <div className="calcontrols">
          <div className="inline">
            <button
              className="iconbtn"
              aria-label="Previous period"
              onClick={() =>
                setSelected(dateKey(shift(date, view === "Week" ? -7 : -1)))
              }
            >
              <ChevronLeft size={18} />
            </button>
            <strong>
              {view === "Week"
                ? monday.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  }) +
                  " – " +
                  dates[6].toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : date.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
            </strong>
            <button
              className="iconbtn"
              aria-label="Next period"
              onClick={() =>
                setSelected(dateKey(shift(date, view === "Week" ? 7 : 1)))
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="inline">
            <button className="btn compact" onClick={() => setSelected(today)}>
              Today
            </button>
            <select
              aria-label="Calendar view"
              value={view}
              onChange={(e) => setView(e.target.value)}
            >
              <option>Week</option>
              <option>Day</option>
            </select>
            <input
              aria-label="Jump to date"
              type="date"
              value={selected}
              onChange={(e) => e.target.value && setSelected(e.target.value)}
            />
          </div>
        </div>
        {view === "Week" && (
          <div className="week">
            {dates.map((d) => {
              const key = dateKey(d),
                matching = blocks
                  .filter((b) => occurs(b, d))
                  .sort((a, b) => a.start.localeCompare(b.start));
              return (
                <button
                  aria-pressed={key === selected}
                  className={"daycol" + (key === today ? " today" : "")}
                  key={key}
                  onClick={() => setSelected(key)}
                >
                  <span>
                    {d.toLocaleDateString("en-GB", { weekday: "short" })}
                  </span>
                  <b>{d.getDate()}</b>
                  {matching.slice(0, 3).map((b) => (
                    <small key={b.id} className={"c-" + b.color}>
                      {b.start}
                      <br />
                      {b.title}
                    </small>
                  ))}
                  {matching.length > 3 && (
                    <small>+{matching.length - 3} more</small>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <h3 className="agendaheading">
          {date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h3>
        {agenda.length ? (
          agenda.map((b) => (
            <div key={b.id} className={"blockrow c-" + b.color}>
              <strong>
                {b.start} – {b.end}
              </strong>
              <div>
                <b>{b.title}</b>
                <small>
                  {b.repeat.startsWith("days:")?weekdays.filter((_,i)=>Number(b.repeat.slice(5))&(1<<i)).join(", "):b.repeat === "once" ? "One time" : b.repeat} ·{" "}
                  {b.reminder === "none"
                    ? "No reminder"
                    : b.reminder === "0"
                      ? "At start"
                      : b.reminder + " min before"}
                </small>
              </div>
              <button
                className="iconbtn"
                aria-label={"Edit " + b.title}
                onClick={() => open(b)}
              >
                <Pencil size={16} />
              </button>
            </div>
          ))
        ) : (
          <p>No blocks scheduled.</p>
        )}
        <div className="calfooter">
          <button className="btn outline" onClick={alerts}>
            <Bell size={16} />
            {alarms ? "Disable alerts" : "Enable alerts"}
          </button>
          <button
            className="btn outline"
            disabled={!blocks.length}
            onClick={() => {
              downloadCalendar(blocks);
              notify(
                "Open the .ics file in your calendar and confirm its reminders.",
              );
            }}
          >
            <Download size={16} />
            Export calendar
          </button>
          <ImportCalendar account={account} notify={notify}/><small>{zone || "Local time"}</small>
        </div>
        <p className="hint">
          Alerts work while Padikkalam is running. For reminders after closing
          it, import the exported .ics file into your phone or desktop calendar
          and check its alert settings. Export again after editing blocks.
        </p>
        {loaded && !account && (
          <p className="hint">Guest planner · Saved on this device.</p>
        )}
      </section>
      {!account && loaded && <ReminderEngine account="guest" notify={notify} />}
      <dialog ref={modal} onCancel={close} aria-labelledby="dialog-head">
        {adjust ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = read(ck, freshClock());
              const idle = !c.until && !c.session;
              setClock({
                ...c,
                minutes: mins,
                ...(idle
                  ? { remaining: mins[c.mode] * 60, length: mins[c.mode] }
                  : {}),
              });
              close();
            }}
          >
            <div className="eyebrow">POMODORO</div>
            <h2 id="dialog-head">Timer settings</h2>
            <p>
              Choose the length of each new session. A long break follows every
              four focus sessions.
            </p>
            {(Object.keys(modes) as Mode[]).map((m) => (
              <label key={m}>
                {modes[m]} (minutes)
                <input
                  type="number"
                  min="1"
                  max="240"
                  required
                  value={mins[m] || ""}
                  onChange={(e) =>
                    setMins({ ...mins, [m]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            <div className="actions">
              <button className="btn yellow">Save times</button>
              <button type="button" className="btn outline" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          draft && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                change();
              }}
            >
              <div className="eyebrow">STUDY CALENDAR</div>
              <h2 id="dialog-head">
                {blocks.some((b) => b.id === draft.id)
                  ? "Edit study block"
                  : "New study block"}
              </h2>
              <label>
                Block title
                <input
                  autoFocus
                  maxLength={120}
                  required
                  placeholder="e.g. Physics MCQ practice"
                  value={draft.title}
                  onChange={(e) => field("title", e.target.value)}
                />
              </label>
              <div className="formgrid">
                <label>
                  Start date
                  <input
                    type="date"
                    required
                    value={draft.date}
                    onChange={(e) => field("date", e.target.value)}
                  />
                </label>
                <label>
                  Repeat
                  <select
                    value={draft.repeat.startsWith("days:")?"custom":draft.repeat}
                    onChange={(e) => field("repeat", e.target.value==="custom"?"days:31":e.target.value)}
                  >
                    {[
                      ["once", "One time"],
                      ["daily", "Every day"],
                      ["weekdays", "Monday to Friday"],
                      ["weekly", "Every week"],["custom","Selected weekdays"],
                    ].map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start time
                  <input
                    type="time"
                    required
                    value={draft.start}
                    onChange={(e) => field("start", e.target.value)}
                  />
                </label>
                <label>
                  End time
                  <input
                    type="time"
                    required
                    value={draft.end}
                    onChange={(e) => field("end", e.target.value)}
                  />
                </label>
                <label>
                  Reminder
                  <select
                    value={draft.reminder}
                    onChange={(e) => field("reminder", e.target.value)}
                  >
                    {["none", "0", "5", "10", "15", "30"].map((n) => (
                      <option key={n} value={n}>
                        {n === "none"
                          ? "None"
                          : n === "0"
                            ? "When it starts"
                            : n + " min before"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Colour
                  <select
                    value={draft.color}
                    onChange={(e) => field("color", e.target.value)}
                  >
                    {["gold", "green", "blue", "purple", "rose"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              {draft.repeat.startsWith("days:")&&<fieldset><legend>Repeat on</legend><div className="chips">{weekdays.map((d,i)=>{const mask=Number(draft.repeat.slice(5));return <button type="button" key={d} aria-pressed={!!(mask&(1<<i))} onClick={()=>{const next=mask^(1<<i);if(next)field("repeat","days:"+next)}}>{d}</button>})}</div></fieldset>}
              {draft.repeat !== "once" && (
                <p className="hint">Changes apply to the whole series.</p>
              )}
              {problem && <p role="alert">{problem}</p>}
              <div className="actions">
                <button disabled={busy} className="btn yellow">
                  Save block
                </button>
                <button type="button" onClick={close} className="btn outline">
                  Cancel
                </button>
                {blocks.some((b) => b.id === draft.id) && (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn danger"
                    onClick={() =>
                      confirmDelete ? change(true) : askDelete(true)
                    }
                  >
                    {confirmDelete ? "Confirm removal" : "Remove"}
                  </button>
                )}
              </div>
            </form>
          )
        )}
      </dialog>
    </>
  );
}
