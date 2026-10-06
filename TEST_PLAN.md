# TEST_PLAN

## Cases (each pair shares its surface and carries opposite labels)

| Case | Expected | Text |
|---|---|---|
| S1 | SINCERE_PRAISE | This update finally keeps my settings after a restart. Thank you. |
| S2 | SINCERE_PRAISE | Took me ten seconds to find the new export button. Lovely work. |
| S3 | SINCERE_PRAISE | Great, another update, and this one made the app open twice as fast. |
| S4 | SINCERE_PRAISE | I expected the worst from a big redesign, and it is the best version yet. |
| S5 | SINCERE_PRAISE | Not what I asked for, but the new layout is better than my idea, I admit. |
| N1 | NOT_PRAISE | Great, another update that wipes my settings after every restart. Thank you. |
| N2 | NOT_PRAISE | Took me ten minutes to find the new export button. Lovely work. |
| N3 | NOT_PRAISE | Wow, the app now opens twice as slow. Truly a masterpiece. |
| N4 | NOT_PRAISE | I expected the worst from a big redesign, and you somehow beat that. |
| N5 | NOT_PRAISE | Love how the new layout hides everything I use daily. |

| Pair | Why it is hard |
|---|---|
| S2 / N2 | identical except ten seconds / ten minutes; both end "Lovely work." |
| S1 / N1 | both open with an update and end "Thank you."; only one is meant |
| S3 / N1 | both open "Great, another update" |
| S4 / N4 | identical opening "I expected the worst from a big redesign" |
| S5 / N5 | both about the new layout; the polite-sounding one is the sincere one |

- **Kill tests:** S2/N2, S1/N1, S4/N4, S3/N1 — the rubric does not hint at the mechanism.
- **Definition check:** S5/N5 (hedged praise vs plain complaint).
- `MEANTIT_KILLSET_CHECK.py` proves no word or word pair separates the classes, and that the rubric shares no content
  word with any case.

On StudioNet, N4 was read as `SINCERE_PRAISE` (see `TESTING.md`). "You somehow beat that" can mean "you did even
worse" or "you beat my low expectations". N6 — `I expected the worst from a big redesign, and it delivered exactly
that.` — was added on-chain afterwards and read as `NOT_PRAISE`.

## Deterministic behaviour → test (`tests/contract/test_meantit.py`, Direct Mode, model mocked)

| Behaviour | Test |
|---|---|
| The tooth: same writer and allowance, one word apart | `test_tooth_same_writer_same_allowance_one_word_apart` |
| Exactly the jar's tip moves on SINCERE_PRAISE | `test_sincere_moves_exactly_the_jar_tip` |
| NOT_PRAISE stores the reply and moves nothing | `test_not_praise_moves_nothing_but_stores_the_reply` |
| Many writers pay one creator | `test_many_writers_one_creator` |
| Allowance equal to the tip is enough | `test_allowance_exactly_the_tip_is_enough` |
| Allowance checked before the model call | `test_allowance_is_checked_before_the_model` |
| One reply per wallet per jar, whatever the text | `test_one_reply_per_wallet_per_jar_whatever_the_text` |
| Accounting invariant through funding, replies and withdrawals | `test_accounting_invariant_through_a_full_cycle` |
| Withdrawals pay only the caller | `test_withdrawals_pay_only_the_caller` |
| Creator cannot tip themselves | `test_creator_cannot_tip_themselves_through_their_own_jar` |
| Fail-safe on broken, unknown or non-object output | `test_fail_safe_on_unparseable_output`, `test_fail_safe_on_unknown_label`, `test_fail_safe_on_non_object_json` |
| Validator function | `test_validator_rejects_disagreement_and_bad_shapes`, `test_validator_accepts_matching_sincere_praise` |
| Prompt never sees wallet, tip or state | `test_prompt_never_sees_wallets_tip_or_state` |
| Fence is a fixed point | `test_fence_strip_is_fixed_point` |
| Whitespace variants share one jar id | `test_whitespace_variants_share_one_jar_id` |
| Every revert string has a dedicated test | `test_every_revert_string_has_exactly_one_dedicated_test` |
| Check order | `test_check_order_open_jar`, `test_check_order_comment_state_before_caller`, `test_check_order_comment_caller_then_replied_then_input`, `test_check_order_comment_input_before_allowance`, `test_check_order_close_state_before_caller` |
| The planned on-chain table, replayed in order | `test_runtime_table_in_order` |
| Jar ids shared with the frontend | `test_vectors_match_contract` |

Frontend (`tests/js/*.test.ts`): Python-string parity, jar ids against the contract vectors, GEN/wei with bigint,
view parsing, every revert sentence equal to the source and fired in the source's order, postconditions, receipt
classification, calldata sizes, source hash, repository rules.
