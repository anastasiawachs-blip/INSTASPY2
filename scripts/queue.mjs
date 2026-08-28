import { readFile } from "node:fs/promises";
import path from "node:path";

const CAPTION_FILES = {
  agency: "agency-captions.md",
  notes: "investigation-notes-captions.md"
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractCaption(markdown, id, source) {
  const numericId = String(Number(id));
  const heading = source === "agency"
    ? new RegExp(`^## Post ${escapeRegExp(numericId)}\\s+—`)
    : new RegExp(`^## ${escapeRegExp(numericId)}\\s+—`);
  const nextHeading = source === "agency"
    ? /^## Post \d+\s+—/
    : /^## \d+\s+—/;

  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) {
    throw new Error(`Caption heading for post ${id} was not found in ${source}.`);
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (nextHeading.test(lines[index]) || (source === "notes" && /^---\s*$/.test(lines[index]))) {
      end = index;
      break;
    }
  }

  const caption = lines.slice(start + 1, end).join("\n").trim();
  if (!caption) {
    throw new Error(`Caption for post ${id} is empty.`);
  }
  return caption;
}

export async function loadQueue(root = process.cwd()) {
  const postsRoot = path.join(root, "posts");
  const manifest = JSON.parse(await readFile(path.join(postsRoot, "manifest.json"), "utf8"));
  const markdownBySource = {};

  for (const [source, filename] of Object.entries(CAPTION_FILES)) {
    markdownBySource[source] = await readFile(path.join(postsRoot, "captions", filename), "utf8");
  }

  return manifest.map((post) => ({
    ...post,
    caption: extractCaption(markdownBySource[post.captionSource], post.id, post.captionSource)
  }));
}
