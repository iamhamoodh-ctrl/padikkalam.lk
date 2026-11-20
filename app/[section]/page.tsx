import Studio from "../studio";
import { notFound } from "next/navigation";
const titles: Record<string, string> = {
  profile:"Student profile",read:"Study note",explore:"Explore",tutor:"Study tutor",
  monitor: "Study monitor",
  upload: "Upload a note",
  "my-uploads": "My uploads",
  vision: "Our vision",
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return { title: (titles[section] || "Page") + " · Padikkalam.lk" };
}

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["profile","read","explore","tutor","monitor", "upload", "my-uploads", "vision"].includes(section))
    notFound();
  return <Studio page={section} />;
}
