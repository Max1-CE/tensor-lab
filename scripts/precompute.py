# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Макс
"""Build step: analyse every preset and write web/public/precomputed/*.json.

Usage:  python scripts/precompute.py [preset_id ...]
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.export import analyze  # noqa: E402
from core.presets import PRESETS  # noqa: E402

OUT = ROOT / "web" / "public" / "precomputed"


def main(ids: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for pid, p in PRESETS.items():
        meta = {"id": pid, "title": p.title, "kind": p.kind, "dim": len(p.coords),
                "domain": [list(d) for d in p.domain]}
        index.append(meta)
        if ids and pid not in ids:
            continue
        t0 = time.perf_counter()
        data = analyze(p.metric(), p.params, embedding=p.embedding)
        data.update(meta)
        _write(OUT / f"{pid}.json", data)
        print(f"{pid:14s} {time.perf_counter() - t0:6.2f} s")
    _write(OUT / "index.json", index)


def _write(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main(sys.argv[1:])
