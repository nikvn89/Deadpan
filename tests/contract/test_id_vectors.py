"""
Golden jar-id vectors shared with the frontend (tests/js/ids.test.ts and
tests/js/ids-html.test.ts read the same file). Every id is computed by the
contract's own code on the real SDK Keccak256.

Regenerate:  WRITE_VECTORS=1 python3 -m pytest tests/contract/test_id_vectors.py
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "tests" / "js" / "id-vectors.json"
CONTRACT = str(ROOT / "contracts" / "MeantIt.py")

CREATOR = "0x3065e31b1d993d7c0d59e6786844cba56780b2d3"
TITLES = [
    "Release notes for version 2.4 of a photo app",
    "Release notes for version 2.5 of a photo app",
    "  Release notes\tfor version 3.0\n of a photo app  ",
    "\u001cWeekly changelog\u001f",
    "Changelog\u0085week\u001d12\u001efinal",
    "﻿Release notes with a byte order mark",
    "Notes de version — hiver　\U0001F4F8",
]


def build(contract):
    rows = []
    for title in TITLES:
        norm = contract._normalize_text(title.strip())
        rows.append({"title": title, "normalized": norm, "py_len": len(norm),
                     "jar_id": contract._jar_id(CREATOR, norm)})
    return {"creator": CREATOR, "jars": rows}


def test_vectors_match_contract(direct_deploy):
    data = build(direct_deploy(CONTRACT))
    if os.environ.get("WRITE_VECTORS") == "1":
        VECTORS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    assert json.loads(VECTORS.read_text(encoding="utf-8")) == data
