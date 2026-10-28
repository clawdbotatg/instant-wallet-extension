// Chrome can't show the USB picker in a side panel, so the wallet asks for this tab: the wedgie is picked here once.
chrome.storage.local.get("wallet").then(({ wallet = "https://instantwallet.io" }) => {
  document.getElementById("wallet").src = `${wallet}/?in=extension&pair=wedgie`;
});
// picked: this popup's job is done
window.addEventListener("message", e => {
  if (e.source === document.getElementById("wallet").contentWindow && e.data?.__iwp === "paired") window.close();
});
