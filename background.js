// Instant Wallet extension, the background. It holds no keys. It routes: a site's request → the side panel, the
// answer → back to the site. Chrome stops this worker when idle, so nothing lives in memory: where an answer goes rides in the request id (rid = tab:frame:id), the rest is chrome.storage.
//   local:   account { address, chainIds }, wallet (the Instant Wallet origin last used), sites { origin: { chainId, connected } },
//            takeover (act as MetaMask), calls { hash: chainId }
//   session: see "the side panel" below

const WALLETS = ["https://instantwallet.io", "https://instant-wallet-b2jn.vercel.app"];

// the toolbar button opens the side panel: the whole wallet, docked next to the site
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  const fromWallet = WALLETS.includes(sender.origin);
  // a site's request slides the panel open. Chrome allows that only right after a click, so it's tried here, before
  // anything waits
  if (!fromWallet && m.type === "ask" && sender.tab)
    m.opening = Promise.race([
      chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(
        () => true,
        e => (console.warn("Instant Wallet: side panel didn't open:", e?.message || e), false),
      ),
      new Promise(ok => setTimeout(ok, 2000, false)), // it has hung (headless Chrome): don't hold every request
    ]);
  (fromWallet ? fromWalletPage(m, sender) : fromSite(m, sender)).then(reply, e => reply({ error: { code: -32603, message: String(e?.message || e) } }));
  return true;
});

// ------------------------------------------------------------------ sites

async function fromSite(m, sender) {
  if (m.type === "open") return openWallet(); // the side panel's button
  if (m.type === "panel-up") return inLine(panelUp); // a side panel's wallet is ready
  if (!sender.tab || m.type === "ready" || m.type === "res") return { error: { code: 4100, message: "Not allowed" } };
  if (m.type === "rpc") return rpc(m.chainId, m.method, m.params);
  if (m.type === "ask") {
    // connect (no wallet known yet) or a key request: to the side panel, answered later
    const origin = sender.origin;
    const entry = {
      rid: `${sender.tab.id}:${sender.frameId ?? 0}:${m.id}`,
      origin,
      icon: sender.tab.favIconUrl,
      method: m.method,
      params: m.params,
      chainId: m.chainId,
    };
    await forward(entry, m.opening);
    return { queued: true };
  }
  return { error: { code: 4200, message: "Unknown" } };
}

async function rpc(chainId, method, params) {
  const { wallet = WALLETS[0] } = await chrome.storage.local.get("wallet");
  const res = await fetch(`${wallet}/api/rpc/${Number(chainId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
  });
  const j = await res.json().catch(() => ({ error: { code: -32603, message: `RPC ${res.status}` } }));
  return j.error ? { error: j.error.code ? j.error : { code: -32603, message: String(j.error) } } : { result: j.result };
}

// ------------------------------------------------------------------ the side panel

// A site's request goes to the side panel in the site's window, slid open if it's closed. If Chrome won't open it
// (it allows that only right after a click) or its wallet doesn't come up, the request waits: the icon shows a count,
// and opening the panel hands them over.
// Closing the panel says no to what it was showing, like sliding the card down.
//   session: queue (requests waiting for a panel), sent { windowId: [rid] } (in a panel, unanswered)

// each panel holds a port open (panel.js): it closing = the panel closed
chrome.runtime.onConnect.addListener(port => {
  const [kind, windowId] = port.name.split(":");
  if (kind !== "panel" || port.sender?.origin !== location.origin) return;
  port.onDisconnect.addListener(() => inLine(() => panelClosed(windowId)));
});

async function panelClosed(windowId) {
  const { sent = {} } = await chrome.storage.session.get("sent");
  const rids = sent[windowId] || [];
  delete sent[windowId];
  await chrome.storage.session.set({ sent });
  for (const rid of rids) await answerSite(rid, { error: { code: 4001, message: "User rejected the request" } });
}

async function fromWalletPage(m, sender) {
  if (m.type === "ready") {
    const address = String(m.address);
    const chainIds = (m.chainIds || []).map(Number);
    await chrome.storage.local.set({ account: { address, chainIds }, wallet: sender.origin });
    return {};
  }
  if (m.type === "res") {
    await answerSite(m.rid, m.error ? { error: m.error } : { result: m.result });
    await inLine(async () => {
      const { sent = {} } = await chrome.storage.session.get("sent");
      for (const w in sent) sent[w] = sent[w].filter(r => r !== m.rid);
      await chrome.storage.session.set({ sent });
    });
  }
  return {};
}

async function answerSite(rid, answer) {
  const [tabId, frameId, id] = String(rid).split(":");
  await chrome.tabs.sendMessage(Number(tabId), { type: "res", id: Number(id), ...answer }, { frameId: Number(frameId) }).catch(() => {});
}

/** One request at a time. */
let line = Promise.resolve();
const inLine = f => (line = line.then(f, f));
const forward = (entry, opening) => inLine(() => forwardNow(entry, opening));

async function forwardNow(entry, opening) {
  if (await toPanel(entry)) return;
  if (opening && (await opening) && (await panelComesUp(entry))) return;
  const { queue = [] } = await chrome.storage.session.get("queue");
  await setQueue([...queue, entry]);
}

/** The side panel is open in the site's window with a wallet in it: the request goes there. */
async function toPanel(entry) {
  const site = await chrome.tabs.get(Number(entry.rid.split(":")[0])).catch(() => null);
  if (!site) return false;
  const req = entry.method === "eth_requestAccounts" ? null : entry; // connecting needs only the address
  const r = await chrome.runtime.sendMessage({ type: "panel", windowId: site.windowId, req }).catch(() => null);
  if (!r?.ready) return false;
  if (!req) await connect(entry);
  else {
    const { sent = {} } = await chrome.storage.session.get("sent");
    await chrome.storage.session.set({ sent: { ...sent, [site.windowId]: [...(sent[site.windowId] || []), entry.rid] } });
  }
  return true;
}

/** The panel just opened: give its wallet up to 10 s to load and say ready. */
async function panelComesUp(entry) {
  for (let i = 0; i < 40; i++) {
    await new Promise(ok => setTimeout(ok, 250));
    if (await toPanel(entry)) return true;
  }
  return false;
}

/** A panel's wallet came up: hand it what waits. Sites that closed meanwhile are dropped. */
async function panelUp() {
  const { queue = [] } = await chrome.storage.session.get("queue");
  const left = [];
  for (const entry of queue) {
    const site = await chrome.tabs.get(Number(entry.rid.split(":")[0])).catch(() => null);
    if (site && !(await toPanel(entry))) left.push(entry);
  }
  await setQueue(left);
}

async function setQueue(queue) {
  await chrome.storage.session.set({ queue });
  await chrome.action.setBadgeBackgroundColor({ color: "#1a9a4a" }).catch(() => {});
  await chrome.action.setBadgeText({ text: queue.length ? String(queue.length) : "" }).catch(() => {});
}

/** Connecting needs only the address, which the panel's wallet just gave us. */
async function connect(entry) {
  const { account, sites = {} } = await chrome.storage.local.get(["account", "sites"]);
  await chrome.storage.local.set({ sites: { ...sites, [entry.origin]: { ...sites[entry.origin], connected: true } } });
  await answerSite(entry.rid, { result: [account.address] });
}

/** The side panel's "Open Instant Wallet in a tab". */
async function openWallet() {
  const [open] = await chrome.tabs.query({ url: WALLETS.map(o => `${o}/*`) });
  if (open) {
    await chrome.tabs.update(open.id, { active: true }).catch(() => {});
    return chrome.windows.update(open.windowId, { focused: true }).catch(() => {});
  }
  const { wallet = WALLETS[0] } = await chrome.storage.local.get("wallet");
  await chrome.tabs.create({ url: `${wallet}/` });
}
