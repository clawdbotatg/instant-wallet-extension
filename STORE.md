# Stores: to do

Packages: `./build.sh` → `dist/chrome.zip`, `dist/firefox.zip`. Bump `version` in `manifest.json` for each upload.

## Chrome Web Store

Draft saved 10-28. Item ID `pbdhealfpnimcjjipgfhdplmecogkhdg`, publisher austin.griffith@ethereum.org (non-trader).
The dashboard can't be driven by an extension (Chrome blocks it); a headless clone of the Chrome profile over CDP works.
Google asks that account to sign in again every so often ("Verify it's you"): Austin has to do that by hand.

**Submitted for review 11-14 (0.1.13). Status: pending review.** Broad host permissions mean an in-depth review (days,
maybe longer). Publisher name "Instant Wallet", contact email verified, non-trader.

- The dashboard has to be clicked by hand (Austin). Every page has its own Save draft; leaving a page without it loses the edits.
- Listing: description, 2 screenshots (`1-wallet-list.png`, `2-approve.png`, on the v0.1.13 GitHub release), promo tile, category Tools.
- Official URL is empty: it needs instantwallet.io verified in Google Search Console (optional).
- For an update: bump the version, `./build.sh`, Package → Upload new package, Submit.

### Privacy tab

- **Single purpose:** Connect your Instant Wallet (instantwallet.io) to websites, so you can use it on any site that asks for a wallet.
- **storage:** Keeps your wallet address, the sites you connected, and your settings, on your computer.
- **tabs:** To tell you which site is asking (its address and icon), and to find the Instant Wallet window to hand the request to.
- **scripting:** Adds the wallet bridge to an Instant Wallet tab that was already open when the extension was installed or updated. Only on instantwallet.io.
- **Host permission (all sites, content scripts):** A wallet has to be there before a site looks for one. The script adds "Instant Wallet" to the site's wallet list (EIP-6963) and passes the site's wallet requests on. It reads nothing from the page.
- **Remote code:** No. All code is in the package. The wallet itself is a normal web page (instantwallet.io) in its own window.
- **Data use:** Nothing collected. Tick none. Certify all three (not sold, not used for anything else, not for credit).

## Firefox (addons.mozilla.org)

- [x] Firefox build (`dist/firefox.zip`): a background script instead of a service worker, id `extension@instantwallet.io`,
  Firefox 140+. `web-ext lint`: 0 errors. Tested in Firefox 160: shows in the wallet list, reads work.
- [ ] Mozilla account for Austin (none yet), then Submit a New Add-on → On this site
- [ ] Listing: same text and pictures as Chrome. Category: Other. Licence: MIT.
- [ ] Not tested in Firefox: Face ID in the wallet window. The wedgie can't work there (Firefox has no USB serial).
- [ ] Source code: not needed (nothing is minified or built).
