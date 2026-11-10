"""The public snapshot must never carry contact data (D-020)."""
import json
from pathlib import Path

import pytest

from finn_worker import sync

SNAP = Path(__file__).resolve().parents[2] / "data" / "snapshot.json"


@pytest.mark.skipif(not SNAP.exists(), reason="needs a local export")
def test_public_payload_has_no_people():
    snap = json.loads(SNAP.read_text())
    public, lines = sync.split(snap)
    blob = json.dumps(public)
    names = [c["name"] for c in snap["contacts"]]
    assert lines, "network lines should move to private rows"
    assert not any(n in blob for n in names), "a contact name leaked into the public payload"
    assert not any(k in public for k in ("contacts", "people", "verifiers"))
