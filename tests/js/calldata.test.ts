// Calldata size of every write method, encoded exactly as genlayer-js 1.1.8 does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calldataBytes, CALLDATA_LIMIT } from "../../src/lib/calldata.ts";
import { CASES, hardBlockRows, ID } from "../../tools/calldata-rows.mjs";

test("ten cases + every other write at its maximum stay under 255 bytes", () => {
  assert.equal(Object.keys(CASES).length, 10);
  for (const row of hardBlockRows()) {
    const n = calldataBytes(row.method, row.args);
    assert.ok(n <= CALLDATA_LIMIT, `${row.name}: ${n} bytes`);
  }
});

test("a 200-character reply is over the cliff (the reply meter must catch it); 160 fits", () => {
  assert.ok(calldataBytes("comment", [ID, "x".repeat(200)]) > CALLDATA_LIMIT);
  assert.ok(calldataBytes("comment", [ID, "x".repeat(160)]) <= CALLDATA_LIMIT);
  assert.ok(calldataBytes("comment", [ID, "x".repeat(161)]) > CALLDATA_LIMIT);
});
