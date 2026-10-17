#!/usr/bin/env python3
"""
BLUFF OR BELIEVE — Step 2A: Review Flagged Questions
Extracts questions marked for review (DUPLICATE_REVIEW, NEEDS_REVIEW, CORRECTION_REQUIRED,
or with missing/malformed/suspicious source info) from reports/claim_review_template.csv
into reports/flagged_questions_review.csv for focused manual inspection.
"""

import os
import sys
import csv
from urllib.parse import urlparse
from pathlib import Path


def is_suspicious_or_malformed_source(source_name: str, source_url: str) -> tuple[bool, str]:
    """Check if source information is missing, malformed, or points only to a root domain."""
    name = (source_name or "").strip()
    url = (source_url or "").strip()

    if not name:
        return True, "Missing source name"
    if not url:
        return True, "Missing source URL"

    try:
        parsed = urlparse(url)
        if parsed.scheme.lower() not in ("http", "https"):
            return True, f"Invalid URL scheme: '{parsed.scheme}'"
        if not parsed.netloc:
            return True, "Malformed URL lacking host/netloc"
        if parsed.path in ("", "/"):
            return True, f"Root-level URL lacking specific article path: '{url}'"
    except Exception as e:
        return True, f"Unparseable URL: {e}"

    placeholders = {"unknown", "n/a", "na", "none", "tbd", "todo", "source", "test"}
    if name.lower() in placeholders:
        return True, f"Placeholder source name: '{name}'"

    return False, ""


def extract_flagged_questions(
    input_csv: str = "reports/claim_review_template.csv",
    output_csv: str = "reports/flagged_questions_review.csv"
):
    input_path = Path(input_csv)
    output_path = Path(output_csv)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"ERROR: Input file '{input_csv}' not found.")
        print("Please generate it first with: python scripts/prepare_claim_review.py")
        return False

    flagged_records = []
    total_count = 0
    pending_count = 0
    duplicate_count = 0
    needs_review_count = 0
    correction_count = 0

    with open(input_path, "r", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        fieldnames = reader.fieldnames or []

        for row in reader:
            total_count += 1
            status = row.get("review_status", "").strip().upper()

            is_flagged_status = status in ("DUPLICATE_REVIEW", "NEEDS_REVIEW", "CORRECTION_REQUIRED")
            has_suspicious_source, source_issue = is_suspicious_or_malformed_source(
                row.get("source_name", ""), row.get("source_url", "")
            )

            if is_flagged_status or has_suspicious_source:
                flagged_records.append(row)

                if status == "DUPLICATE_REVIEW":
                    duplicate_count += 1
                elif status == "NEEDS_REVIEW":
                    needs_review_count += 1
                elif status == "CORRECTION_REQUIRED":
                    correction_count += 1
                else:
                    # Captured via suspicious source check while in another status
                    needs_review_count += 1
            else:
                pending_count += 1

    # Ensure required fields are exported
    export_fields = [
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
        writer = csv.DictWriter(fp, fieldnames=export_fields, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for r in flagged_records:
            # Write mapped row preserving existing columns
            writer.writerow({f: r.get(f, "") for f in export_fields})

    print("=" * 70)
    print("BLUFF OR BELIEVE - FLAGGED QUESTIONS EXTRACTION SUMMARY")
    print("=" * 70)
    print(f"Total questions in review template:     {total_count}")
    print(f"Total flagged questions extracted:       {len(flagged_records)}")
    print(f"  - DUPLICATE_REVIEW:                   {duplicate_count}")
    print(f"  - NEEDS_REVIEW:                       {needs_review_count}")
    print(f"  - CORRECTION_REQUIRED:                {correction_count}")
    print("-" * 70)
    print(f"Questions remaining pending review:     {pending_count}")
    print("-" * 70)
    print(f"Flagged questions exported to: {output_path}")
    print("=" * 70)

    return True


if __name__ == "__main__":
    extract_flagged_questions()
