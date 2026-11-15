#!/bin/sh
# Store packages: dist/chrome.zip (this folder as is) and dist/firefox.zip (same code, Firefox's manifest).
set -e
cd "$(dirname "$0")"
FILES="manifest.json background.js inpage.js site.js wallet.js options.html options.js icons LICENCE"
rm -rf dist && mkdir -p dist/chrome dist/firefox
cp -R $FILES dist/chrome/ && cp -R $FILES dist/firefox/
# Firefox: no service worker (a background script instead), an id, and what data it collects (none)
node -e '
const fs = require("fs"), f = "dist/firefox/manifest.json", m = JSON.parse(fs.readFileSync(f));
m.background = { scripts: ["background.js"] };
m.browser_specific_settings = { gecko: { id: "extension@instantwallet.io", strict_min_version: "140.0", data_collection_permissions: { required: ["none"] } } };
fs.writeFileSync(f, JSON.stringify(m, null, 2) + "\n");
'
(cd dist/chrome && zip -qr ../chrome.zip .) && (cd dist/firefox && zip -qr ../firefox.zip .)
ls -l dist/*.zip
