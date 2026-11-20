export type Block = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  repeat: string;
  reminder: string;
  color: string;
  revision?: string;
};
export type Mode = "focus" | "short" | "long";
export type Clock = {
  mode: Mode;
  minutes: Record<Mode, number>;
  remaining: number;
  until: number;
  label: string;
  cycle: number;
  session: string;
  history: { date: string; minutes: number }[];
  length: number;
};
export function dateKey(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export const day = (v: string) => new Date(v + "T12:00:00");
export function shift(d: Date, n: number) {
  const t = new Date(d);
  t.setDate(t.getDate() + n);
  return t;
}
export const modes: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};
export function occurs(b: Block, d: Date) {
  const key = dateKey(d);
  if (key < b.date) return false;
  if(b.repeat.startsWith("days:"))return !!(Number(b.repeat.slice(5))&(1<<((d.getDay()+6)%7)));
  if (b.repeat === "weekdays") return d.getDay() > 0 && d.getDay() < 6;
  if (key === b.date || b.repeat === "daily") return true;
  return b.repeat === "weekly" && day(b.date).getDay() === d.getDay();
}
export const clockKey = (a: string) => "pad.clock.v2." + a;
export const blocksKey = (a: string) => "pad.blocks.v2." + a;
export function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("pad-data"));
}
export function freshClock(): Clock {
  return {
    mode: "focus",
    minutes: { focus: 25, short: 5, long: 15 },
    remaining: 1500,
    until: 0,
    label: "",
    cycle: 0,
    session: "",
    history: [],
    length: 25,
  };
}
export function complete(c: Clock) {
  const focus = c.mode === "focus",
    cycle = c.cycle + (focus ? 1 : 0),
    mode: Mode = focus ? (cycle % 4 === 0 ? "long" : "short") : "focus";
  return {
    ...c,
    history: focus
      ? [
          ...c.history,
          { date: dateKey(new Date(c.until)), minutes: c.length },
        ].slice(-1500)
      : c.history,
    mode,
    cycle,
    until: 0,
    remaining: c.minutes[mode] * 60,
    length: c.minutes[mode],
    session: "",
  };
}
const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
function fold(line: string) {
  let n = 0,
    out = "";
  const enc = new TextEncoder();
  for (const ch of line) {
    const l = enc.encode(ch).length;
    if (n + l > 74) {
      out += "\r\n ";
      n = 1;
    }
    out += ch;
    n += l;
  }
  return out;
}
export function calendarFile(blocks: Block[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Padikkalam.lk//Study planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const b of blocks) {
    let first = day(b.date);
    for(let skip=0;skip<7 && !occurs(b,first);skip++)first=shift(first,1);
    const dt = dateKey(first).replaceAll("-", "") + "T";
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + b.id + "@padikkalam.lk",
      "DTSTAMP:" +
        new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, ""),
      "DTSTART:" + dt + b.start.replace(":", "") + "00",
      "DTEND:" + dt + b.end.replace(":", "") + "00",
      "SUMMARY:" + icsText(b.title),
      "DESCRIPTION:Study block from Padikkalam.lk",
      "X-PADIKKALAM-COLOR:"+b.color[0].toUpperCase()+b.color.slice(1),
    );
    if (b.repeat !== "once")
      lines.push(
        "RRULE:" +
          (b.repeat.startsWith("days:")?"FREQ=WEEKLY;BYDAY="+["MO","TU","WE","TH","FR","SA","SU"].filter((_,i)=>Number(b.repeat.slice(5))&(1<<i)).join(","):b.repeat === "weekdays"
            ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
            : b.repeat === "daily"
              ? "FREQ=DAILY"
              : "FREQ=WEEKLY"),
      );
    if (b.reminder !== "none")
      lines.push(
        "BEGIN:VALARM",
        "TRIGGER:" + (b.reminder === "0" ? "PT0M" : "-PT" + b.reminder + "M"),
        "ACTION:DISPLAY",
        "DESCRIPTION:" + icsText(b.title),
        "END:VALARM",
      );
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
export function downloadCalendar(blocks: Block[]) {
  const url = URL.createObjectURL(
      new Blob([calendarFile(blocks)], { type: "text/calendar;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "Padikkalam-study-blocks.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
