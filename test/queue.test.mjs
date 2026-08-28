import test from "node:test";
import assert from "node:assert/strict";
import { loadQueue } from "../scripts/queue.mjs";

test("queue contains posts 02 through 19 in order", async () => {
  const queue = await loadQueue();
  assert.deepEqual(queue.map((post) => post.id),
    Array.from({ length: 18 }, (_, index) => String(index + 2).padStart(2, "0")));
});

test("captions are complete and within Instagram's caption limit", async () => {
  const queue = await loadQueue();
  for (const post of queue) {
    assert.ok(post.caption.length > 80, `Post ${post.id} caption is unexpectedly short.`);
    assert.ok(post.caption.length <= 2200, `Post ${post.id} caption is too long.`);
    assert.match(post.caption, /#[A-Za-z]/, `Post ${post.id} has no hashtag.`);
  }
});

test("post 18 excludes editorial references and post 19 retains the agency license", async () => {
  const queue = await loadQueue();
  const post18 = queue.find((post) => post.id === "18");
  const post19 = queue.find((post) => post.id === "19");
  assert.doesNotMatch(post18.caption, /Fact-check references/);
  assert.match(post19.caption, /A3600115/);
});
