const $ = id => document.getElementById(id);

async function draw() {
  const { account, sites = {}, takeover = false } = await chrome.storage.local.get(["account", "sites", "takeover"]);
  $("who").innerHTML = account
    ? `<div class="addr"></div><div class="dim">Same address on every network.</div>`
    : `<div class="dim">Open Instant Wallet once so the extension knows your address.</div>`;
  if (account) $("who").firstChild.textContent = account.address;
  $("takeover").checked = takeover;
  const list = $("sites");
  list.textContent = "";
  for (const [origin, s] of Object.entries(sites)) {
    if (!s.connected) continue;
    const row = document.createElement("div");
    row.className = "row";
    row.style.borderTop = "none";
    row.style.padding = "4px 0";
    const name = document.createElement("span");
    name.textContent = new URL(origin).host;
    const drop = document.createElement("button");
    drop.textContent = "Disconnect";
    drop.onclick = async () => {
      const { sites = {} } = await chrome.storage.local.get("sites");
      sites[origin] = { ...sites[origin], connected: false };
      await chrome.storage.local.set({ sites });
      draw();
    };
    row.append(name, drop);
    list.append(row);
  }
}

$("takeover").onchange = e => chrome.storage.local.set({ takeover: e.target.checked });
$("open").onclick = () => chrome.runtime.sendMessage({ type: "open" });
chrome.storage.onChanged.addListener((_c, area) => area === "local" && draw());
chrome.storage.local.get("wallet").then(({ wallet = "https://instantwallet.io" }) => ($("wallet").src = `${wallet}/?in=extension`));

// Sites' requests in this window come here while the framed wallet is open (wallet.js in the frame says so).
let ready = false;
let windowId = null;
chrome.windows.getCurrent().then(w => (windowId = w.id));
window.addEventListener("message", e => {
  if (e.source === $("wallet").contentWindow && e.data?.__iwp === "ready") ready = e.data.ready;
});
chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.type !== "panel" || m.windowId !== windowId) return;
  if (ready && m.req) $("wallet").contentWindow.postMessage({ __iwp: "req", req: m.req }, new URL($("wallet").src).origin);
  reply({ ready });
});
draw();
