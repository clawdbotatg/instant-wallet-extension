# instant-wallet-extension

Overview: `README.md`. The website side: clawdbotatg/instant-wallet, `web/lib/extension.ts`.

- **Bump `version` in `manifest.json` on every change**, in the same commit. Austin reloads the unpacked extension and
  checks the version in `chrome://extensions`; tell him the new number.
- Austin loads it unpacked from this folder (`~/clawd/clawd-harness/projects/instant-wallet-extension`), so a push
  needs only a reload, no store release.
- Check JS with `node --check`. No build step, no tests.
