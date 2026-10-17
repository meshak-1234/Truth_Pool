#!/usr/bin/env python3
"""
Truth Pool — Safe Database Backup & Restore Utility
Provides non-destructive backups of the Truth Pool MySQL database.

Usage:
  # To create a timestamped backup:
  python scripts/backup_restore_db.py backup

  # To inspect table row counts:
  python scripts/backup_restore_db.py status

  # To verify backup files:
  python scripts/backup_restore_db.py list
"""

import os
import sys
import json
from datetime import datetime, timezone
import mysql.connector
from dotenv import load_dotenv

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

TABLES = [
    "users",
    "game_history",
    "user_achievements",
    "user_fandom_questions",
    "user_fandom_badges",
]

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups")


def get_connection():
    config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "bluff_or_believe"),
    }
    ssl_ca = os.getenv("DB_SSL_CA")
    if ssl_ca:
        config["ssl_ca"] = ssl_ca
    if os.getenv("DB_SSL_DISABLED", "").lower() in ("true", "1", "yes"):
        config["ssl_disabled"] = True
    elif os.getenv("DB_SSL_VERIFY_CERT", "").lower() in ("false", "0", "no"):
        config["ssl_verify_cert"] = False
    return mysql.connector.connect(**config)


def status():
    conn = get_connection()
    cur = conn.cursor()
    print("=" * 60)
    print("TRUTH POOL — DATABASE TABLE STATUS")
    print("=" * 60)
    for table in TABLES:
        try:
            cur.execute(f"SELECT COUNT(*) FROM `{table}`")
            count = cur.fetchone()[0]
            print(f"  • {table:<25}: {count} records")
        except mysql.connector.Error as err:
            print(f"  • {table:<25}: Table missing ({err})")
    cur.close()
    conn.close()
    print("=" * 60)


def backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(BACKUP_DIR, f"truth_pool_backup_{timestamp}.json")

    conn = get_connection()
    cur = conn.cursor(dictionary=True)

    backup_data = {
        "timestamp": timestamp,
        "database": os.getenv("DB_NAME", "bluff_or_believe"),
        "tables": {},
    }

    print("=" * 60)
    print(f"CREATING SAFE DATABASE BACKUP -> {backup_file}")
    print("=" * 60)

    for table in TABLES:
        try:
            cur.execute(f"SELECT * FROM `{table}`")
            rows = cur.fetchall()
            # Convert datetime/timestamp objects to ISO strings
            serialized_rows = []
            for row in rows:
                clean_row = {}
                for k, v in row.items():
                    if isinstance(v, datetime):
                        clean_row[k] = v.isoformat()
                    elif hasattr(v, '__float__'):
                        clean_row[k] = float(v)
                    else:
                        clean_row[k] = v
                serialized_rows.append(clean_row)
            backup_data["tables"][table] = serialized_rows
            print(f"  ✓ Exported {len(serialized_rows)} rows from {table}")
        except mysql.connector.Error as err:
            print(f"  ! Warning on table {table}: {err}")

    cur.close()
    conn.close()

    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, indent=2)

    size = os.path.getsize(backup_file)
    print(f"\n[SUCCESS] Backup saved: {backup_file} ({size:,} bytes)")
    print("=" * 60)


def list_backups():
    print("=" * 60)
    print(f"EXISTING BACKUPS IN {BACKUP_DIR}")
    print("=" * 60)
    if not os.path.exists(BACKUP_DIR):
        print("  No backups directory found yet.")
        return
    files = [f for f in os.listdir(BACKUP_DIR) if f.endswith(".json") or f.endswith(".sql")]
    if not files:
        print("  No backup files found.")
        return
    for f in sorted(files, reverse=True):
        fpath = os.path.join(BACKUP_DIR, f)
        size = os.path.getsize(fpath)
        print(f"  • {f} ({size:,} bytes)")
    print("=" * 60)


if __name__ == "__main__":
    cmd = sys.argv[1].lower() if len(sys.argv) > 1 else "status"
    if cmd == "backup":
        backup()
    elif cmd == "list":
        list_backups()
    else:
        status()
