#!/usr/bin/env python3
"""
Truth Pool — Database Schema Setup for User Achievements (Phase 4B)
Creates the `user_achievements` table with foreign key ON DELETE CASCADE,
unique constraint (user_id, achievement_id), indexes, and timestamp.
Run with: python scripts/setup_achievements.py
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
    print("TRUTH POOL - DATABASE SCHEMA SETUP (PHASE 4B ACHIEVEMENTS)")
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
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_achievements (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                achievement_id VARCHAR(50) NOT NULL,
                unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_user_achievements_user (user_id),
                KEY idx_user_achievements_unlocked_at (unlocked_at),
                UNIQUE KEY uq_user_achievement (user_id, achievement_id),
                CONSTRAINT fk_user_achievements_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)
        conn.commit()
        print("  [OK] user_achievements table created or verified.")

        cursor.execute("SHOW CREATE TABLE user_achievements")
        table_create = cursor.fetchone()[1]
        print("\nCurrent Schema:")
        print(table_create)

        print("\n" + "=" * 60)
        print("ACHIEVEMENTS SCHEMA SETUP COMPLETE!")
        print("=" * 60)

    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    setup_schema()
