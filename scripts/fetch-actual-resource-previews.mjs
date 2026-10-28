import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const projectRoot = process.cwd();
const dataRoot = path.join(projectRoot, "src", "_data");
const assetsRoot = path.join(projectRoot, "src", "assets");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rfgf-actual-previews-"));
const reportPath = path.join(projectRoot, "actual-resource-preview-report.json");
const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36";

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, filename), "utf8"));
}

function collectItems() {
  const items = [];
  const resources = readJson("coachingResources.json");
  for (const category of resources) {
    for (const group of category.groups || []) {
      for (const item of group.items || []) items.push({ ...item, section: category.title });
    }
  }

  const drills = readJson("coachingDrills.json");
  for (const group of drills) {
    for (const item of group.items || []) items.push({ ...item, section: `Drills — ${group.title}` });
  }

  const development = readJson("coachingDevelopment.json");
  for (const item of development.learning || []) items.push({ ...item, section: "Development — Learning" });
  for (const item of development.officiating || []) items.push({ ...item, section: "Development — Officiating" });
  for (const item of development.books || []) items.push({ ...item, section: "Development — Books" });

  return items.filter((item) => item.preview?.startsWith("/assets/resource-previews/") && item.url);
}

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findMetaImage(html, baseUrl) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const candidates = [];
  for (const tag of tags) {
    const attributes = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
    }
    const key = (attributes.property || attributes.name || "").toLowerCase();
    if (["og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"].includes(key) && attributes.content) {
      candidates.push(attributes.content);
    }
  }

  const imageLink = html.match(/<link\b(?=[^>]*\brel=["'][^"']*image_src[^"']*["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)?.[1];
  if (imageLink) candidates.push(decodeHtml(imageLink));

  for (const candidate of candidates) {
    try {
      return new URL(candidate, baseUrl).href;
    } catch {
      // Try the next candidate.
    }
  }
  return "";
}

async function fetchWithTimeout(url, timeoutMs = 28000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": userAgent, accept: "text/html,application/pdf,image/*,*/*;q=0.8" }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function validPng(filename) {
  if (!fs.existsSync(filename) || fs.statSync(filename).size < 1500) return false;
  return fs.readFileSync(filename).subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
}

function normalizeImage(source, destination, mode = "contain") {
  const temporary = `${destination}.${crypto.randomUUID()}.tmp.png`;
  const resize = mode === "screenshot" ? "600x800!" : "560x760";
  const args = [source, "-auto-orient", "-resize", resize];
  if (mode !== "screenshot") args.push("-gravity", "center", "-background", "white", "-extent", "600x800");
  args.push("-strip", "-define", "png:compression-level=9", temporary);

  for (let attempt = 1; attempt <= 4; attempt++) {
    fs.rmSync(temporary, { force: true });
    execFileSync("convert", args, { stdio: "ignore" });
    if (validPng(temporary)) {
      fs.renameSync(temporary, destination);
      return;
    }
  }
  fs.rmSync(temporary, { force: true });
  throw new Error("Image normalization failed");
}

function renderPdf(pdfFile, destination) {
  const prefix = path.join(temporaryRoot, crypto.randomUUID());
  execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-png", "-r", "120", pdfFile, prefix], { stdio: "ignore" });
  const firstPage = `${prefix}.png`;
  normalizeImage(firstPage, destination, "contain");
  fs.rmSync(firstPage, { force: true });
}

async function downloadImage(url, destination) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Image request returned ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`Expected image, received ${contentType || "unknown content"}`);
  const rawImage = path.join(temporaryRoot, `${crypto.randomUUID()}.image`);
  fs.writeFileSync(rawImage, Buffer.from(await response.arrayBuffer()));
  normalizeImage(rawImage, destination, "contain");
  fs.rmSync(rawImage, { force: true });
}

async function createActualPreview(item) {
  const destination = path.join(assetsRoot, item.preview.replace(/^\/assets\//, ""));
  const originalBackup = `${destination}.generated-backup`;
  fs.copyFileSync(destination, originalBackup);

  try {
    const response = await fetchWithTimeout(item.url);
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const finalUrl = response.url || item.url;

    if (contentType.includes("application/pdf") || /\.pdf(?:$|[?#])/i.test(finalUrl)) {
      const pdfFile = path.join(temporaryRoot, `${crypto.randomUUID()}.pdf`);
      fs.writeFileSync(pdfFile, Buffer.from(await response.arrayBuffer()));
      renderPdf(pdfFile, destination);
      fs.rmSync(pdfFile, { force: true });
      fs.rmSync(originalBackup, { force: true });
      return { method: "pdf-first-page", finalUrl };
    }

    if (contentType.includes("text/html")) {
      const html = await response.text();
      const imageUrl = findMetaImage(html, finalUrl);
      if (imageUrl) {
        try {
          await downloadImage(imageUrl, destination);
          fs.rmSync(originalBackup, { force: true });
          return { method: "official-page-image", finalUrl, imageUrl };
        } catch {
          // Fall through to a live page screenshot.
        }
      }
    }

    const screenshotUrl = `https://image.thum.io/get/width/600/crop/800/noanimate/${item.url}`;
    await downloadImage(screenshotUrl, destination);
    fs.rmSync(originalBackup, { force: true });
    return { method: "live-page-screenshot", finalUrl, imageUrl: screenshotUrl };
  } catch (error) {
    fs.copyFileSync(originalBackup, destination);
    fs.rmSync(originalBackup, { force: true });
    throw error;
  }
}

const items = collectItems();
const report = [];

try {
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    process.stdout.write(`[${index + 1}/${items.length}] ${item.title} ... `);
    try {
      const result = await createActualPreview(item);
      report.push({ status: "success", title: item.title, url: item.url, preview: item.preview, ...result });
      console.log(result.method);
    } catch (error) {
      report.push({ status: "failed", title: item.title, url: item.url, preview: item.preview, error: error.message });
      console.log(`FAILED: ${error.message}`);
    }
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

const successful = report.filter((item) => item.status === "success").length;
const failed = report.length - successful;
console.log(`Finished: ${successful} actual previews created; ${failed} require manual follow-up.`);
console.log(`Report: ${path.relative(projectRoot, reportPath)}`);
