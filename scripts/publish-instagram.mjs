import { loadQueue } from "./queue.mjs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment value: ${name}`);
  return value;
}

function cleanBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("PUBLIC_IMAGE_BASE_URL must use HTTPS.");
  return url.href.replace(/\/$/, "");
}

async function metaRequest(baseUrl, pathname, { method = "GET", params = {} } = {}) {
  const accessToken = required("INSTAGRAM_ACCESS_TOKEN");
  const url = new URL(`${baseUrl}/${pathname.replace(/^\//, "")}`);
  const values = new URLSearchParams({ ...params, access_token: accessToken });
  const options = method === "GET"
    ? { method, headers: { Accept: "application/json" } }
    : {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: values
      };

  if (method === "GET") url.search = values.toString();
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    const message = payload.error?.message || `HTTP ${response.status}`;
    const code = payload.error?.code ? ` (Meta code ${payload.error.code})` : "";
    throw new Error(`${message}${code}`);
  }
  return payload;
}

async function assertPublicImage(imageUrl) {
  const response = await fetch(imageUrl, { method: "HEAD", redirect: "follow" });
  if (!response.ok) throw new Error(`Instagram cannot fetch the image URL (HTTP ${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("image/jpeg")) {
    throw new Error(`Image URL must return image/jpeg; received ${contentType || "no content type"}.`);
  }
}

async function findDuplicate(baseUrl, userId, caption) {
  const media = await metaRequest(baseUrl, `${userId}/media`, {
    params: { fields: "id,caption,timestamp,permalink", limit: "50" }
  });
  return (media.data || []).find((item) => (item.caption || "").trim() === caption.trim());
}

async function waitForContainer(baseUrl, containerId) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const status = await metaRequest(baseUrl, containerId, {
      params: { fields: "status_code,status" }
    });
    if (status.status_code === "FINISHED") return;
    if (["ERROR", "EXPIRED"].includes(status.status_code)) {
      throw new Error(`Instagram media processing ended with ${status.status_code}: ${status.status || "no details"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(2000 + attempt * 250, 5000)));
  }
  throw new Error("Instagram did not finish processing the image within the allowed time.");
}

async function main() {
  if (required("CONFIRMATION") !== "PUBLISH") {
    throw new Error('Safety check failed. Type exactly "PUBLISH" in the workflow confirmation field.');
  }

  const postId = required("POST_ID").padStart(2, "0");
  const userId = required("INSTAGRAM_USER_ID");
  const graphVersion = (process.env.META_GRAPH_VERSION || "v26.0").trim();
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error(`Invalid META_GRAPH_VERSION: ${graphVersion}`);
  const baseUrl = `https://graph.instagram.com/${graphVersion}`;
  const imageBaseUrl = cleanBaseUrl(required("PUBLIC_IMAGE_BASE_URL"));
  const queue = await loadQueue();
  const post = queue.find((item) => item.id === postId);
  if (!post) throw new Error(`Post ${postId} is not in the queue.`);

  const imageUrl = `${imageBaseUrl}/${encodeURIComponent(post.image)}`;
  console.log(`Preparing post ${post.id}: ${post.title}`);
  await assertPublicImage(imageUrl);

  const duplicate = await findDuplicate(baseUrl, userId, post.caption);
  if (duplicate) {
    throw new Error(`This exact caption is already published: ${duplicate.permalink || duplicate.id}`);
  }

  const container = await metaRequest(baseUrl, `${userId}/media`, {
    method: "POST",
    params: { image_url: imageUrl, caption: post.caption }
  });
  if (!container.id) throw new Error("Instagram did not return a media container id.");

  await waitForContainer(baseUrl, container.id);
  const published = await metaRequest(baseUrl, `${userId}/media_publish`, {
    method: "POST",
    params: { creation_id: container.id }
  });
  if (!published.id) throw new Error("Instagram did not return a published media id.");

  const result = await metaRequest(baseUrl, published.id, { params: { fields: "permalink" } });
  console.log(`Published post ${post.id}: ${result.permalink || published.id}`);
}

main().catch((error) => {
  console.error(`Publish failed: ${error.message}`);
  process.exit(1);
});
