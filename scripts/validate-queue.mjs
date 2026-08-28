import { access } from "node:fs/promises";
import path from "node:path";
import { loadQueue } from "./queue.mjs";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;

const queue = await loadQueue();
const ids = new Set();
const errors = [];

for (const post of queue) {
  if (ids.has(post.id)) errors.push(`Duplicate post id: ${post.id}`);
  ids.add(post.id);
  if (!/^\d{2}$/.test(post.id)) errors.push(`Invalid post id: ${post.id}`);
  if (!post.image.endsWith(".jpg")) errors.push(`Post ${post.id} is not a JPEG.`);
  if (post.caption.length > 2200) errors.push(`Post ${post.id} caption exceeds 2,200 characters.`);
  if (EMAIL.test(post.caption)) errors.push(`Post ${post.id} contains an email address.`);
  if (PHONE.test(post.caption)) errors.push(`Post ${post.id} contains a phone number.`);
  try {
    await access(path.join(process.cwd(), "posts", "images", post.image));
  } catch {
    errors.push(`Post ${post.id} image is missing: ${post.image}`);
  }
}

if (queue.length !== 18) errors.push(`Expected 18 queued posts; found ${queue.length}.`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${queue.length} posts (02–19). No public phone number or email was found.`);
