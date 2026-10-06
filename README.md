Deadpan does not rate how good a release is, and it does not filter rude words. It asks one thing about each reply: is this praise meant as praise — and only a reply that means it moves the tip its writer pledged.

<p align="center"><img src="logo.png" alt="Deadpan" width="140"></p>

# Deadpan

A tip jar under a release, judged by GenLayer validators. GenLayer StudioNet (chain 61999) · py-genlayer v0.2.

**The contract holds GEN.** It holds each reader's **allowance** (GEN pledged for tips and not yet spent) and each
creator's **earnings** (tips received and not yet withdrawn). Readers take unspent allowance back with
`withdraw_allowance`; creators take earnings out with `withdraw_earnings`. GEN moves from an allowance to earnings
only when a reply is judged `SINCERE_PRAISE`.

| | |
|---|---|
| Contract source | `contracts/MeantIt.py` (SHA-256 in `SOURCE_SHA256.txt`) |
| Project deployment | [`0x72250b440D8cC32dbDb37E74D4e45E02a295aB9A`](https://explorer-studio.genlayer.com/address/0x72250b440D8cC32dbDb37E74D4e45E02a295aB9A) |
| Intelligent Contract | MeantIt — the same frozen source, deployed separately at [`0xCa2efdD3A070016721eC4167F81EceFD0adD1410`](https://explorer-studio.genlayer.com/address/0xCa2efdD3A070016721eC4167F81EceFD0adD1410) |
| Evidence | `RUNTIME_EVIDENCE.md` (one tx hash per row) · `TESTING.md` |

## What it does

A creator opens a jar under a release, with a fixed tip per reply. Readers fund an allowance and reply. Validators
read each reply **once**, together with the release title, and decide one thing:

| | `SINCERE_PRAISE` | `NOT_PRAISE` |
|---|---|---|
| Writer's allowance | **minus exactly the tip** | unchanged |
| Creator's earnings | **plus exactly the tip** | unchanged |
| Reply stored | yes | yes |

`Took me ten seconds to find the new export button. Lovely work.` pays.
`Took me ten minutes to find the new export button. Lovely work.` does not. One word apart, same writer, same
allowance — that pair is the core test, and it passed on StudioNet.

Many readers can pay one creator, with nobody approving anything. The GEN that moves is always the writer's own
pledged allowance. Each wallet replies once per jar; the creator cannot reply to their own jar. When the model's answer
is unusable or unclear, the outcome is `NOT_PRAISE` and nothing moves.

## What the app shows

- **The post**: release title, creator, tip per meant reply, how many replies paid, total tipped, and a link to share.
- **The thread**: every reply with its verdict chip — `SINCERE_PRAISE` with "tip moved → creator", or `NOT_PRAISE`
  with "no GEN moved" — read straight from the contract.
- **The reply box**: character count and a live calldata byte meter. Reply is disabled, with the contract's own
  sentence next to it, when you are the creator, have already replied, the jar is closed, or your allowance is below
  the tip.
- **Your balances**: allowance and earnings, with fund, withdraw and withdraw-earnings actions.
- **Open a jar**: the jar id is computed and shown before you sign.

After every write the app waits for consensus to accept the transaction, re-reads the state, and only then says what
happened — for a reply: which label validators gave and whether GEN moved.

## How to try it

You need **two wallets** on GenLayer StudioNet with some GEN (three to put two readers side by side). Nothing depends
on existing data.

1. **Wallet A** — *Open a jar*: a release title (e.g. `Release notes for version 1.2 of my app`) and a tip such as
   `0.001`. Copy the link.
2. **Wallet B** — open the link, *Fund allowance* with `0.01`, then reply with something you mean, e.g.
   `Took me ten seconds to find the new search bar. Lovely work.` The tip moves.
3. **Wallet C** (or B on a second jar) — fund, then reply one word away:
   `Took me ten minutes to find the new search bar. Lovely work.` Nothing moves.
4. **Wallet A** — the reply box is disabled for the creator. *Withdraw earnings*: the tips reach the wallet.
5. **Wallet B** — *Withdraw allowance* takes the unspent GEN back.

A creator can find their own jar again by typing its title in the search box while connected.

## Methods

| Write | Who | Checks, in order |
|---|---|---|
| `open_jar(title, tip_wei)` | anyone | title 1–80 characters → no reserved token → tip between 10^12 and 10^18 wei → not opened before |
| `fund_allowance()` (payable) | anyone | value > 0 |
| `comment(jar_id, text)` | anyone but the creator | jar exists → OPEN → not the creator → first reply of this wallet → text 1–200 characters → no reserved token → allowance ≥ tip → **the only model call** |
| `close_jar(jar_id)` | the creator | jar exists → OPEN → creator |
| `withdraw_allowance(amount)` | allowance holder | 0 < amount ≤ own allowance → debit, then send |
| `withdraw_earnings()` | earnings holder | earnings > 0 → zero, then send |

Views return JSON strings; amounts are decimal strings: `get_jar`, `get_reply`, `get_replies` (≤ 50 per page),
`get_balances`, `get_rubric`, `get_limits`. The full specification is in `LOCKED_SPEC.md`.

## Run locally

```bash
npm ci
npm run dev            # http://localhost:5173 (the /genlayer-rpc proxy is in vite.config.ts)
npm run build && npm test
npm run verify:source
python3 -m pytest tests/contract -q -p no:cacheprovider   # needs genlayer-test 0.29.2
```

`VITE_CONTRACT_ADDRESS` overrides the deployment address. On Vercel, `vercel.json` declares the same proxy.

## Honest limitation

1. **The contract holds GEN**: readers' unspent allowances and creators' unwithdrawn earnings. Each is withdrawn only
   by its owner, through `withdraw_allowance` and `withdraw_earnings`.
2. **Tips are voluntary and fixed per jar.** A reader may never fund an allowance, or may reply with sarcasm; nobody is
   forced to tip.
3. **Sarcasm depends on culture and context.** Validators see only the release title and the reply; an in-joke can be
   read the wrong way. On StudioNet, `I expected the worst from a big redesign, and you somehow beat that.` was read
   as `SINCERE_PRAISE` and its writer's tip moved.
4. **A wrong `SINCERE_PRAISE` is the main risk** — GEN leaves the writer's allowance against their will. Nets: the
   fail-safe moves nothing, one reply per wallet per jar, and the tip is small and fixed by the jar.
5. **One person can use several wallets** to reply several times; the contract does not prove that a wallet is a
   person.
6. **Replies longer than about 160 characters are not proven.** The contract accepts 200, but that measures 297 bytes
   of calldata, over the RPC's 255-byte limit; the reply box stops at 255 bytes.

License: MIT.
