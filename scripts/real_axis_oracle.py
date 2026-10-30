#!/usr/bin/env python3
"""Independent stdlib Python check for J90 v0.3.1 real-axis samples.
Reads only a strict, bounded JSON request from stdin. No network or wall time.
"""
import json
import math
import sys

def fail(message):
    raise ValueError(message)

def unique(pairs):
    value = {}
    for key, v in pairs:
        if key in value:
            fail("duplicate key")
        value[key] = v
    return value

def reject_constant(value):
    fail("nonfinite JSON constant")

def keys(obj, expected):
    if not isinstance(obj, dict) or set(obj) != set(expected):
        fail("unexpected object fields")

def finite(value, label):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
        fail(label + " must be finite")
    return float(value)

def trace(c, burn, count):
    x = 0.0
    tail = []
    for i in range(burn + count):
        x = x * x + c
        if not math.isfinite(x) or abs(x) > 2:
            return {"escaped": True, "escapeIteration": i + 1, "tail": []}
        if i >= burn:
            tail.append(x)
    return {"escaped": False, "escapeIteration": None, "tail": tail}

def main():
    raw = sys.stdin.buffer.read(65537)
    if len(raw) > 65536: fail("request too large")
    req = json.loads(raw.decode("utf-8"), object_pairs_hook=unique,
                     parse_constant=reject_constant)
    keys(req, ["protocol", "cases"])
    if req["protocol"] != "j90-real-axis-v1": fail("unknown protocol")
    cases = req["cases"]
    if not isinstance(cases, list) or not (1 <= len(cases) <= 24): fail("invalid case count")
    output, seen = [], set()
    for item in cases:
        keys(item, ["id", "c", "burnIn", "samples"])
        identifier = item["id"]
        if not isinstance(identifier, str) or not identifier.isascii() or not identifier.replace("-", "").isalnum() or len(identifier) > 40 or identifier in seen:
            fail("invalid or duplicate id")
        seen.add(identifier)
        c = finite(item["c"], "c")
        burn, count = item["burnIn"], item["samples"]
        if c < -2 or c > 0.5 or type(burn) is not int or type(count) is not int or not (0 <= burn <= 512) or not (4 <= count <= 64):
            fail("out-of-range case")
        output.append({"id": identifier, **trace(c, burn, count)})
    sys.stdout.write(json.dumps({"protocol": "j90-real-axis-v1", "runtime": "python-stdlib", "cases": output},
                                allow_nan=False, sort_keys=True, separators=(",", ":")) + "\n")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, TypeError, OverflowError, UnicodeError) as exc:
        sys.stderr.write("J90 real-axis oracle rejected: " + str(exc) + "\n")
        sys.exit(1)
