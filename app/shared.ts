export const subjects: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  maths: "Combined Maths",
  biology: "Biology",
};
export const colors: Record<string, string> = {
  physics: "#b9d9c7",
  chemistry: "#f8b898",
  maths: "#d3c9ec",
  biology: "#dfe7a6",
};
export const inks: Record<string, string> = {
  physics: "#355e56",
  chemistry: "#984e36",
  maths: "#574778",
  biology: "#64743d",
};
export type Note = {
  id: string;
  title: string;
  author: string;
  subject: string;
  medium: string;
  format: string;
  status?: "published"|"pending"|"returned";
  verifiedName?:string;
  lesson?:string;unit?:string;tags?:string[];
  archived?: boolean;
  mine?: boolean;
  hasCover?: boolean;
  revision?: string;
  starter?: boolean;
  created?: string;
};
export const starters: Note[] = [
  "Waves & oscillations",
  "Structure & bonding",
  "Vectors in the plane",
  "Cell structure",
].map((title, i) => ({
  title,
  id: Object.keys(subjects)[i],
  subject: Object.keys(subjects)[i],
  medium: "English",
  author: "Padikkalam.lk",
  format: "pdf",
  starter: true,
}));
export type Release = {
  enabled: boolean;
  title: string;
  version: string;
  details: string;
  action: string;
  url: string;
  revision: string;
};
export type Settings = {
  uploads: boolean;
  starters: boolean;
  release: Release;
};
export const defaults: Settings = {
  uploads: true,
  starters: true,
  release: {
    enabled: false,
    title: "What’s new",
    version: "1.0",
    details: "",
    action: "details",
    url: "",
    revision: "",
  },
};
export const noteUrl = (n: Note) =>
  n.starter ? "/samples/" + n.id + ".pdf" : "/api/notes/" + n.id + "/file";
export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const r = await fetch("/api/" + path, { ...init, cache: "no-store" });
  const data = await r
    .json()
    .catch(() => ({ error: "The server is unavailable." }));
  if (!r.ok)
    throw Error((data as { error?: string })?.error || "Please try again.");
  return data as T;
}
export function send(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
