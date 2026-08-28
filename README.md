# Spyglass Instagram Publisher

This repository publishes **one selected Spyglass Investigations post at a time** through Meta's official Instagram API. It deliberately has no automatic schedule and no bulk-publish option.

## Safety controls

- A person must choose one post in GitHub Actions.
- A person must type `PUBLISH` for every run.
- The workflow refuses to publish an exact duplicate caption found among recent Instagram media.
- The Instagram token is read only from a GitHub Actions secret.
- The queued captions contain no public phone number or email address.
- Post 01 is not queued because it was already published manually.

## One-time setup

1. Keep this repository public. Instagram must be able to retrieve each JPEG from its public GitHub URL. The posts are intended for public release; credentials are never stored in the repository.
2. Change `@spyglassinvestigations` to an Instagram **Business** account.
3. In Meta for Developers, create an app using **Instagram API with Instagram Login** and authorize the Spyglass account for content publishing.
4. Request the current publishing permissions required by Meta, including basic account access and content publishing.
5. In this GitHub repository, open **Settings → Secrets and variables → Actions**:
   - Create the repository secret `INSTAGRAM_ACCESS_TOKEN`.
   - Create the repository variable `INSTAGRAM_USER_ID`.
   - Optional: create `META_GRAPH_VERSION`; the workflow currently defaults to `v26.0`.

Never paste the Instagram token into a file, commit, issue, workflow input, or chat message.

## Publish one post

1. Open **Actions → Publish one Instagram post → Run workflow**.
2. Choose one post number.
3. Type `PUBLISH`.
4. Run the workflow and review the published permalink in the final log line.

## Local validation

```bash
npm test
npm run validate
```

Local validation never contacts Instagram and never publishes anything.
