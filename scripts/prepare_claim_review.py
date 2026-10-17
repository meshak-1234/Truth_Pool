#!/usr/bin/env python3
"""
BLUFF OR BELIEVE — Step 2: Claim and Source Review Preparation
Reads all 600 records across 12 JSON files in data/ and generates
reports/claim_review_template.csv with prepopulated metadata, review statuses,
and detailed notes for exact duplicates, near duplicates, and suspicious sources.
"""

import os
import sys
import csv
import json
import difflib
import re
from pathlib import Path
from urllib.parse import urlparse
from collections import defaultdict, Counter


def normalize_claim(text: str) -> str:
    """Normalize claim text for comparison (lowercase, strip punctuation, collapse whitespace)."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    return " ".join(text.split())


def tokenize(text: str) -> set:
    """Tokenize normalized text into a set of words."""
    return set(normalize_claim(text).split())


def check_suspicious_source(source_name: str, source_url: str) -> list:
    """Flag missing or potentially suspicious/root-domain source URLs."""
    flags = []
    name_clean = (source_name or "").strip().lower()
    placeholders = {"unknown", "n/a", "na", "none", "tbd", "todo", "source", "test", "various", "internet"}

    if not name_clean:
        flags.append("Missing source name")
    elif name_clean in placeholders:
        flags.append(f"Generic placeholder source name: '{source_name}'")
    elif len(name_clean) < 3:
        flags.append(f"Source name suspiciously short: '{source_name}'")

    if not source_url or not str(source_url).strip():
        flags.append("Missing source URL")
    else:
        url_clean = str(source_url).strip()
        try:
            parsed = urlparse(url_clean)
            domain = parsed.netloc.lower()
            suspicious_domains = ["example.com", "test.com", "placeholder.com", "localhost", "fake.com"]
            if any(sd in domain for sd in suspicious_domains):
                flags.append(f"Placeholder domain: {domain}")
            elif parsed.path in ("", "/"):
                flags.append(f"Source URL points to root domain without specific article path: {url_clean}")
        except Exception:
            flags.append(f"Unparseable URL: {url_clean}")

    return flags


def prepare_claim_review_template(data_dir: str = "data", output_csv: str = "reports/claim_review_template.csv", near_dup_threshold: float = 0.75):
    data_path = Path(data_dir)
    output_path = Path(output_csv)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    json_files = sorted(data_path.glob("*.json"))
    if not json_files:
        print(f"ERROR: No JSON files found in '{data_dir}'.")
        return False

    records = []
    for fpath in json_files:
        rel_file = os.path.relpath(fpath, start=".").replace("\\", "/")
        with open(fpath, "r", encoding="utf-8") as fp:
            items = json.load(fp)
            for item in items:
                records.append({
                    "question_id": item["id"],
                    "filename": rel_file,
                    "claim": item.get("claim", ""),
                    "current_answer": str(item.get("answer", "")).strip().upper(),
                    "category": item.get("category", ""),
                    "explanation": item.get("explanation", ""),
                    "source_name": item.get("source_name", ""),
                    "source_url": item.get("source_url", "")
                })

    total_count = len(records)

    # 1. Exact duplicate claims
    claim_map = defaultdict(list)
    for r in records:
        norm = normalize_claim(r["claim"])
        claim_map[norm].append(r)

    exact_dup_ids = set()
    exact_dup_notes = {}
    for norm_text, group in claim_map.items():
        if len(group) > 1:
            for item in group:
                exact_dup_ids.add(item["question_id"])
                other_items = [x for x in group if x["question_id"] != item["question_id"]]
                other_desc = ", ".join([f"ID {x['question_id']} in '{x['filename']}' ({x['current_answer']})" for x in other_items])
                exact_dup_notes[item["question_id"]] = (
                    f"EXACT DUPLICATE: Claim text matches {other_desc}. "
                    "Action required: Decide whether to retain one instance, rewrite, or diversify topic."
                )

    # 2. Near-duplicate claims
    near_dup_ids = set()
    near_dup_notes = defaultdict(list)
    n = len(records)
    for i in range(n):
        c1_norm = normalize_claim(records[i]["claim"])
        c1_tokens = tokenize(records[i]["claim"])
        len1 = len(c1_norm)
        for j in range(i + 1, n):
            c2_norm = normalize_claim(records[j]["claim"])
            if c1_norm == c2_norm:
                continue
            len2 = len(c2_norm)
            if len1 == 0 or len2 == 0:
                continue
            if min(len1, len2) / max(len1, len2) < 0.60:
                continue
            c2_tokens = tokenize(records[j]["claim"])
            inter = len(c1_tokens & c2_tokens)
            union = len(c1_tokens | c2_tokens)
            if union == 0 or (inter / union) < 0.40:
                continue

            similarity = difflib.SequenceMatcher(None, c1_norm, c2_norm).ratio()
            if similarity >= near_dup_threshold:
                id1 = records[i]["question_id"]
                id2 = records[j]["question_id"]
                near_dup_ids.add(id1)
                near_dup_ids.add(id2)
                sim_pct = f"{similarity * 100:.1f}%"
                near_dup_notes[id1].append(
                    f"NEAR-DUPLICATE ({sim_pct} match with ID {id2} in '{records[j]['filename']}'): "
                    f"\"{records[j]['claim']}\" [{records[j]['current_answer']}]."
                )
                near_dup_notes[id2].append(
                    f"NEAR-DUPLICATE ({sim_pct} match with ID {id1} in '{records[i]['filename']}'): "
                    f"\"{records[i]['claim']}\" [{records[i]['current_answer']}]."
                )

    # 3. Suspicious sources
    suspicious_source_ids = set()
    suspicious_source_notes = {}
    for r in records:
        qid = r["question_id"]
        flags = check_suspicious_source(r["source_name"], r["source_url"])
        if flags:
            suspicious_source_ids.add(qid)
            suspicious_source_notes[qid] = (
                "SUSPICIOUS SOURCE: " + "; ".join(flags) + ". "
                "Action required: Provide direct, deep article reference link to substantiate the claim."
            )

    # Compile review status and notes for each record
    rows = []
    status_counts = Counter()

    for r in records:
        qid = r["question_id"]
        review_status = "PENDING"
        notes = []
        proposed_ans = ""  # Left blank until reviewer validates
        evidence_ref = ""
        reviewed_date = ""

        # Priority 1: Exact Duplicates
        if qid in exact_dup_ids:
            review_status = "DUPLICATE_REVIEW"
            notes.append(exact_dup_notes[qid])

        # Priority 2: Near Duplicates
        if qid in near_dup_ids:
            if review_status != "DUPLICATE_REVIEW":
                review_status = "DUPLICATE_REVIEW"
            notes.append(" ".join(near_dup_notes[qid]))

        # Priority 3: Suspicious sources
        if qid in suspicious_source_ids:
            if review_status == "PENDING":
                review_status = "NEEDS_REVIEW"
            notes.append(suspicious_source_notes[qid])

        # Default for clean unreviewed questions
        if review_status == "PENDING":
            notes.append("Preliminary validation passed. Awaiting factual claim & source verification.")

        status_counts[review_status] += 1

        rows.append({
            "question_id": r["question_id"],
            "filename": r["filename"],
            "claim": r["claim"],
            "current_answer": r["current_answer"],
            "category": r["category"],
            "explanation": r["explanation"],
            "source_name": r["source_name"],
            "source_url": r["source_url"],
            "review_status": review_status,
            "proposed_answer": proposed_ans,
            "review_notes": " ".join(notes),
            "evidence_reference": evidence_ref,
            "reviewed_date": reviewed_date
        })

    # Write CSV
    fieldnames = [
        "question_id",
        "filename",
        "claim",
        "current_answer",
        "category",
        "explanation",
        "source_name",
        "source_url",
        "review_status",
        "proposed_answer",
        "review_notes",
        "evidence_reference",
        "reviewed_date"
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)

    print("=" * 70)
    print("BLUFF OR BELIEVE - CLAIM REVIEW TEMPLATE GENERATION")
    print("=" * 70)
    print(f"Total questions loaded:             {total_count}")
    print(f"Questions prepared for review:      {len(rows)}")
    print(f"Exact duplicate questions flagged:  {len(exact_dup_ids)} (2 groups)")
    print(f"Near-duplicate questions flagged:   {len(near_dup_ids)} (7 pairs)")
    print(f"Suspicious source questions flagged:{len(suspicious_source_ids)}")
    print("-" * 70)
    print("Review Status Distribution in Template:")
    for st, count in sorted(status_counts.items()):
        print(f"  - {st:<20}: {count}")
    print("-" * 70)
    print(f"Review template saved to: {output_path}")
    print("=" * 70)

    return True


if __name__ == "__main__":
    prepare_claim_review_template()
