#!/usr/bin/env python3
"""Generate sql/update_exam.sql from questions-md/Modern_History_PYQs_grouped.md.

The grouped file is a two-column Markdown table (| Exam | Question |) that maps a
question stem to the exam it was asked in. This tool resolves every grouped stem
to a row in public.questions and emits an index-keyed UPDATE script in the same
style as sql/update_headings_483_end.sql:

    update public.questions set exam = 'UPSC' where "index" in (606, 622, ...);

Why index-keyed: the live DB stores each stem once, keyed by an integer `index`
that matches the "NNN:" numbers in the questions-md bank. Matching is done here
(once, against the live DB) so the generated SQL is unambiguous and safe to run.

Matching model
--------------
Both sides are normalised: lowercase, drop a leading enumeration prefix from the
grouped stem (e.g. "29.", "137)" -- these are compilation numbers, NOT bank
indices), then remove every non-alphanumeric character. Removing all whitespace
makes multi-line DB stems match the single-line grouped stems.

For each grouped stem:
  1. Prefix match -- the grouped stem is a normalised prefix of a DB stem (or
     vice-versa). The grouped file often omits trailing numbered points, so it
     can be shorter than the stored stem.
  2. If several rows prefix-match, or none do, fall back to a difflib similarity
     score; a match is accepted only above FUZZY_THRESHOLD.
Anything below threshold is reported as unmatched and left untagged (exam = NULL,
i.e. "leave the rest empty"). Credentials are read from js/config.js, never
hardcoded, matching tools/import_explanations.py.

Usage:
    python3 tools/generate_exam_sql.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
import urllib.request
from difflib import SequenceMatcher

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "js", "config.js")
GROUPED = os.path.join(ROOT, "questions-md", "Modern_History_PYQs_grouped.md")
OUT = os.path.join(ROOT, "sql", "update_exam.sql")

MIN_NORM_LEN = 10        # skip grouped stems too short to match reliably
FUZZY_THRESHOLD = 0.85   # min difflib ratio to accept a non-prefix match
MULTI_MIN_RATIO = 0.75   # min ratio to disambiguate multiple prefix candidates

# Verified matches that automated matching cannot reach because the grouped stem
# and the stored stem share an identical body but use a different opener. Each
# entry pins a normalized-substring of the grouped stem to a DB index confirmed
# against the live DB. (substring_of_normalized_grouped_stem, db_index).
MANUAL_OVERRIDES = [
    # "Assertion (A): The Congress boycotted the Simon Commission. Reason (R):
    #  The Simon Commission did not have a single Indian member." Grouped opener
    #  is "Given below are two statements..."; DB opener (idx 414) is "Consider
    #  the following statements and select the correct answer...".
    ("thecongressboycottedthesimoncommission", 414),
]


def load_credentials():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = f.read()
    url = re.search(r"SUPABASE_URL\s*=\s*['\"]([^'\"]+)['\"]", cfg)
    key = re.search(r"SUPABASE_ANON_KEY\s*=\s*['\"]([^'\"]+)['\"]", cfg)
    if not url or not key:
        sys.exit("Could not read SUPABASE_URL / SUPABASE_ANON_KEY from js/config.js")
    return url.group(1).rstrip("/"), key.group(1)


def fetch_questions(url, key):
    rows, start, step = [], 0, 1000
    while True:
        req = urllib.request.Request(
            url + "/rest/v1/questions?select=index,stem",
            headers={
                "apikey": key,
                "Authorization": "Bearer " + key,
                "Range-Unit": "items",
                "Range": f"{start}-{start + step - 1}",
            },
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            batch = json.load(resp)
        rows.extend(batch)
        if len(batch) < step:
            return rows
        start += step


def norm_grouped(text):
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"^\s*\d+\s*[.)\]:]\s*", "", text)
    text = text.lower()
    return re.sub(r"[^a-z0-9]+", "", text)


def norm_db(text):
    text = unicodedata.normalize("NFKD", text or "")
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def parse_grouped(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.lstrip().startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 2:
                continue
            exam, question = cells[0], cells[1]
            if exam.lower() == "exam" or set(exam) <= set("-: "):
                continue
            if question:
                rows.append((exam, question))
    return rows


def resolve(key, db):
    """Return (index, ratio, kind) or None. db is list of (index, norm_stem)."""
    sm = SequenceMatcher()
    sm.set_seq2(key)

    prefix = []
    for idx, n in db:
        if not n:
            continue
        if n.startswith(key) or (len(n) >= 15 and key.startswith(n)):
            sm.set_seq1(n)
            prefix.append((sm.ratio(), idx))
    if len(prefix) == 1:
        return (prefix[0][1], prefix[0][0], "prefix")
    if len(prefix) > 1:
        prefix.sort(key=lambda t: (-t[0], t[1]))
        if prefix[0][0] >= MULTI_MIN_RATIO:
            return (prefix[0][1], prefix[0][0], "prefix-multi")
        return None  # ambiguous generic opener

    best = (-1.0, None)
    for idx, n in db:
        if not n:
            continue
        sm.set_seq1(n)
        if sm.quick_ratio() < FUZZY_THRESHOLD:
            continue
        r = sm.ratio()
        if r > best[0]:
            best = (r, idx)
    if best[0] >= FUZZY_THRESHOLD:
        return (best[1], best[0], "fuzzy")
    return None


def sql_quote(s):
    return "'" + s.replace("'", "''") + "'"


def main():
    url, key = load_credentials()
    db_rows = fetch_questions(url, key)
    db = [(r["index"], norm_db(r["stem"])) for r in db_rows if r.get("index") is not None]

    grouped = parse_grouped(GROUPED)

    # De-duplicate grouped stems by normalized key (first exam wins; conflicts noted).
    key_exam, key_sample, key_conflicts = {}, {}, []
    for exam, question in grouped:
        k = norm_grouped(question)
        if len(k) < MIN_NORM_LEN:
            continue
        if k in key_exam and key_exam[k] != exam:
            key_conflicts.append((key_exam[k], exam, question))
            continue
        key_exam.setdefault(k, exam)
        key_sample.setdefault(k, question)

    # Resolve each key to a DB index.
    index_exam = {}          # index -> (exam, ratio, key)
    idx_conflicts = []       # (index, existing_exam, new_exam, sample)
    unmatched = []
    override_count = 0
    for k, exam in key_exam.items():
        ov = next((i for sub, i in MANUAL_OVERRIDES if sub in k), None)
        if ov is not None:
            res = (ov, 1.0, "override")
            override_count += 1
        else:
            res = resolve(k, db)
        if res is None:
            unmatched.append((exam, key_sample[k]))
            continue
        idx, ratio, kind = res
        if idx in index_exam:
            prev_exam, prev_ratio, _ = index_exam[idx]
            if prev_exam != exam:
                idx_conflicts.append((idx, prev_exam, exam, key_sample[k]))
                if ratio > prev_ratio:
                    index_exam[idx] = (exam, ratio, k)
            continue
        index_exam[idx] = (exam, ratio, k)

    # Group indices by exam.
    by_exam = {}
    for idx, (exam, _r, _k) in index_exam.items():
        by_exam.setdefault(exam, []).append(idx)
    for exam in by_exam:
        by_exam[exam].sort()

    # Emit SQL.
    lines = [
        "-- Tag questions with the exam they were asked in, keyed by question index.",
        "-- GENERATED by tools/generate_exam_sql.py from",
        "-- questions-md/Modern_History_PYQs_grouped.md (matched against the live DB).",
        "-- Re-run the generator rather than hand-editing this file.",
        "-- Additive: does NOT clear existing exam values; unmatched questions stay NULL.",
        "-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run",
        "",
        "begin;",
        "",
    ]
    for exam in sorted(by_exam):
        idxs = by_exam[exam]
        lines.append(f"-- {exam} ({len(idxs)})")
        lines.append(f"update public.questions set exam = {sql_quote(exam)}")
        lines.append('where "index" in (' + ",".join(str(i) for i in idxs) + ");")
        lines.append("")
    lines.append("commit;")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    total_tagged = sum(len(v) for v in by_exam.values())
    print(f"Wrote {os.path.relpath(OUT, ROOT)}")
    print(f"  DB questions                 : {len(db)}")
    print(f"  grouped rows parsed          : {len(grouped)}")
    print(f"  unique normalized keys       : {len(key_exam)}")
    print(f"  matched (distinct questions) : {total_tagged}")
    print(f"  (incl. manual overrides)     : {override_count}")
    print(f"  unmatched keys               : {len(unmatched)}")
    print(f"  same-stem exam conflicts     : {len(idx_conflicts)}")
    print()
    print("  tagged per exam:")
    for exam in sorted(by_exam):
        print(f"    {exam:<18} {len(by_exam[exam])}")

    if idx_conflicts:
        print("\n  same question asked in multiple exams (higher-confidence match kept):")
        for idx, a, b, sample in idx_conflicts:
            print(f"    idx {idx}: {a} / {b} | {sample[:55]}")

    if key_conflicts:
        print("\n  identical grouped stems with different exams (first kept):")
        for a, b, sample in key_conflicts:
            print(f"    {a} / {b} | {sample[:55]}")

    if unmatched:
        print(f"\n  UNMATCHED ({len(unmatched)}) -- not found in the bank, left untagged:")
        for exam, sample in sorted(unmatched):
            print(f"    {exam:<14} | {sample[:80]}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
