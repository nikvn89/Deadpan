import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jarId, jarIdFromInput } from "../../src/lib/ids.ts";
import { pyLen, pyNormalize, pyStrip } from "../../src/lib/pytext.ts";

const v = JSON.parse(readFileSync(new URL("./id-vectors.json", import.meta.url), "utf8"));

test("jar ids match the contract, including whitespace edge cases", () => {
  assert.ok(v.jars.length >= 7);
  for (const row of v.jars) {
    assert.equal(pyNormalize(pyStrip(row.title)), row.normalized);
    assert.equal(pyLen(row.normalized), row.py_len);
    assert.equal(jarId(v.creator, row.title), row.jar_id, JSON.stringify(row.title));
    assert.equal(jarId(v.creator.toUpperCase().replace("0X", "0x"), row.title), row.jar_id);
  }
});

test("the on-chain jars of the run are reproduced from the creator wallet", () => {
  const A = "0x6276095FAEA15108740445ff277fdA8c304657F4";
  assert.equal(jarId(A, "Release notes for version 2.4 of a photo app"), "0a62c530b4e9e786113e98caed50775d5366b4cc1c8d2418dcc2d2a01998a485");
  assert.equal(jarId(A, "Release notes for version 2.7 of a photo app"), "c2f2ddd4d7b3f6b409e175240337805e04822f4ad9b134261a14bdeb10549f1d");
});

test("a jar id is found in a bare id, a 0x id or a link", () => {
  const id = "0a62c530b4e9e786113e98caed50775d5366b4cc1c8d2418dcc2d2a01998a485";
  assert.equal(jarIdFromInput(id), id);
  assert.equal(jarIdFromInput("0x" + id.toUpperCase()), id);
  assert.equal(jarIdFromInput(`https://example.app/?jar=${id}&x=1`), id);
  assert.equal(jarIdFromInput("not an id"), "");
  assert.equal(jarIdFromInput(id + "ab"), "");
});
