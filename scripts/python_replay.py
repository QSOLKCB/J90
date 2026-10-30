#!/usr/bin/env python3
"""Independent Python 3.11+ consumer of J90 *Node-produced* checkpoint v1 receipts.

No attempt is made to reproduce JavaScript's Number -> JSON canonicalization.
We verify SHA-256 against the exact, delimited payload bytes and validate the
well-defined v1 schema and key order. The issuing Node loader remains the
authority for full canonical JSON acceptance. No external clock or network.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import sys

MAX_INPUT = 1024 * 1024
MAX_CASES = 32
MAX_SEGMENTS = 20
MAX_CHECKPOINT = 8192
ENVELOPE = re.compile(r'\A\{"algorithm":"sha256","digest":"([0-9a-f]{64})","payload":(\{.*\})\}\Z', re.DOTALL)
PAYLOAD_KEYS = ["damping", "logicalTime", "omega", "state", "step", "version"]
STATE_KEYS = ["x", "y"]
ROOT_KEYS = {"protocol", "cases"}


def fail(reason: str) -> None:
    raise ValueError(reason)


def object_pairs(pairs: list[tuple[str, object]]) -> dict:
    out = {}
    for key, value in pairs:
        if key in out:
            fail("duplicate JSON key: " + key)
        out[key] = value
    return out


def reject_constant(value: str) -> None:
    fail("nonfinite JSON literal: " + value)


def strict_loads(text: str) -> object:
    obj = json.loads(text, object_pairs_hook=object_pairs,
                     parse_constant=reject_constant)
    def validate(value: object) -> None:
        if isinstance(value, float) and not math.isfinite(value):
            fail("nonfinite JSON number")
        if isinstance(value, list):
            for child in value:
                validate(child)
        if isinstance(value, dict):
            for child in value.values():
                validate(child)
    validate(obj)
    return obj


def exact_keys(value: object, keys: list[str], label: str) -> dict:
    if not isinstance(value, dict) or list(value) != keys:
        fail(label + " keys/order invalid")
    return value


def number(value: object, label: str, nonnegative: bool = False) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        fail(label + " must be numeric")
    try:
        out = float(value)
    except (OverflowError, ValueError):
        fail(label + " overflows")
    if not math.isfinite(out):
        fail(label + " must be finite")
    if nonnegative and out < 0:
        fail(label + " must be nonnegative")
    return out


def checked_state(value: object) -> dict[str, float]:
    exact_keys(value, STATE_KEYS, "state")
    x, y = number(value["x"], "x"), number(value["y"], "y")
    if not math.isfinite(math.hypot(x, y)):
        fail("state norm overflows")
    return {"x": x, "y": y}


def validate_payload(value: object) -> dict:
    p = exact_keys(value, PAYLOAD_KEYS, "payload")
    if type(p["version"]) is not int or p["version"] != 1:
        fail("unsupported checkpoint version")
    if type(p["step"]) is not int or not (0 <= p["step"] <= (2 ** 53 - 1)):
        fail("invalid checkpoint step")
    logical_time = number(p["logicalTime"], "logicalTime", True)
    omega = number(p["omega"], "omega")
    damping = number(p["damping"], "damping", True)
    for product in (omega * logical_time, damping * logical_time):
        if not math.isfinite(product):
            fail("checkpoint parameter product overflows")
    checked_state(p["state"])
    return p


def load_checkpoint(serialized: object) -> dict:
    if not isinstance(serialized, str) or len(serialized) > MAX_CHECKPOINT:
        fail("checkpoint must be bounded text")
    match = ENVELOPE.fullmatch(serialized)
    if match is None:
        fail("invalid canonical checkpoint envelope")
    digest, payload_text = match.groups()
    payload = strict_loads(payload_text)
    validate_payload(payload)
    computed = hashlib.sha256(payload_text.encode("utf-8")).hexdigest()
    if computed != digest:
        fail("checkpoint SHA-256 mismatch")
    # The Python verifier accepts the constrained Node-produced payload layout.
    # It does not claim to emit or audit every possible ECMAScript number spelling.
    return payload


def evolve(value: dict, omega: float, damping: float, duration: float) -> dict:
    s = checked_state(value)
    duration = number(duration, "duration", True)
    phase = omega * duration
    decay = damping * duration
    if not math.isfinite(phase) or not math.isfinite(decay):
        fail("phase/decay overflows")
    a = math.exp(-decay)
    c, sn = math.cos(phase), math.sin(phase)
    out = {"x": a * (c * s["x"] - sn * s["y"]),
           "y": a * (sn * s["x"] + c * s["y"])}
    return checked_state(out)


def run(root: object) -> dict:
    exact_keys(root, ["protocol", "cases"], "request")
    if root["protocol"] != "j90-cross-runtime-v1":
        fail("unsupported protocol")
    cases = root["cases"]
    if not isinstance(cases, list) or not (1 <= len(cases) <= MAX_CASES):
        fail("invalid case count")
    out = []
    seen = set()
    for case in cases:
        exact_keys(case, ["id", "initial", "omega", "damping", "durations", "checkpoints"], "case")
        identifier = case["id"]
        if not isinstance(identifier, str) or not re.fullmatch("[a-z0-9-]{1,40}", identifier):
            fail("invalid case identifier")
        if identifier in seen:
            fail("duplicate case")
        seen.add(identifier)
        initial = checked_state(case["initial"])
        omega = number(case["omega"], "omega")
        damping = number(case["damping"], "damping", True)
        durations = case["durations"]
        checkpoints = case["checkpoints"]
        if (not isinstance(durations, list) or
                not (1 <= len(durations) <= MAX_SEGMENTS) or
                not isinstance(checkpoints, list) or
                len(checkpoints) != len(durations) + 1):
            fail("invalid replay segments/checkpoint count")
        time = 0.0
        independent = initial
        snapshots = []
        for i, checkpoint in enumerate(checkpoints):
            p = load_checkpoint(checkpoint)
            if (p["step"] != i or number(p["logicalTime"], "logicalTime") != time or
                    number(p["omega"], "omega") != omega or
                    number(p["damping"], "damping") != damping):
                fail("checkpoint metadata does not match replay schedule")
            restored = checked_state(p["state"])
            result = {"step": i, "restored": restored, "independent": independent}
            if i < len(durations):
                dt = number(durations[i], "duration", True)
                time += dt
                if not math.isfinite(time):
                    fail("logical time overflows")
                result["resumed"] = evolve(restored, omega, damping, dt)
                independent = evolve(independent, omega, damping, dt)
            else:
                result["resumed"] = None
            snapshots.append(result)
        out.append({"id": identifier, "steps": snapshots})
    return {"protocol": "j90-cross-runtime-v1", "runtime": "python-stdlib",
            "cases": out}


def main() -> int:
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT + 1)
        if len(raw) > MAX_INPUT:
            fail("input too large")
        request = strict_loads(raw.decode("utf-8"))
        result = run(request)
        sys.stdout.write(json.dumps(result, allow_nan=False, sort_keys=True,
                                    separators=(",", ":")) + "\n")
        return 0
    except (ValueError, TypeError, UnicodeError, OverflowError, KeyError) as exc:
        sys.stderr.write("J90 Python replay rejected input: " + str(exc) + "\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
