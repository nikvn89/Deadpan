# SECURITY

## Money

The contract holds GEN: commenters' unspent allowances and creators' unwithdrawn earnings. GEN enters only through
`fund_allowance` (payable) and leaves only through `withdraw_allowance` and `withdraw_earnings`, which pay the caller
alone and debit the ledger before sending. `comment` — the only method with a model call — writes ledger entries and
never sends GEN.

## Where the central rule lives

Whether a reply is praise is decided only by validators inside `comment`. What happens next is one deterministic branch
in the contract: `SINCERE_PRAISE` moves exactly the jar's tip from the writer's allowance to the creator's earnings;
anything else moves nothing. The app never decides praise and never screens reply text: it reads `outcome` and
`tip_moved` back from the views (checked by `tests/js/rules.test.ts`).

## Fail-safe

`NOT_PRAISE` on unparseable output, an unknown label, a non-object answer, or a reply that does not resolve the
question. A wrong `SINCERE_PRAISE` takes a writer's GEN against their will; a wrong `NOT_PRAISE` only costs the creator
one tip.

## Prompt fence

The title and the reply sit inside `<UNTRUSTED_RELEASE_TITLE>` and `<UNTRUSTED_REPLY>` tags. The four tags and both
labels are refused in any letter case on input and stripped to a fixed point inside the prompt, so fragments cannot
rebuild a tag. The model sees no wallet, tip amount, balance or state.

## Grinding

One reply per wallet per jar, whatever the text. The creator cannot reply to their own jar. The title is part of the
jar id, so the same jar cannot be reopened.

## Frontend

- No MetaMask Snap: the app switches the network with `wallet_switchEthereumChain` / `wallet_addEthereumChain`.
- One same-origin RPC proxy (`/genlayer-rpc`, in `vite.config.ts` and `vercel.json`) for reads, receipts and writes.
- A write is reported only after the leader receipt says SUCCESS **and** consensus has reached ACCEPTED, and only
  after the reloaded state shows the change; otherwise it is "confirmation delayed" with a Check again button that
  re-reads the state instead of resending.
- Every revert that can be predicted from the state already read disables the button and shows the contract's own
  sentence. Amounts are bigint from the view to the wallet.
- Contract text is rendered as React text; no raw HTML.

## Remaining limits

See "Honest limitation" in the README: sarcasm depends on context, a wrong `SINCERE_PRAISE` is the main risk (observed
once on StudioNet with an ambiguous reply), one person can hold several wallets, and replies over about 160 characters
do not fit in the RPC's calldata limit.
