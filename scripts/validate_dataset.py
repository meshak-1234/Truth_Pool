#!/usr/bin/env python3
"""
FACT OR TRAP — Dataset Validation Utility
Validates question records across all JSON files in the data directory.
Checks JSON syntax, required fields, formats, duplicates, quality warnings,
and generates structured TXT and JSON reports.
"""

import os
import sys
import json
import glob
import re
import argparse
import difflib
from urllib.parse import urlparse
from collections import Counter, defaultdict
from pathlib import Path


def is_valid_url(url: str) -> bool:
    """Validate that a URL has a valid HTTP/HTTPS scheme and network location."""
    if not isinstance(url, str):
        return False
    url = url.strip()
    if not url:
        return False
    try:
        parsed = urlparse(url)
        if parsed.scheme.lower() not in ("http", "https"):
            return False
        if not parsed.netloc:
            return False
        # Basic domain validation (must contain a valid dot or localhost)
        netloc = parsed.netloc.split(":")[0]
        if netloc.lower() != "localhost" and "." not in netloc:
            return False
        return True
    except Exception:
        return False


def check_suspicious_source(source_name: str, source_url: str) -> list:
    """Flag missing or potentially suspicious source information."""
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
                flags.append(f"Placeholder/testing domain in URL: {domain}")
            elif parsed.path in ("", "/"):
                flags.append(f"URL points to root domain without specific article path: {url_clean}")
        except Exception:
            flags.append(f"Unparseable URL: {url_clean}")

    return flags


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


def validate_record(record: dict, filename: str, index: int) -> list:
    """
    Validate an individual question record against all required specifications.
    Returns a list of error strings. If the list is empty, the record is valid.
    """
    errors = []
    rec_id = record.get("id") if isinstance(record, dict) else f"index_{index}"

    if not isinstance(record, dict):
        return [f"Record at index {index} is not a JSON object"]

    # 1. Required fields presence and non-empty check
    required_fields = [
        "id", "claim", "answer", "category",
        "difficulty", "explanation", "source_name", "source_url"
    ]
    for field in required_fields:
        if field not in record:
            errors.append(f"Missing required field: '{field}'")
        else:
            val = record[field]
            if val is None or (isinstance(val, str) and not val.strip()):
                errors.append(f"Required field '{field}' is empty or null")

    # 2. ID validation
    raw_id = record.get("id")
    if raw_id is None:
        pass  # already flagged above
    elif isinstance(raw_id, int):
        if raw_id <= 0:
            errors.append(f"Identifier 'id' must be a positive integer, got: {raw_id}")
    elif isinstance(raw_id, str):
        if not raw_id.strip().isdigit() or int(raw_id.strip()) <= 0:
            errors.append(f"Identifier 'id' must be numeric, got: '{raw_id}'")
    else:
        errors.append(f"Identifier 'id' has invalid type: {type(raw_id).__name__}")

    # 3. String types for specific fields
    string_fields = ["claim", "explanation", "category", "source_name"]
    for field in string_fields:
        if field in record and record[field] is not None:
            if not isinstance(record[field], str):
                errors.append(f"Field '{field}' must be a string, got {type(record[field]).__name__}")
            elif not record[field].strip():
                errors.append(f"Field '{field}' cannot be empty")

    # 4. Answer validation (FACT or TRAP, case-insensitive, whitespace-trimmed)
    if "answer" in record and record["answer"] is not None:
        answer_val = str(record["answer"]).strip().upper()
        if answer_val not in ("FACT", "TRAP"):
            errors.append(f"Field 'answer' must be 'FACT' or 'TRAP', got: '{record['answer']}'")

    # 5. Difficulty validation (Easy, Medium, or Hard, case-insensitive)
    if "difficulty" in record and record["difficulty"] is not None:
        diff_val = str(record["difficulty"]).strip().capitalize()
        if diff_val not in ("Easy", "Medium", "Hard"):
            errors.append(f"Field 'difficulty' must be 'Easy', 'Medium', or 'Hard', got: '{record['difficulty']}'")

    # 6. Source URL validation (Syntactically valid HTTP/HTTPS URL)
    if "source_url" in record and record["source_url"] is not None:
        url_val = str(record["source_url"]).strip()
        if not is_valid_url(url_val):
            errors.append(f"Field 'source_url' is not a syntactically valid HTTP/HTTPS URL: '{url_val}'")

    return errors


def run_validation(data_dir: str, reports_dir: str, near_dup_threshold: float = 0.75):
    """Main validation routine."""
    data_path = Path(data_dir)
    reports_path = Path(reports_dir)
    reports_path.mkdir(parents=True, exist_ok=True)

    if not data_path.exists() or not data_path.is_dir():
        print(f"ERROR: Data directory '{data_dir}' does not exist.")
        print("Please ensure the 'data/' directory exists and contains JSON dataset files.")
        return False, {}

    json_files = sorted(data_path.glob("*.json"))
    if not json_files:
        print(f"WARNING: No JSON files found in '{data_dir}'.")
        print("Please place your dataset JSON files into the data/ directory and run this script again:")
        print("  python scripts/validate_dataset.py")
        return False, {}

    # Aggregation containers
    file_stats = {}
    all_records = []
    file_id_counts = defaultdict(Counter)
    global_id_map = defaultdict(list)
    validation_issues = []  # List of critical error dicts
    suspicious_sources = []  # List of quality warning dicts

    total_records = 0
    valid_records_count = 0
    invalid_records_count = 0
    parse_errors = []

    answer_counts = Counter()
    difficulty_counts = Counter()
    category_counts = Counter()

    for file_path in json_files:
        rel_name = os.path.relpath(file_path, start=".").replace("\\", "/")
        file_stats[rel_name] = {"total_records": 0, "valid_records": 0, "invalid_records": 0, "errors": []}

        try:
            with open(file_path, "r", encoding="utf-8") as fp:
                data = json.load(fp)
        except Exception as e:
            err_msg = f"JSON parse error in file '{rel_name}': {e}"
            parse_errors.append({"file": rel_name, "error": str(e)})
            validation_issues.append({"file": rel_name, "id": None, "issue_type": "JSON_PARSE_ERROR", "message": err_msg})
            file_stats[rel_name]["errors"].append(err_msg)
            continue

        if not isinstance(data, list):
            err_msg = f"Root JSON element in '{rel_name}' must be an array/list, found {type(data).__name__}"
            parse_errors.append({"file": rel_name, "error": err_msg})
            validation_issues.append({"file": rel_name, "id": None, "issue_type": "SCHEMA_ERROR", "message": err_msg})
            file_stats[rel_name]["errors"].append(err_msg)
            continue

        file_stats[rel_name]["total_records"] = len(data)
        total_records += len(data)

        for idx, item in enumerate(data):
            rec_id = item.get("id") if isinstance(item, dict) else f"index_{idx}"
            if isinstance(item, dict) and "id" in item:
                file_id_counts[rel_name][item["id"]] += 1
                global_id_map[item["id"]].append((rel_name, idx))

            # Run record validation
            errors = validate_record(item, rel_name, idx)

            if errors:
                invalid_records_count += 1
                file_stats[rel_name]["invalid_records"] += 1
                for err in errors:
                    validation_issues.append({
                        "file": rel_name,
                        "id": rec_id,
                        "issue_type": "RECORD_VALIDATION_ERROR",
                        "message": err
                    })
            else:
                valid_records_count += 1
                file_stats[rel_name]["valid_records"] += 1

            if isinstance(item, dict):
                # Answers
                raw_ans = str(item.get("answer", "")).strip().upper()
                if raw_ans in ("FACT", "TRAP"):
                    answer_counts[raw_ans] += 1
                else:
                    answer_counts["OTHER/INVALID"] += 1

                # Difficulty
                raw_diff = str(item.get("difficulty", "")).strip().capitalize()
                if raw_diff in ("Easy", "Medium", "Hard"):
                    difficulty_counts[raw_diff] += 1
                else:
                    difficulty_counts["OTHER/INVALID"] += 1

                # Category
                raw_cat = str(item.get("category", "")).strip() or "Unknown"
                category_counts[raw_cat] += 1

                # Source analysis
                src_flags = check_suspicious_source(item.get("source_name", ""), item.get("source_url", ""))
                for sf in src_flags:
                    suspicious_sources.append({
                        "file": rel_name,
                        "id": rec_id,
                        "source_name": item.get("source_name"),
                        "source_url": item.get("source_url"),
                        "flag": sf
                    })

                all_records.append({
                    "file": rel_name,
                    "index": idx,
                    "id": item.get("id"),
                    "claim": item.get("claim", ""),
                    "answer": raw_ans,
                    "category": raw_cat,
                    "difficulty": raw_diff,
                    "explanation": item.get("explanation", ""),
                    "source_name": item.get("source_name", ""),
                    "source_url": item.get("source_url", "")
                })

    # Duplicate IDs within each file
    duplicate_ids_within_file = {}
    for fpath, counts in file_id_counts.items():
        dups = {cid: cnt for cid, cnt in counts.items() if cnt > 1}
        if dups:
            duplicate_ids_within_file[fpath] = dups
            for cid, cnt in dups.items():
                validation_issues.append({
                    "file": fpath,
                    "id": cid,
                    "issue_type": "DUPLICATE_ID_WITHIN_FILE",
                    "message": f"ID {cid} appears {cnt} times in file '{fpath}'"
                })

    # IDs repeated across different files (reported as quality info/warning, not automatically errors)
    repeated_cross_file_ids = {}
    for cid, occurrences in global_id_map.items():
        files_involved = list({f for f, _ in occurrences})
        if len(files_involved) > 1:
            repeated_cross_file_ids[cid] = [
                {"file": f, "index": idx} for f, idx in occurrences
            ]

    # Exact duplicate claims detection
    claim_map = defaultdict(list)
    for rec in all_records:
        norm = normalize_claim(rec["claim"])
        if norm:
            claim_map[norm].append(rec)

    exact_duplicate_claims = []
    for norm_text, group in claim_map.items():
        if len(group) > 1:
            exact_duplicate_claims.append({
                "normalized_claim": norm_text,
                "occurrences": [
                    {
                        "file": r["file"],
                        "id": r["id"],
                        "original_claim": r["claim"],
                        "answer": r["answer"],
                        "category": r["category"]
                    }
                    for r in group
                ]
            })

    # Near-duplicate claims detection
    near_duplicate_claims = []
    n = len(all_records)
    for i in range(n):
        c1_norm = normalize_claim(all_records[i]["claim"])
        c1_tokens = tokenize(all_records[i]["claim"])
        len1 = len(c1_norm)
        for j in range(i + 1, n):
            c2_norm = normalize_claim(all_records[j]["claim"])
            # Skip if exact match
            if c1_norm == c2_norm:
                continue
            len2 = len(c2_norm)
            if len1 == 0 or len2 == 0:
                continue
            if min(len1, len2) / max(len1, len2) < 0.60:
                continue
            c2_tokens = tokenize(all_records[j]["claim"])
            # Fast Jaccard overlap filter
            inter = len(c1_tokens & c2_tokens)
            union = len(c1_tokens | c2_tokens)
            if union == 0 or (inter / union) < 0.40:
                continue

            similarity = difflib.SequenceMatcher(None, c1_norm, c2_norm).ratio()
            if similarity >= near_dup_threshold:
                near_duplicate_claims.append({
                    "similarity": round(similarity, 4),
                    "record_1": {
                        "file": all_records[i]["file"],
                        "id": all_records[i]["id"],
                        "claim": all_records[i]["claim"]
                    },
                    "record_2": {
                        "file": all_records[j]["file"],
                        "id": all_records[j]["id"],
                        "claim": all_records[j]["claim"]
                    }
                })

    near_duplicate_claims.sort(key=lambda x: x["similarity"], reverse=True)

    # Build report dictionary
    report_data = {
        "summary": {
            "total_files_processed": len(json_files),
            "total_records_found": total_records,
            "valid_records": valid_records_count,
            "invalid_records": invalid_records_count,
            "json_parse_errors_count": len(parse_errors),
            "duplicate_ids_within_files_count": sum(len(d) for d in duplicate_ids_within_file.values()),
            "cross_file_repeated_ids_count": len(repeated_cross_file_ids),
            "exact_duplicate_claim_groups": len(exact_duplicate_claims),
            "near_duplicate_claim_pairs": len(near_duplicate_claims),
            "suspicious_source_flags_count": len(suspicious_sources),
            "validation_status": "PASSED" if (invalid_records_count == 0 and len(parse_errors) == 0) else "FAILED"
        },
        "breakdowns": {
            "files": file_stats,
            "answers": dict(answer_counts),
            "difficulties": dict(difficulty_counts),
            "categories": dict(category_counts)
        },
        "duplicate_claims": {
            "exact_duplicates": exact_duplicate_claims,
            "near_duplicates": near_duplicate_claims
        },
        "id_issues": {
            "duplicate_within_file": duplicate_ids_within_file,
            "repeated_across_files": repeated_cross_file_ids
        },
        "suspicious_sources": suspicious_sources,
        "validation_issues": validation_issues,
        "verification_disclaimer": "CRITICAL NOTE: Do not claim that a fact is verified merely because a source URL exists. URLs must be audited for accuracy and authoritative sourcing."
    }

    # Write JSON report
    json_report_path = reports_path / "dataset_validation_report.json"
    with open(json_report_path, "w", encoding="utf-8") as fp:
        json.dump(report_data, fp, indent=2, ensure_ascii=False)

    # Write TXT report
    txt_report_path = reports_path / "dataset_validation_report.txt"
    with open(txt_report_path, "w", encoding="utf-8") as fp:
        fp.write("=" * 80 + "\n")
        fp.write("FACT OR TRAP - DATASET VALIDATION REPORT\n")
        fp.write("=" * 80 + "\n\n")

        fp.write("1. EXECUTIVE SUMMARY\n")
        fp.write("-" * 80 + "\n")
        fp.write(f"Validation Status:                  {report_data['summary']['validation_status']}\n")
        fp.write(f"Total Files Processed:              {report_data['summary']['total_files_processed']}\n")
        fp.write(f"Total Records Found:                {report_data['summary']['total_records_found']}\n")
        fp.write(f"Valid Records:                      {report_data['summary']['valid_records']}\n")
        fp.write(f"Invalid Records:                    {report_data['summary']['invalid_records']}\n")
        fp.write(f"JSON Parse Errors:                  {report_data['summary']['json_parse_errors_count']}\n")
        fp.write(f"Duplicate IDs Within Single File:   {report_data['summary']['duplicate_ids_within_files_count']}\n")
        fp.write(f"IDs Repeated Across Files (Notice): {report_data['summary']['cross_file_repeated_ids_count']}\n")
        fp.write(f"Exact Duplicate Claim Groups:       {report_data['summary']['exact_duplicate_claim_groups']}\n")
        fp.write(f"Near-Duplicate Claim Pairs:         {report_data['summary']['near_duplicate_claim_pairs']}\n")
        fp.write(f"Suspicious Source Information Flags:{report_data['summary']['suspicious_source_flags_count']}\n\n")

        fp.write("2. BREAKDOWN BY FILE\n")
        fp.write("-" * 80 + "\n")
        fp.write(f"{'Filename':<45} | {'Total':<6} | {'Valid':<6} | {'Invalid':<7}\n")
        fp.write("-" * 80 + "\n")
        for fname, s in sorted(file_stats.items()):
            fp.write(f"{fname:<45} | {s['total_records']:<6} | {s['valid_records']:<6} | {s['invalid_records']:<7}\n")
        fp.write("\n")

        fp.write("3. ANSWER DISTRIBUTION\n")
        fp.write("-" * 80 + "\n")
        for ans, count in sorted(answer_counts.items()):
            pct = (count / total_records * 100) if total_records > 0 else 0
            fp.write(f"  {ans:<15}: {count:<5} ({pct:.1f}%)\n")
        fp.write("\n")

        fp.write("4. DIFFICULTY DISTRIBUTION\n")
        fp.write("-" * 80 + "\n")
        for diff, count in sorted(difficulty_counts.items()):
            pct = (count / total_records * 100) if total_records > 0 else 0
            fp.write(f"  {diff:<15}: {count:<5} ({pct:.1f}%)\n")
        fp.write("\n")

        fp.write("5. CATEGORY SUMMARY\n")
        fp.write("-" * 80 + "\n")
        for cat, count in sorted(category_counts.items()):
            fp.write(f"  {cat:<40}: {count} questions\n")
        fp.write("\n")

        fp.write("6. EXACT DUPLICATE CLAIMS ACROSS FILES\n")
        fp.write("-" * 80 + "\n")
        if not exact_duplicate_claims:
            fp.write("  None detected.\n")
        else:
            for i, dup in enumerate(exact_duplicate_claims, 1):
                fp.write(f"  [Group {i}] Normalized Claim: \"{dup['normalized_claim']}\"\n")
                for occ in dup["occurrences"]:
                    fp.write(f"    - File: {occ['file']}, ID: {occ['id']}, Answer: {occ['answer']}, Cat: {occ['category']}\n")
                    fp.write(f"      Full Claim: \"{occ['original_claim']}\"\n")
                fp.write("\n")

        fp.write("7. NEAR-DUPLICATE CLAIMS (FOR MANUAL REVIEW)\n")
        fp.write("-" * 80 + "\n")
        if not near_duplicate_claims:
            fp.write("  None detected at similarity threshold >= {:.2f}.\n".format(near_dup_threshold))
        else:
            for i, nd in enumerate(near_duplicate_claims, 1):
                fp.write(f"  [Pair {i}] Similarity: {nd['similarity']:.2f}\n")
                fp.write(f"    Item A -> File: {nd['record_1']['file']}, ID: {nd['record_1']['id']}\n")
                fp.write(f"              Claim: \"{nd['record_1']['claim']}\"\n")
                fp.write(f"    Item B -> File: {nd['record_2']['file']}, ID: {nd['record_2']['id']}\n")
                fp.write(f"              Claim: \"{nd['record_2']['claim']}\"\n\n")

        fp.write("8. SUSPICIOUS OR GENERIC SOURCE FLAGS\n")
        fp.write("-" * 80 + "\n")
        if not suspicious_sources:
            fp.write("  None flagged.\n")
        else:
            for item in suspicious_sources:
                fp.write(f"  - File: {item['file']}, ID: {item['id']}\n")
                fp.write(f"    Flag: {item['flag']}\n")
                fp.write(f"    Source Name: \"{item['source_name']}\"\n")
                fp.write(f"    Source URL:  \"{item['source_url']}\"\n\n")

        fp.write("9. VALIDATION ISSUES (ERRORS)\n")
        fp.write("-" * 80 + "\n")
        if not validation_issues:
            fp.write("  No schema or record validation errors found! All records passed syntactic checks.\n")
        else:
            for issue in validation_issues:
                fp.write(f"  [{issue['issue_type']}] File: {issue['file']}, ID: {issue.get('id')} -> {issue['message']}\n")
        fp.write("\n")

        fp.write("10. VERIFICATION & QUALITY NOTICE\n")
        fp.write("-" * 80 + "\n")
        fp.write(f"{report_data['verification_disclaimer']}\n")
        fp.write("=" * 80 + "\n")

    # Print summary to terminal
    print("=" * 70)
    print("FACT OR TRAP - DATASET VALIDATION SUMMARY")
    print("=" * 70)
    print(f"Validation Status:                  {report_data['summary']['validation_status']}")
    print(f"Total Files Processed:              {report_data['summary']['total_files_processed']}")
    print(f"Total Records Found:                {report_data['summary']['total_records_found']}")
    print(f"Valid Records:                      {report_data['summary']['valid_records']}")
    print(f"Invalid Records:                    {report_data['summary']['invalid_records']}")
    print(f"JSON Parse Errors:                  {report_data['summary']['json_parse_errors_count']}")
    print(f"Duplicate IDs Within Single File:   {report_data['summary']['duplicate_ids_within_files_count']}")
    print(f"IDs Repeated Across Files:          {report_data['summary']['cross_file_repeated_ids_count']}")
    print(f"Exact Duplicate Claim Groups:       {report_data['summary']['exact_duplicate_claim_groups']}")
    print(f"Near-Duplicate Claim Pairs:         {report_data['summary']['near_duplicate_claim_pairs']}")
    print(f"Suspicious Source Flags:            {report_data['summary']['suspicious_source_flags_count']}")
    print("-" * 70)
    print(f"Reports saved to:")
    print(f"  - {txt_report_path}")
    print(f"  - {json_report_path}")
    print("-" * 70)

    # Return success status
    is_success = (invalid_records_count == 0 and len(parse_errors) == 0)
    return is_success, report_data


def main():
    parser = argparse.ArgumentParser(description="FACT OR TRAP: Dataset Validator")
    parser.add_argument("--data-dir", default="data", help="Directory containing question JSON files (default: data)")
    parser.add_argument("--reports-dir", default="reports", help="Directory to save reports (default: reports)")
    parser.add_argument("--threshold", type=float, default=0.75, help="Similarity threshold for near-duplicates (default: 0.75)")
    args = parser.parse_args()

    success, _ = run_validation(args.data_dir, args.reports_dir, args.threshold)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
