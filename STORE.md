# Chrome Web Store: to do

Not started. What's needed to list the extension.

## Account
- [ ] Chrome developer account (one-time $5): https://chrome.google.com/webstore/devconsole
- [ ] Publisher name "Instant Wallet", contact email, verified
- [ ] 2-step verification on the Google account (required)

## Package
- [ ] Zip of this folder (no `.git`, no `PLAN-*.md`, no `STORE.md`)
- [ ] Version bump in `manifest.json` for each upload

## Listing
- [ ] Short description (132 chars max)
- [ ] Long description
- [ ] Icon 128×128 (have: `icons/128.png`)
- [ ] Screenshots, 1280×800: wallet list on Uniswap, the small wallet window, the toolbar menu
- [ ] Small promo tile 440×280
- [ ] Category: Productivity (or Developer Tools)

## Privacy (the review checks these)
- [ ] Privacy policy URL (instantwallet.io/privacy exists: add a line about the extension)
- [ ] Single purpose: "Connect your Instant Wallet to websites"
- [ ] Why each permission:
  - `storage`: your address, connected sites, settings
  - `tabs`: tell the wallet which site is asking (its address and icon)
  - `scripting`: add the wallet bridge to an Instant Wallet tab opened before install
  - all sites (content scripts): show Instant Wallet in any site's wallet list
- [ ] Data use: no data sold or sent anywhere but instantwallet.io (reads go through its RPC)
- [ ] No remote code: true (the wallet page runs in its own tab, not in the extension)

## Before submitting
- [ ] A real swap works end to end (waiting on the wedgie memory fix)
- [ ] Try it next to MetaMask and Rainbow
- [ ] Remove `instant-wallet-b2jn.vercel.app` if instantwallet.io is the only home by then

Review takes a few days. Wallet extensions with all-sites access often get a closer look.
