#!/usr/bin/env python3
"""
Truth Pool — Production Database Schema Migration & Verification Script
Safe, repeatable, and idempotent.
Creates or verifies all 5 tables in proper foreign key order:
  1. `users` (credentials, XP, player level)
  2. `game_history` (round records, idempotency key, XP awarded, ON DELETE CASCADE)
  3. `user_achievements` (unlocked career achievements, ON DELETE CASCADE)
  4. `user_fandom_questions` (unique questions answered per fandom, ON DELETE CASCADE)
  5. `user_fandom_badges` (earned 100/200 unique question badges, ON DELETE CASCADE)

Usage:
  python scripts/setup_complete_database.py
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


def setup_all_tables():
    print("=" * 65)
    print("TRUTH POOL — COMPLETE DATABASE SCHEMA SETUP & MIGRATION")
    print("=" * 65)

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

    print(f"Connecting to MySQL ({config['host']}:{config['port']}, db: {config['database']})...")
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor()

    try:
        # 1. users table
        print("\n[1/5] Verifying 'users' table...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                total_xp INT UNSIGNED NOT NULL DEFAULT 0,
                player_level TINYINT UNSIGNED NOT NULL DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
        )
        conn.commit()

        # Non-destructive migrations for existing users table
        cursor.execute("SHOW COLUMNS FROM users LIKE 'total_xp'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE users ADD COLUMN total_xp INT UNSIGNED NOT NULL DEFAULT 0")
            conn.commit()
            print("  + Added column 'total_xp'")

        cursor.execute("SHOW COLUMNS FROM users LIKE 'player_level'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE users ADD COLUMN player_level TINYINT UNSIGNED NOT NULL DEFAULT 1")
            conn.commit()
            print("  + Added column 'player_level'")
        print("  ✓ 'users' table OK.")

        # 2. game_history table
        print("\n[2/5] Verifying 'game_history' table...")
        cursor.execute(
            """
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
                xp_awarded INT UNSIGNED NOT NULL DEFAULT 0,
                completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_game_history_user_id (user_id),
                KEY idx_game_history_completed_at (completed_at),
                UNIQUE KEY uq_game_history_user_idempotency (user_id, idempotency_key),
                CONSTRAINT fk_game_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
        )
        conn.commit()

        cursor.execute("SHOW COLUMNS FROM game_history LIKE 'started_at'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE game_history ADD COLUMN started_at TIMESTAMP NULL DEFAULT NULL AFTER round_length")
            conn.commit()
            print("  + Added column 'started_at'")

        cursor.execute("SHOW COLUMNS FROM game_history LIKE 'idempotency_key'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE game_history ADD COLUMN idempotency_key VARCHAR(64) DEFAULT NULL AFTER started_at")
            cursor.execute("ALTER TABLE game_history ADD UNIQUE KEY uq_game_history_user_idempotency (user_id, idempotency_key)")
            conn.commit()
            print("  + Added column 'idempotency_key' and unique constraint")

        cursor.execute("SHOW COLUMNS FROM game_history LIKE 'xp_awarded'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE game_history ADD COLUMN xp_awarded INT UNSIGNED NOT NULL DEFAULT 0 AFTER idempotency_key")
            conn.commit()
            print("  + Added column 'xp_awarded'")
        print("  ✓ 'game_history' table OK.")

        # 3. user_achievements table
        print("\n[3/5] Verifying 'user_achievements' table...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS user_achievements (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                achievement_id VARCHAR(50) NOT NULL,
                unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_achievement (user_id, achievement_id),
                KEY idx_user_achievements_user (user_id),
                KEY idx_user_achievements_unlocked_at (unlocked_at),
                CONSTRAINT fk_user_achievements_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
        )
        conn.commit()
        print("  ✓ 'user_achievements' table OK.")

        # 4. user_fandom_questions table
        print("\n[4/5] Verifying 'user_fandom_questions' table...")
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
                CONSTRAINT fk_user_fandom_questions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
        )
        conn.commit()
        print("  ✓ 'user_fandom_questions' table OK.")

        # 5. user_fandom_badges table
        print("\n[5/5] Verifying 'user_fandom_badges' table...")
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
                CONSTRAINT fk_user_fandom_badges_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
        )
        conn.commit()
        print("  ✓ 'user_fandom_badges' table OK.")

        print("\n" + "=" * 65)
        print("ALL 5 TRUTH POOL DATABASE TABLES FULLY CONFIGURED & VERIFIED!")
        print("=" * 65)

    except mysql.connector.Error as err:
        print(f"\n[ERROR] Database schema verification failed: {err}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    setup_all_tables()
