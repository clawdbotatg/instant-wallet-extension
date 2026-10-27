# Plan: Instant Wallet inside the extension

Not built yet. This is the plan.

## Goal

Click the extension icon and see your Instant Wallet right there, not just an address and a switch.

## The catch

The dropdown closes as soon as anything else takes focus. Face ID and the wedgie both open their own Chrome
prompts, which take focus. So signing in the dropdown will probably get cut off halfway. Not tested yet.

## Three ways

| | what | signing | risk |
|---|---|---|---|
| A | Dropdown shows instantwallet.io in a frame | no: sends go to the small window like now | low |
| B | Same, and try signing in it | maybe | Face ID closes the dropdown |
| C | Chrome side panel: the full wallet docked next to the site, stays open | probably yes | needs a click to open the first time |

## Test first (about an hour)

1. Dropdown with an instantwallet.io frame. Does the wallet load and show the balance?
2. Face ID in that frame. Does it finish, or does the dropdown close?
3. The wedgie in that frame. Same question.
4. Same three in a side panel.

## What changes

- Extension: `popup.html` gets the frame (A/B) or a `side_panel` page (C).
- Website: allow passkeys in a frame (`allow="publickey-credentials-get"` on the frame). A small mode with no
  header for narrow widths.
- Requests: if the side panel is open, send them there instead of opening the small window.

## Recommendation

Start with A: see the wallet, sign in the small window. Test C. If Face ID and the wedgie both work in the side
panel, make it the main way, with the small window as the fallback.
