import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const projectRoot = process.cwd();
const dataRoot = path.join(projectRoot, "src", "_data");
const outputRoot = path.join(projectRoot, "src", "assets", "resource-previews");

fs.mkdirSync(outputRoot, { recursive: true });

function slugify(value = "resource") {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "resource";
}

function shortHash(value = "") {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 7);
}

function hasAutomaticThumbnail(value = "") {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return Boolean(url.pathname.slice(1).split("/")[0]);
    if (url.hostname.includes("youtube.com")) {
      return Boolean(url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]);
    }
    if (url.hostname.includes("google.com")) {
      return /\/(?:file|document|presentation|spreadsheets)\/d\/[^/]+/.test(url.pathname) || Boolean(url.searchParams.get("id"));
    }
  } catch {
    return false;
  }
  return false;
}

function pointSizeFor(title) {
  if (title.length > 115) return "31";
  if (title.length > 88) return "36";
  if (title.length > 65) return "42";
  if (title.length > 44) return "49";
  return "58";
}

function createCover({ title, type, section, destination }) {
  const label = `${type || "RESOURCE"}  •  ${section || "COACHING RESOURCE"}`.toUpperCase();
  const displayTitle = title.toUpperCase();
  const temporary = `${destination}.tmp.png`;
  const pngSignature = "89504e470d0a1a0a";

  for (let attempt = 1; attempt <= 4; attempt++) {
    fs.rmSync(temporary, { force: true });
    execFileSync("convert", [
      "-size", "600x800", "xc:#050505",
      "-fill", "#171217", "-draw", "rectangle 0,0 600,800",
      "-fill", "#2a1721", "-draw", "polygon 250,0 600,0 600,520",
      "-stroke", "#f06ba8", "-strokewidth", "18", "-fill", "none", "-draw", "circle 540,120 690,120",
      "-stroke", "none", "-fill", "#f06ba8", "-draw", "rectangle 0,0 600,18",
      "-font", "Helvetica-Bold", "-pointsize", "25", "-fill", "#ff9cc6", "-gravity", "northwest", "-annotate", "+50+65", label,
      "(", "-size", "500x430", "-background", "none", "-fill", "white", "-font", "Helvetica-Narrow-BoldOblique", "-pointsize", pointSizeFor(displayTitle), "-gravity", "southwest", `caption:${displayTitle}`, ")",
      "-gravity", "northwest", "-geometry", "+50+180", "-composite",
      "-font", "Helvetica-Bold", "-pointsize", "23", "-fill", "#f06ba8", "-gravity", "southwest", "-annotate", "+50+62", "PICK-6 COACHING RESOURCES",
      "-strip", "-define", "png:compression-level=9", temporary
    ], { stdio: "ignore" });

    if (fs.existsSync(temporary) && fs.statSync(temporary).size > 1000) {
      const signature = fs.readFileSync(temporary).subarray(0, 8).toString("hex");
      if (signature === pngSignature) {
        fs.renameSync(temporary, destination);
        return;
      }
    }
  }

  throw new Error(`Unable to generate a valid PNG preview for ${title}`);
}

function ensurePreview(item, section, fallbackType) {
  if (!item?.title || !item?.url) return false;
  const isGeneratedPreview = item.preview?.startsWith("/assets/resource-previews/");
  if (item.preview && !isGeneratedPreview) return false;
  if (!item.preview && hasAutomaticThumbnail(item.url)) return false;

  const filename = isGeneratedPreview
    ? path.basename(item.preview).replace(/\.webp$/i, ".png")
    : `${slugify(item.title)}-${shortHash(item.url)}.png`;
  const destination = path.join(outputRoot, filename);
  createCover({
    title: item.title,
    type: item.type || fallbackType,
    section,
    destination
  });
  item.preview = `/assets/resource-previews/${filename}`;
  return true;
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, filename), "utf8"));
}

function writeJson(filename, value) {
  fs.writeFileSync(path.join(dataRoot, filename), `${JSON.stringify(value, null, 2)}\n`);
}

let generated = 0;

const resources = readJson("coachingResources.json");
for (const category of resources) {
  for (const group of category.groups || []) {
    for (const item of group.items || []) {
      if (ensurePreview(item, category.title, item.type || "Resource")) generated++;
    }
  }
}
writeJson("coachingResources.json", resources);

const drills = readJson("coachingDrills.json");
for (const group of drills) {
  for (const item of group.items || []) {
    if (ensurePreview(item, group.title, "Drill")) generated++;
  }
}
writeJson("coachingDrills.json", drills);

const development = readJson("coachingDevelopment.json");
for (const item of development.learning || []) {
  if (ensurePreview(item, "Development", "Learning")) generated++;
}
for (const item of development.officiating || []) {
  if (ensurePreview(item, "Development", "Officiating")) generated++;
}
for (const item of development.books || []) {
  if (ensurePreview(item, "Development", "Book")) generated++;
}
writeJson("coachingDevelopment.json", development);

for (const filename of fs.readdirSync(outputRoot)) {
  if (filename.endsWith(".webp") || filename.endsWith(".tmp.png")) {
    fs.rmSync(path.join(outputRoot, filename), { force: true });
  }
}

console.log(`Generated ${generated} local portrait resource previews in ${path.relative(projectRoot, outputRoot)}.`);
