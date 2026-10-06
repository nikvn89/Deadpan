# TESTING

```
COMPILE PASS ≠ RUNTIME PASS
SUBMITTED ≠ ACCEPTED ≠ FINALIZED ≠ EXECUTION SUCCESS ≠ POSTCONDITION PASS
```

## Automated gates (run before release; CI runs them on every push)

| Gate | Command | Result |
|---|---|---|
| Kill-set + rubric gate | `python3 MEANTIT_KILLSET_CHECK.py contracts/MeantIt.py` | rc 0 — no word or word pair separates the classes; the rubric shares no content word with any case |
| genvm-linter | `python3 -m genvm_linter.cli lint contracts/MeantIt.py` | pass |
| Contract tests (Direct Mode: the real py-genlayer v0.2.16 SDK, model mocked) | `python3 -m pytest tests/contract -q -p no:cacheprovider` | 57 passed |
| Mutation check | `python3 tools/mutate.py .` | 28/28 deliberate faults caught |
| Frontend build | `npm run build` | rc 0 |
| Frontend tests | `npm test` | 53 passed |
| Source hash | `npm run verify:source` | `contracts/MeantIt.py` matches `SOURCE_SHA256.txt` |
| Calldata table | `node tools/calldata-bytes.mjs` | every write ≤ 255 bytes (largest case 171) |
| Calldata on the RPC | `node tools/probe-calldata.mjs <address>` | runs in CI against both addresses in `deployments.json` |

The mocked model labels drive the deterministic code paths; they say nothing about what the real model returns. The
on-chain runs do.

### What the mutation check catches

Each fault is applied to the contract alone and the suite must go red (`tests/mutations.py`): praise not debiting the
writer, praise not crediting the creator, NOT_PRAISE also moving the tip, the tip credited to the writer, the allowance
check off by one or moved after the model call, the fail-safe flipped, an unknown label read as praise, the validator
accepting any label, the creator allowed to reply, a second reply allowed, anyone allowed to close a jar, withdrawals not
debiting before the transfer or allowing more than the balance, zero-value funding, every limit off by one, the reserved
token check dropped, a single-pass fence, the wallet or the tip leaking into the prompt, the check order swapped, and the
jar id ignoring whitespace normalization.

### Calldata

Encoded exactly as genlayer-js 1.1.8 `writeContract` does. Replies in the case set measure 148–171 bytes. The longest
ASCII reply that fits is **160 characters**; the contract accepts 200, which measures 297 bytes and is refused by the
RPC. The reply box shows a live byte meter and disables Reply above 255 bytes.

## Frontend checks

- **Revert sentences** (`tests/js/rules.test.ts`): the set in `src/lib/rules.ts` equals the 16 sentences in the source,
  and for `open_jar`, `comment` and `close_jar` the UI reports the earliest failing check in the source's own order.
- **Jar ids** (`tests/js/ids.test.ts`, `tests/js/ids-html.test.ts`): computed with viem Keccak-256 and Python whitespace
  rules; equal to vectors produced by the contract on the real SDK, and to the jars of the on-chain run.
- **GEN amounts** (`tests/js/gen.test.ts`): bigint end to end; 0.998 GEN (above 2^53 wei) survives exactly.
- **Postconditions** (`tests/js/verify.test.ts`): a reply is reported only when the reloaded state shows it at the next
  index, by this wallet, with this text, and the writer's allowance dropped by exactly what the reply's `tip_moved` says.
- **Receipts** (`tests/js/receipt.test.ts`): a leader SUCCESS while validators are still proposing, committing or
  revealing is pending, not success.
- **Interface check** (Playwright against `vite preview`, the RPC mocked by decoding calldata): landing, open form,
  fresh jar, a thread with one SINCERE_PRAISE and one NOT_PRAISE reply, the creator's disabled reply box, a writer with
  no allowance, a creator after withdrawing, bad inputs, and 390 px — no page error, no horizontal scroll.

## On-chain runs

See `RUNTIME_EVIDENCE.md`: the Intelligent Contract run (24 transactions) and the Project run through this app.

Summary of the Intelligent Contract run:

- **Tooth** — S2 → SINCERE_PRAISE and N2 → NOT_PRAISE, same writer, same allowance: **PASS**.
- **Same jar, two writers** — with N4: **FAIL** (validators read N4 as praise and the writer's tip moved); with N6:
  **PASS**. Both are reported.
- **Exact accounting** — the allowance drops by exactly the tip on praise and not at all otherwise: **PASS**.
- **Payout** — withdraw_earnings and withdraw_allowance send real GEN: **PASS** (a wallet went from 0 to 0.008 GEN).

## Consensus behaviour

The model is called once per reply, in `comment`. Validators re-run the judgement and must agree on the exact label;
a disagreement rotates the leader or reverts the transaction, and a reverted reply moves no GEN and records nothing.
`open_jar`, `fund_allowance`, `close_jar` and both withdrawals are deterministic.

## What this run does NOT prove

- Each case is sent once; label stability across repeated runs or validator sets is not measured.
- N4 shows that an ambiguous sarcastic reply can be read as praise and move the writer's tip. N6 passed, but it was
  written after N4 failed, so it does not show that such misreadings are rare.
- S1, S3, S5, N1, N3 and N5 are tested offline only.
- Replies longer than about 160 characters are not sent.
- Direct Mode does not record native transfers; real transfers are proven only on StudioNet.
- Prompt-injection resistance rests on the fence and the reserved-token check; no adversarial model run is done.
