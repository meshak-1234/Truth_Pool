#!/usr/bin/env python3
"""
Bluff or Believe — Database Schema Setup for Game History (Phase 3)
Creates or verifies the `game_history` table with foreign key ON DELETE CASCADE,
proper indexes, and columns for score, questions, correct answers, accuracy,
category, difficulty, round length, started_at, completed_at, and idempotency_key.
Run with: python scripts/setup_game_history.py
"""

import os
import sys
import mysql.connector
from dotenv import load_dotenv

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()

def setup_schema():
    print("=" * 60)
    print("BLUFF OR BELIEVE - DATABASE SCHEMA SETUP (PHASE 3)")
    print("=" * 60)

    config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "bluff_or_believe"),
    }

    print(f"Connecting to MySQL ({config['host']}:{config['port']}, db: {config['database']})...")
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor()

    try:
        # 1. Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_history (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                score INT UNSIGNED NOT NULL DEFAULT 0,
                questions_answered INT UNSIGNED NOT NULL DEFAULT 0,
                correct_answers INT UNSIGNED NOT NULL DEFAULT 0,
                accuracy DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                category VARCHAR(100) DEFAULT NULL,
                difficulty VARCHAR(20) DEFAULT NULL,
                round_length INT UNSIGNED DEFAULT NULL,
                started_at TIMESTAMP NULL DEFAULT NULL,
                idempotency_key VARCHAR(64) DEFAULT NULL,
                completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_game_history_user_id (user_id),
                KEY idx_game_history_completed_at (completed_at),
                UNIQUE KEY uq_game_history_user_idempotency (user_id, idempotency_key),
                CONSTRAINT fk_game_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)
        conn.commit()
        print("  [OK] game_history table created or verified.")

        # 2. Check started_at column
        cursor.execute("SHOW COLUMNS FROM game_history LIKE 'started_at'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE game_history ADD COLUMN started_at TIMESTAMP NULL DEFAULT NULL AFTER round_length")
            conn.commit()
            print("  [OK] Added 'started_at' column.")
        else:
            print("  [OK] 'started_at' column already present.")

        # 3. Check idempotency_key column
        cursor.execute("SHOW COLUMNS FROM game_history LIKE 'idempotency_key'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE game_history ADD COLUMN idempotency_key VARCHAR(64) DEFAULT NULL AFTER started_at")
            cursor.execute("ALTER TABLE game_history ADD UNIQUE KEY uq_game_history_user_idempotency (user_id, idempotency_key)")
            conn.commit()
            print("  [OK] Added 'idempotency_key' column and unique index.")
        else:
            print("  [OK] 'idempotency_key' column and unique index already present.")

        cursor.execute("SHOW CREATE TABLE game_history")
        table_create = cursor.fetchone()[1]
        print("\nCurrent Schema:")
        print(table_create)

        print("\n" + "=" * 60)
        print("SCHEMA SETUP COMPLETE!")
        print("=" * 60)

    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    setup_schema()
