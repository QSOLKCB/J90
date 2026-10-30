#!/usr/bin/env python3
"""J90 v0.3.2 independent float64 escape-grid observer (Python stdlib).
Consumes bounded, fixed-schema JSON. Does not import or execute JS source.
"""
import json
import math
import sys

def invalid(msg):
    raise ValueError(msg)

def pairs(p):
    out = {}
    for k, v in p:
        if k in out:
            invalid("duplicate key: " + k)
        out[k] = v
    return out

def reject_nonfinite(v):
    invalid("nonfinite literal")

def fields(obj, expected):
    if type(obj) is not dict or set(obj) != set(expected):
        invalid("unexpected fields")

def number(v, name):
    if type(v) not in (int, float) or not math.isfinite(v):
        invalid("nonfinite " + name)
    return float(v)

def complex_pair(v):
    fields(v, ("x", "y"))
    x, y = number(v["x"], "x"), number(v["y"], "y")
    if abs(x) > 4 or abs(y) > 4:
        invalid("coordinate bounds")
    return (x, y)

def grid(item):
    fields(item, ("id", "model", "width", "height", "centre", "span", "c", "iterations"))
    tag, model = item["id"], item["model"]
    if type(tag) is not str or len(tag) > 40 or not tag or any(
        not (v.isascii() and (v.isalnum() or v == "-")) for v in tag):
        invalid("bad id")
    if model not in ("mandelbrot", "julia"):
        invalid("bad model")
    w, h, steps = item["width"], item["height"], item["iterations"]
    if any(type(v) is not int for v in (w, h, steps)) or not (8 <= w <= 48 and 8 <= h <= 32 and 1 <= steps <= 192):
        invalid("grid budget")
    centre = complex_pair(item["centre"])
    parameter = complex_pair(item["c"])
    span = number(item["span"], "span")
    if not (1e-15 <= span <= 6):
        invalid("span bounds")
    result = []
    for iy in range(h):
        for ix in range(w):
            px = centre[0] + ((ix + 0.5 - w / 2) * span / w)
            py = centre[1] + ((h / 2 - iy - 0.5) * span / w)
            if abs(px) > 4 or abs(py) > 4:
                invalid("grid exceeds domain")
            if model == "mandelbrot":
                cx, cy = px, py
                zx, zy = 0.0, 0.0
            else:
                cx, cy = parameter
                zx, zy = px, py
            limit = max(2.0, math.hypot(cx, cy) + 1.0)
            iteration = 65535
            for k in range(steps + 1):
                if math.hypot(zx, zy) > limit:
                    iteration = k
                    break
                if k == steps:
                    break
                zx, zy = zx*zx - zy*zy + cx, 2*zx*zy + cy
            result.append(iteration)
    return {"id": tag, "pixels": result}

def main():
    data = sys.stdin.buffer.read(131073)
    if len(data) > 131072:
        invalid("request too large")
    req = json.loads(data.decode("utf-8"), object_pairs_hook=pairs, parse_constant=reject_nonfinite)
    fields(req, ("protocol", "cases"))
    if req["protocol"] != "j90-zoom-crosscheck-v1":
        invalid("protocol")
    cases = req["cases"]
    if type(cases) is not list or not (1 <= len(cases) <= 6):
        invalid("case count")
    rows = [grid(item) for item in cases]
    if len(set(row["id"] for row in rows)) != len(rows):
        invalid("duplicate case")
    print(json.dumps({"protocol": req["protocol"], "runtime": "python-stdlib", "cases": rows},
                     sort_keys=True, separators=(",", ":"), allow_nan=False))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, TypeError, OverflowError, UnicodeError) as exc:
        print("J90 Python zoom verifier rejected: " + str(exc), file=sys.stderr)
        sys.exit(1)
