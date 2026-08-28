import { loadQueue } from "./queue.mjs";

const BUFFER_API_URL = "https://api.buffer.com";

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

async function bufferRequest(query, variables = {}) {
  const response = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${required("BUFFER_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Buffer returned HTTP ${response.status}.`);
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  return payload.data;
}

async function assertPublicImage(imageUrl) {
  const response = await fetch(imageUrl, { method: "HEAD", redirect: "follow" });
  if (!response.ok) throw new Error(`Buffer cannot fetch the image URL (HTTP ${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("image/jpeg")) {
    throw new Error(`Image URL must return image/jpeg; received ${contentType || "no content type"}.`);
  }
}

async function getInstagramChannel() {
  const account = await bufferRequest(`
    query SpyglassOrganizations {
      account {
        organizations { id name }
      }
    }
  `);
  const organizations = account?.account?.organizations || [];
  if (!organizations.length) throw new Error("No Buffer organization was found for this API key.");

  const instagramChannels = [];
  for (const organization of organizations) {
    const data = await bufferRequest(`
      query SpyglassChannels {
        channels(input: { organizationId: ${JSON.stringify(organization.id)} }) {
          id
          name
          displayName
          service
        }
      }
    `);
    for (const channel of data?.channels || []) {
      if (String(channel.service).toLowerCase() === "instagram") {
        instagramChannels.push({ ...channel, organizationId: organization.id });
      }
    }
  }

  const requestedId = process.env.BUFFER_CHANNEL_ID?.trim();
  if (requestedId) {
    const match = instagramChannels.find((channel) => channel.id === requestedId);
    if (!match) throw new Error("BUFFER_CHANNEL_ID is not a connected Instagram channel.");
    return match;
  }

  if (instagramChannels.length === 1) return instagramChannels[0];
  if (!instagramChannels.length) {
    throw new Error("No Instagram channel is connected to this Buffer account.");
  }
  throw new Error("More than one Instagram channel is connected. Add BUFFER_CHANNEL_ID as a GitHub repository variable.");
}

async function findDuplicate(channel, caption) {
  const data = await bufferRequest(`
    query SpyglassRecentPosts {
      posts(
        first: 50
        input: {
          organizationId: ${JSON.stringify(channel.organizationId)}
          filter: { status: [sent, scheduled], channelIds: [${JSON.stringify(channel.id)}] }
        }
      ) {
        edges { node { id text status } }
      }
    }
  `);
  return (data?.posts?.edges || [])
    .map((edge) => edge.node)
    .find((item) => (item.text || "").trim() === caption.trim());
}

async function main() {
  if (required("CONFIRMATION") !== "PUBLISH") {
    throw new Error('Safety check failed. Type exactly "PUBLISH" in the workflow confirmation field.');
  }

  const postId = required("POST_ID").padStart(2, "0");
  const imageBaseUrl = cleanBaseUrl(required("PUBLIC_IMAGE_BASE_URL"));
  const queue = await loadQueue();
  const post = queue.find((item) => item.id === postId);
  if (!post) throw new Error(`Post ${postId} is not in the queue.`);

  const imageUrl = `${imageBaseUrl}/${encodeURIComponent(post.image)}`;
  console.log(`Preparing post ${post.id}: ${post.title}`);
  await assertPublicImage(imageUrl);

  const channel = await getInstagramChannel();
  const duplicate = await findDuplicate(channel, post.caption);
  if (duplicate) throw new Error(`This exact caption already exists in Buffer as post ${duplicate.id}.`);

  const data = await bufferRequest(`
    mutation PublishSpyglassPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id status }
        }
        ... on MutationError { message }
      }
    }
  `, {
    input: {
      text: post.caption,
      channelId: channel.id,
      schedulingType: "automatic",
      mode: "shareNow",
      assets: [{ image: { url: imageUrl } }],
      metadata: { instagram: { type: "post", shouldShareToFeed: true } }
    }
  });

  const result = data?.createPost;
  if (!result?.post?.id) throw new Error(result?.message || "Buffer did not return a post id.");
  console.log(`Submitted post ${post.id} to Buffer: ${result.post.id} (${result.post.status || "processing"})`);
}

main().catch((error) => {
  console.error(`Publish failed: ${error.message}`);
  process.exit(1);
});
