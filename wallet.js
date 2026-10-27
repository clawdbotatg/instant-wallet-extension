// Runs on the Instant Wallet site. Passes sites' requests to the page (lib/extension.ts) and the answers back.
// Chrome only adds this to tabs opened after install; background.js adds it to the ones already open, so it can
// arrive late: "hello" asks the page to say "ready" again.
// Also runs framed in the extension's side panel (panel.html): there sites' requests come from the panel, not the background.
const EXT = new URL(chrome.runtime.getURL("")).origin;
const inPanel = window !== top && location.ancestorOrigins?.[0] === EXT;
if (!globalThis.__iwWallet && (window === top || inPanel)) {
globalThis.__iwWallet = true;
let ready = null; // { address, chainIds } while a wallet is open on this page
const tellPanel = () => inPanel && parent.postMessage({ __iwp: "ready", ready: !!ready }, EXT);

window.addEventListener("message", e => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data;
  if (d?.__iwx === "ready") {
    ready = { address: d.address, chainIds: d.chainIds };
    chrome.runtime.sendMessage({ type: "ready", ...ready }).catch(() => {});
    tellPanel();
  } else if (d?.__iwx === "gone") {
    ready = null;
    tellPanel();
  } else if (d?.__iwx === "res") {
    chrome.runtime.sendMessage({ type: "res", rid: d.rid, result: d.result, error: d.error }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.type === "ping") return reply({ ready: !!ready });
  if (m.type === "req") window.postMessage({ __iwx: "req", ...m.req }, location.origin);
});

window.addEventListener("message", e => {
  if (!inPanel || e.source !== parent || e.origin !== EXT) return;
  if (e.data?.__iwp === "req") window.postMessage({ __iwx: "req", ...e.data.req }, location.origin);
  else if (e.data?.__iwp === "ping") tellPanel();
});

window.postMessage({ __iwx: "hello" }, location.origin);
}
