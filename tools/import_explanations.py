#!/usr/bin/env python3
"""
Bulk-import option explanations into Supabase from a pasted text file.

Input format (exactly what you paste in chat):

    **511**

    [correct: O1]        # optional; used only to sanity-check, never written

    [O1]
    Explanation for option A (markdown: **bold**, _italic_, - lists, nested).

    [O2]
    Explanation for option B.

    ---                  # optional separator between questions

    **519**
    [O4]
    ...

Rules:
  - O1->A, O2->B, O3->C, O4->D.
  - Only the options you include are updated; others are left untouched.
  - `_italic_` is rewritten to `*italic*` because the app renderer only
    supports single-asterisk italics.
  - Credentials are read from js/config.js (gitignored), never hardcoded.

Usage:
    python3 tools/import_explanations.py [input_file]
    (default input_file: tools/explanations_input.md)

    Add --dry-run to parse + preview without writing to the database.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "js", "config.js")
DEFAULT_INPUT = os.path.join(ROOT, "tools", "explanations_input.md")
NUM_TO_LETTER = {1: "A", 2: "B", 3: "C", 4: "D"}


def load_credentials():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = f.read()
    url = re.search(r"SUPABASE_URL\s*=\s*['\"]([^'\"]+)['\"]", cfg)
    key = re.search(r"SUPABASE_ANON_KEY\s*=\s*['\"]([^'\"]+)['\"]", cfg)
    if not url or not key:
        sys.exit("Could not read SUPABASE_URL / SUPABASE_ANON_KEY from js/config.js")
    return url.group(1).rstrip("/"), key.group(1)


def to_app_italics(text):
    """Renderer supports *italic* but not _italic_; convert paired underscores."""
    return re.sub(r"_([^_\n]+)_", r"*\1*", text)


def parse_input(text):
    """Return { index(int): {"correct": "A"|None, "options": {letter: body}} }."""
    result = {}
    cur_idx = None
    cur_opt = None
    buf = []

    def flush_option():
        nonlocal cur_opt, buf
        if cur_idx is not None and cur_opt is not None:
            body = "\n".join(buf).strip()
            if body:
                result[cur_idx]["options"][cur_opt] = body
        cur_opt = None
        buf = []

    for raw in text.splitlines():
        line = raw.rstrip("\n")
        stripped = line.strip()

        m_head = re.match(r"^\*\*\s*(\d+)\s*\*\*$", stripped)
        m_correct = re.match(r"^\[correct:\s*O([1-4])\]$", stripped, re.IGNORECASE)
        m_opt = re.match(r"^\[O([1-4])\]$", stripped)

        if m_head:
            flush_option()
            cur_idx = int(m_head.group(1))
            result.setdefault(cur_idx, {"correct": None, "options": {}})
            continue
        if stripped == "---":
            flush_option()
            cur_idx = None
            continue
        if m_correct:
            flush_option()
            if cur_idx is not None:
                result[cur_idx]["correct"] = NUM_TO_LETTER[int(m_correct.group(1))]
            continue
        if m_opt:
            flush_option()
            cur_opt = NUM_TO_LETTER[int(m_opt.group(1))]
            continue

        if cur_opt is not None:
            buf.append(line)

    flush_option()
    return result


def _request_with_retries(req, attempts=5):
    last_err = None
    for i in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.status, resp.read()
        except (urllib.error.URLError, TimeoutError, ConnectionResetError) as e:
            last_err = e
            time.sleep(1.5 * (i + 1))
    raise last_err


def http_get(url, key, path):
    req = urllib.request.Request(
        url + path,
        headers={"apikey": key, "Authorization": "Bearer " + key},
        method="GET",
    )
    _, body = _request_with_retries(req)
    return json.loads(body.decode("utf-8"))


def http_patch(url, key, path, payload):
    req = urllib.request.Request(
        url + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    status, _ = _request_with_retries(req)
    return status


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry_run = "--dry-run" in sys.argv
    input_file = args[0] if args else DEFAULT_INPUT
    if not os.path.exists(input_file):
        sys.exit("Input file not found: " + input_file)

    with open(input_file, "r", encoding="utf-8") as f:
        parsed = parse_input(f.read())

    if not parsed:
        sys.exit("No questions parsed. Check the input format (**index**, [Ox], ...).")

    total_opts = sum(len(v["options"]) for v in parsed.values())
    print(f"Parsed {len(parsed)} question(s), {total_opts} explanation(s).")

    url, key = load_credentials()
    idxs = ",".join(str(i) for i in sorted(parsed))
    rows = http_get(url, key,
                    "/rest/v1/questions?select=index,options(id,option_letter,is_correct)"
                    "&index=in.(" + idxs + ")")
    by_index = {}
    for r in rows:
        by_index[r["index"]] = {o["option_letter"]: o for o in (r.get("options") or [])}

    problems = []
    warnings = []
    plan = []
    for idx in sorted(parsed):
        info = parsed[idx]
        if idx not in by_index:
            problems.append(f"index {idx}: not found in database")
            continue
        # sanity-check the [correct: Ox] tag against stored is_correct
        if info["correct"]:
            db_correct = [l for l, o in by_index[idx].items() if o.get("is_correct")]
            if db_correct and db_correct != [info["correct"]]:
                warnings.append(
                    f"index {idx}: [correct]={info['correct']} but DB says {db_correct}")
        for letter, body in info["options"].items():
            opt = by_index[idx].get(letter)
            if not opt:
                problems.append(f"index {idx} option {letter}: missing in database")
                continue
            plan.append((idx, letter, opt["id"], to_app_italics(body)))

    for w in warnings:
        print("WARN:", w)
    for p in problems:
        print("ERROR:", p)

    if dry_run:
        print(f"\n[dry-run] Would update {len(plan)} option(s). Nothing written.")
        for idx, letter, _id, body in plan[:3]:
            print(f"\n--- {idx} {letter} (preview) ---\n{body[:200]}")
        return

    if problems:
        sys.exit("\nAborting due to errors above. Fix input and re-run.")

    updated = 0
    for i, (idx, letter, opt_id, body) in enumerate(plan, 1):
        try:
            status = http_patch(url, key, "/rest/v1/options?id=eq." + opt_id,
                                {"explanation": body})
            if status in (200, 204):
                updated += 1
                if i % 10 == 0 or i == len(plan):
                    print(f"  progress {i}/{len(plan)}")
            else:
                problems.append(f"index {idx} option {letter}: HTTP {status}")
        except Exception as e:
            problems.append(f"index {idx} option {letter}: {e}")
        time.sleep(0.05)

    print(f"\nUpdated {updated}/{len(plan)} explanation(s).")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print(" ", p)
        sys.exit(1)


if __name__ == "__main__":
    main()
