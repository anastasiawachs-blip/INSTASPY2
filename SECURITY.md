# Security

Do not commit Instagram access tokens, app secrets, passwords, verification codes, phone numbers, or email addresses.

Store the Instagram publishing token only as the GitHub Actions secret `INSTAGRAM_ACCESS_TOKEN`. If a token is ever exposed, revoke it in Meta immediately, create a replacement, and update the GitHub secret.
