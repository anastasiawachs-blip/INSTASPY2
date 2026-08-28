# Spyglass Instagram Publisher

This repository publishes **one selected Spyglass Investigations post at a time** through Buffer's official API. Buffer connects directly to the Instagram professional account, so no Facebook account or Facebook Page is required. The repository has no automatic schedule and no bulk-publish option.

## Safety controls

- A person must choose one post in GitHub Actions.
- A person must type `PUBLISH` for every run.
- The workflow refuses to send an exact duplicate caption already found in recent Buffer posts.
- The Buffer API key is read only from a GitHub Actions secret.
- The queued captions contain no public phone number or email address.
- Post 01 is not queued because it was already published manually.

## One-time setup

1. Keep this repository public so Buffer can retrieve each JPEG from its public GitHub URL. Credentials are never stored in the repository.
2. Connect `@spyglassinvestigations` to Buffer using the direct Professional Instagram login.
3. In Buffer, open **Settings → API → Personal Access → New Key**. Give it permission to read account/channel/post data and create posts. Copy the key when Buffer displays it.
4. In this GitHub repository, open **Settings → Secrets and variables → Actions** and create the repository secret `BUFFER_API_KEY`.
5. If the Buffer account ever contains more than one Instagram channel, create the repository variable `BUFFER_CHANNEL_ID` for the Spyglass Instagram channel. It is not needed when Spyglass is the only Instagram channel.

Never paste the Buffer API key into a file, commit, issue, workflow input, or chat message.

## Publish one post

1. Open **Actions → Publish one Instagram post → Run workflow**.
2. Choose one post number.
3. Type `PUBLISH`.
4. Run the workflow and confirm the post in Buffer and Instagram.

## Local validation

```bash
npm test
npm run validate
```

Local validation never contacts Buffer or Instagram and never publishes anything.
