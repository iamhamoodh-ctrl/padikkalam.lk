import { colors, inks, subjects } from "./shared";
const loaded = new Map<string, Promise<void>>();
function load(src: string) {
  if (!loaded.has(src))
    loaded.set(
      src,
      new Promise((ok, no) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => ok();
        script.onerror = () => {
          loaded.delete(src);
          no(Error("Could not load the document tools. Please retry."));
        };
        document.head.appendChild(script);
      }),
    );
  return loaded.get(src)!;
}
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const p of text.split(/\r?\n/)) {
    let line = "";
    for (const w of p.trim().split(/\s+/)) {
      const full = line ? line + " " + w : w;
      if (ctx.measureText(full).width <= width) {
        line = full;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const ch of w) {
        if (line && ctx.measureText(line + ch).width > width) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}
const jpeg = (c: HTMLCanvasElement, quality = 0.86) =>
  new Promise<Blob>((ok, no) =>
    c.toBlob(
      (b) => (b ? ok(b) : no(Error("Image export failed."))),
      "image/jpeg",
      quality,
    ),
  );
function designFor(prompt:string,sub:string){
 const text=prompt.trim().toLowerCase();
 const palettes:[RegExp,string,string][]=[
  [/blue|நீலம்|නිල්/,"#bedcf0","#214966"],[/green|பச்சை|කොළ/,"#c6dec8","#284c36"],[/yellow|gold|மஞ்சள்|කහ/,"#f7db7c","#594815"],[/purple|violet|ஊதா|දම්/,"#e2d2f0","#59416e"],[/pink|rose|රෝස/,"#efc8d6","#713c51"],[/orange|peach|செம்மஞ்சள்/,"#f1bf9e","#71452c"],[/white|cream|வெள்ளை|සුදු/,"#faf5e8","#3b4238"]];
 const p=palettes.find(([re])=>re.test(text)), dark=/dark|night|black|கருப்பு|කළු/.test(text);
 const motifs:[RegExp,string][]=[[/waves?|அலை|තරංග/,"physics"],[/atom|orbit|molecule|அணு|පරමාණු/,"chemistry"],[/vectors?|geometr|toroid|கணித|ගණිත/,"maths"],[/leaf|leaves|botanic|plant|இலை|ශාක/,"biology"]];
 return {paper:dark?(p?.[2]||"#23382f"):(p?.[1]||colors[sub]),ink:dark?(p?.[1]||"#f1e9cd"):(p?.[2]||inks[sub]),subject:motifs.find(([re])=>re.test(text))?.[1]||sub,grid:/grid|graph paper|கட்டம்|කොටු/.test(text),minimal:/minimal|simple|எளிமை|සරල/.test(text)};
}
export async function coverImage(
  title: string,
  author: string,
  sub: string,
  medium: string,
  seed: string,
  prompt = "",
) {
  await load("/art/cover-art.js");
  const c = canvas(800, 1131),
    ctx = c.getContext("2d")!;
  const design=designFor(prompt,sub);
  ctx.fillStyle = design.paper;
  ctx.fillRect(0, 0, 800, 1131);
  ctx.fillStyle = design.ink;
  if(design.grid){ctx.save();ctx.globalAlpha=0.11;for(let x=0;x<800;x+=40)ctx.fillRect(x,0,1,1131);for(let y=0;y<1131;y+=40)ctx.fillRect(0,y,800,1);ctx.restore();}
  ctx.fillRect(35, 0, 2, 1131);
  ctx.font = "bold 21px sans-serif";
  ctx.fillText("PADIKKALAM.LK     /     A·L STUDY NOTES", 72, 92);
  ctx.font = "22px sans-serif";
  ctx.fillText(subjects[sub] + "   ·   " + medium, 72, 159);
  let size = 68,
    lines: string[] = [];
  do {
    ctx.font = "bold " + size + "px serif";
    lines = wrap(ctx, title || "Untitled note", 652);
    size -= 2;
  } while (lines.length * (size + 10) > 265 && size > 26);
  lines.forEach((l, i) => ctx.fillText(l, 72, 273 + i * (size + 10)));
  (window as any).FolioArt.draw(ctx, {
    x: design.minimal?174:64,
    y: design.minimal?618:548,
    width: design.minimal?452:672,
    height: design.minimal?270:390,
    subject: design.subject,
    seed: prompt.trim()?seed+"|"+prompt.trim():seed,
    ink: design.ink,
  });
  ctx.fillStyle = design.ink;
  ctx.fillRect(72, 982, 654, 2);
  ctx.font = "25px sans-serif";
  wrap(ctx, author || "Student contributor", 650)
    .slice(0, 2)
    .forEach((l, i) => ctx.fillText(l, 72, 1042 + i * 29));
  return jpeg(c);
}
async function photo(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    const ratio = Math.min(1, 1800 / Math.max(im.width, im.height)),
      c = canvas(
        Math.max(1, Math.round(im.width * ratio)),
        Math.max(1, Math.round(im.height * ratio)),
      );
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(im, 0, 0, c.width, c.height);
    return await jpeg(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function createFile(
  format: string,
  files: File[],
  written: string,
  title: string,
  cover: Blob | null,
) {
  if (format === "picture" || format === "voice" || (format === "pdf" && !cover)) return files[0];
  await load("/vendor/pdf-lib.min.js");
  const { PDFDocument } = (window as any).PDFLib;
  const doc =
    format === "pdf"
      ? await PDFDocument.load(await files[0].arrayBuffer())
      : await PDFDocument.create();
  async function addImage(blob: Blob, front = false) {
    const img = await doc.embedJpg(await blob.arrayBuffer()),
      p = front ? doc.insertPage(0, [595, 842]) : doc.addPage([595, 842]),
      s = Math.min(595 / img.width, 842 / img.height);
    p.drawImage(img, {
      x: (595 - img.width * s) / 2,
      y: (842 - img.height * s) / 2,
      width: img.width * s,
      height: img.height * s,
    });
  }
  if (format === "photos") {
    for (const f of files) await addImage(await photo(f));
  }
  if (format === "written") {
    const c = canvas(1000, 1415),
      x = c.getContext("2d")!;
    x.font = "26px sans-serif";
    const lines = wrap(x, written, 850);
    for (let at = 0; at < lines.length; at += 25) {
      x.fillStyle = "#fffefa";
      x.fillRect(0, 0, 1000, 1415);
      x.fillStyle = "#173e32";
      x.font = "bold 31px serif";
      x.fillText(title, 72, 91, 855);
      x.font = "26px sans-serif";
      lines
        .slice(at, at + 25)
        .forEach((l, i) => x.fillText(l, 72, 172 + i * 44));
      x.font = "19px sans-serif";
      x.fillText("Padikkalam.lk   ·   " + (Math.floor(at / 25) + 1), 72, 1334);
      await addImage(await jpeg(c));
    }
  }
  if (cover) await addImage(cover, true);
  doc.setTitle(title);
  return new File([await doc.save()], title + ".pdf", {
    type: "application/pdf",
  });
}
