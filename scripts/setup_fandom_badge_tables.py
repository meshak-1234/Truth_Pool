#!/usr/bin/env python3
"""
Truth Pool — Database Schema Setup for Fandom Badge System (Phase 2)
Creates:
  1. `user_fandom_questions`: Tracks unique questions completed per user and fandom.
  2. `user_fandom_badges`: Tracks earned fandom achievement badges per user.
Both tables use foreign keys referencing `users(id)` ON DELETE CASCADE,
and enforce strict uniqueness constraints to prevent duplicate progress or badge grants.
Run with: python scripts/setup_fandom_badge_tables.py
"""

import os
import sys
import mysql.connector
from dotenv import load_dotenv

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()


def setup_fandom_schema():
    print("=" * 60)
    print("TRUTH POOL — DATABASE SCHEMA SETUP (PHASE 2 FANDOM BADGES)")
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
        # Table 1: user_fandom_questions
        # Records each unique question answered by a user in a given fandom.
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS user_fandom_questions (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                fandom_id VARCHAR(100) NOT NULL,
                question_id INT UNSIGNED NOT NULL,
                completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_fandom_question (user_id, fandom_id, question_id),
                KEY idx_user_fandom_q_user (user_id, fandom_id),
                KEY idx_user_fandom_q_completed (completed_at),
                CONSTRAINT fk_user_fandom_questions_user FOREIGN KEY (user_id)
                    REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
        )
        conn.commit()
        print("  [OK] user_fandom_questions table verified / created.")

        # Table 2: user_fandom_badges
        # Records badges earned by a user, including tier, badge ID, and unlock timestamp.
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS user_fandom_badges (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                fandom_id VARCHAR(100) NOT NULL,
                badge_id VARCHAR(50) NOT NULL,
                badge_tier TINYINT UNSIGNED NOT NULL,
                unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_fandom_badge (user_id, badge_id),
                KEY idx_user_fandom_badges_user (user_id),
                KEY idx_user_fandom_badges_fandom (user_id, fandom_id),
                KEY idx_user_fandom_badges_unlocked (unlocked_at),
                CONSTRAINT fk_user_fandom_badges_user FOREIGN KEY (user_id)
                    REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
        )
        conn.commit()
        print("  [OK] user_fandom_badges table verified / created.")

        print("\n" + "=" * 60)
        print("PHASE 2 FANDOM BADGE TABLES SUCCESSFULLY VERIFIED!")
        print("=" * 60)

    except mysql.connector.Error as err:
        print(f"Error during schema setup: {err}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    setup_fandom_schema()
