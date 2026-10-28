// Instant Wallet extension, the background. It holds no keys. It routes: a site's request → the Instant Wallet
// window, the answer → back to the site. Chrome stops this worker when idle, so nothing lives in memory: where an answer
// goes rides in the request id (rid = tab:frame:id), the rest is chrome.storage.
//   local:   account { address, chainIds }, wallet (the Instant Wallet origin last used), sites { origin: { chainId, connected } },
//            takeover (act as MetaMask), calls { hash: chainId }
//   session: see "the wallet window" below

const WALLETS = ["https://instantwallet.io", "https://instant-wallet-b2jn.vercel.app"];

// the toolbar button opens the same window, with the whole wallet in it
chrome.action.onClicked.addListener(() => inLine(() => showWallet()));

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  const fromWallet = WALLETS.includes(sender.origin);
  (fromWallet ? fromWalletPage(m, sender) : fromSite(m, sender)).then(reply, e => reply({ error: { code: -32603, message: String(e?.message || e) } }));
  return true;
});

// ------------------------------------------------------------------ sites

async function fromSite(m, sender) {
  if (m.type === "open" && sender.origin === location.origin) return inLine(() => showWallet()); // the options page's button
  if (!sender.tab || m.type === "ready" || m.type === "res") return { error: { code: 4100, message: "Not allowed" } };
  if (m.type === "rpc") return rpc(m.chainId, m.method, m.params);
  if (m.type === "ask") {
    // connect (no wallet known yet) or a key request: to the Instant Wallet window, answered later
    const origin = sender.origin;
    const entry = {
      rid: `${sender.tab.id}:${sender.frameId ?? 0}:${m.id}`,
      origin,
      icon: sender.tab.favIconUrl,
      method: m.method,
      params: m.params,
      chainId: m.chainId,
    };
    await forward(entry);
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

// ------------------------------------------------------------------ the wallet window

// A site's request opens Instant Wallet in a small window (like MetaMask). It closes once every request in it is
// answered (unless you opened it with the toolbar button); closing it yourself rejects what's left.
//   session: popup { windowId, tabId, byUser }, queue (requests waiting for it to say ready), sent (rids it has, unanswered)

async function fromWalletPage(m, sender) {
  if (m.type === "ready") {
    const address = String(m.address);
    const chainIds = (m.chainIds || []).map(Number);
    await chrome.storage.local.set({ account: { address, chainIds }, wallet: sender.origin });
    const { popup } = await chrome.storage.session.get("popup");
    if (popup && sender.tab?.id === popup.tabId) await inLine(() => flush(sender.tab));
    return {};
  }
  if (m.type === "res") {
    await answerSite(m.rid, m.error ? { error: m.error } : { result: m.result });
    await inLine(async () => {
      const { sent = [] } = await chrome.storage.session.get("sent");
      const left = sent.filter(r => r !== m.rid);
      await chrome.storage.session.set({ sent: left });
      if (!left.length) await closePopupIfIdle();
    });
    return {};
  }
  return {};
}

async function answerSite(rid, answer) {
  const [tabId, frameId, id] = String(rid).split(":");
  await chrome.tabs.sendMessage(Number(tabId), { type: "res", id: Number(id), ...answer }, { frameId: Number(frameId) }).catch(() => {});
}

/** Hand one request to the wallet window, or queue it and open the window. One at a time, so two requests at
 * once share one window. */
let line = Promise.resolve();
const inLine = f => (line = line.then(f, f));
const forward = entry => inLine(() => forwardNow(entry));

async function forwardNow(entry) {
  const tab = await popupTab();
  if (tab && (await isReady(tab))) return deliver(entry, tab);
  const { queue = [] } = await chrome.storage.session.get("queue");
  await chrome.storage.session.set({ queue: [...queue, entry] });
  if (tab) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  else await openPopup();
}

/** The window came up: hand it the queue. */
async function flush(tab) {
  const { queue = [] } = await chrome.storage.session.get("queue");
  await chrome.storage.session.set({ queue: [] });
  for (const entry of queue) await deliver(entry, tab);
  await closePopupIfIdle();
}

async function deliver(entry, tab) {
  if (entry.method === "eth_requestAccounts") {
    // connecting needs only the address, which the window just gave us
    const { account, sites = {} } = await chrome.storage.local.get(["account", "sites"]);
    await chrome.storage.local.set({ sites: { ...sites, [entry.origin]: { ...sites[entry.origin], connected: true } } });
    return answerSite(entry.rid, { result: [account.address] });
  }
  const { sent = [] } = await chrome.storage.session.get("sent");
  await chrome.storage.session.set({ sent: [...sent, entry.rid] });
  await chrome.tabs.sendMessage(tab.id, { type: "req", req: entry }).catch(() => {});
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}

async function popupTab() {
  const { popup } = await chrome.storage.session.get("popup");
  return popup ? chrome.tabs.get(popup.tabId).catch(() => null) : null;
}

async function isReady(tab) {
  let r = await chrome.tabs.sendMessage(tab.id, { type: "ping" }).catch(() => null);
  if (!r) {
    // open from before the extension was updated: add wallet.js now, give the page a moment to answer
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["wallet.js"] }).catch(() => {});
    await new Promise(ok => setTimeout(ok, 300));
    r = await chrome.tabs.sendMessage(tab.id, { type: "ping" }).catch(() => null);
  }
  return !!r?.ready;
}

async function openPopup(byUser = false) {
  const { wallet = WALLETS[0] } = await chrome.storage.local.get("wallet");
  const width = 420, height = 760;
  const at = await chrome.windows.getLastFocused().catch(() => null);
  const pos = at?.left != null ? { left: Math.max(0, at.left + at.width - width - 16), top: at.top + 72 } : {};
  const make = p => chrome.windows.create({ url: `${wallet}/`, type: "popup", width, height, focused: true, ...p });
  const w = await make(pos).catch(() => make({})); // Chrome refuses a spot mostly off screen
  await chrome.storage.session.set({ popup: { windowId: w.id, tabId: w.tabs[0].id, byUser } });
}

async function closePopupIfIdle() {
  const { popup, sent = [], queue = [] } = await chrome.storage.session.get(["popup", "sent", "queue"]);
  if (!popup || popup.byUser || sent.length || queue.length) return;
  await chrome.storage.session.remove("popup");
  await chrome.windows.remove(popup.windowId).catch(() => {});
}

// closed by hand: whatever the sites still wait for is rejected
chrome.windows.onRemoved.addListener(id => inLine(async () => {
  const { popup, sent = [], queue = [] } = await chrome.storage.session.get(["popup", "sent", "queue"]);
  if (popup?.windowId !== id) return;
  await chrome.storage.session.set({ popup: null, sent: [], queue: [] });
  for (const rid of [...sent, ...queue.map(e => e.rid)]) await answerSite(rid, { error: { code: 4001, message: "User rejected" } });
}));

/** The toolbar button: the window, opened by you, so it stays until you close it. */
async function showWallet() {
  const tab = await popupTab();
  if (tab) return chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  await openPopup(true);
}
