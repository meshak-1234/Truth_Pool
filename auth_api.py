
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import time
from collections import defaultdict

import mysql.connector
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Response, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, model_validator
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

import json
load_dotenv()

# ---------------------------------------------------------------------------
# Phase 1 & 2: Fandom Badges Configuration & Dataset Mapping
# ---------------------------------------------------------------------------
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
FANDOM_BADGES_CONFIG_PATH = os.path.join(DATA_DIR, "fandom_badges.json")


def load_fandom_badges_data():
    if not os.path.exists(FANDOM_BADGES_CONFIG_PATH):
        raise FileNotFoundError(f"fandom_badges.json not found at {FANDOM_BADGES_CONFIG_PATH}")
    with open(FANDOM_BADGES_CONFIG_PATH, "r", encoding="utf-8") as f:
        badges = json.load(f)

    badges_by_fandom = {}
    valid_q_ids = {}

    for b in badges:
        fid = b["fandom_id"]
        badges_by_fandom.setdefault(fid, []).append(b)

        if fid not in valid_q_ids:
            ds_file = os.path.join(DATA_DIR, b["dataset_file"])
            if os.path.exists(ds_file):
                with open(ds_file, "r", encoding="utf-8") as df:
                    q_data = json.load(df)
                    valid_q_ids[fid] = {int(q["id"]) for q in q_data if "id" in q}
            else:
                valid_q_ids[fid] = set(range(1, 201))

    for fid in badges_by_fandom:
        badges_by_fandom[fid].sort(key=lambda x: x["badge_tier"])

    return badges, badges_by_fandom, valid_q_ids


FANDOM_BADGES_CATALOG, FANDOM_BADGES_BY_FANDOM, FANDOM_VALID_QUESTION_IDS = load_fandom_badges_data()

# ---------------------------------------------------------------------------
# XP System — Level Thresholds & Formula
# ---------------------------------------------------------------------------
#
# XP Formula (server-calculated, never trusted from client):
#   xp_earned = (correct_answers × 10) + (questions_answered × 5)
#
# This rewards both accuracy (correct answers) and completion (answering all
# questions).  The completion bonus only applies to genuine saved rounds;
# abandoned/invalid rounds never reach /games/complete.
#
# Example: 10-question round, 8 correct → (8×10) + (10×5) = 80 + 50 = 130 XP
# Example: 10-question round, 3 correct → (3×10) + (10×5) = 30 + 50 = 80 XP
#
# Level Thresholds (20 levels)
# The curve starts gentle and accelerates; max level is 20 (capped).
# Stored as cumulative XP required to REACH that level.
# ---------------------------------------------------------------------------
XP_PER_CORRECT_ANSWER = 10   # Points per correct answer
XP_PER_QUESTION_ANSWERED = 5  # Flat completion bonus per question answered

LEVEL_THRESHOLDS = [
    0,      # Level 1  (starting level)
    100,    # Level 2
    250,    # Level 3
    500,    # Level 4
    850,    # Level 5
    1300,   # Level 6
    1900,   # Level 7
    2700,   # Level 8
    3700,   # Level 9
    5000,   # Level 10
    6500,   # Level 11
    8500,   # Level 12
    11000,  # Level 13
    14000,  # Level 14
    17500,  # Level 15
    21500,  # Level 16
    25500,  # Level 17 (placeholder, expandable)
    30000,  # Level 18
    35000,  # Level 19
    40000,  # Level 20 (max)
]

MAX_LEVEL = len(LEVEL_THRESHOLDS)  # 20


def calculate_xp_for_round(questions_answered: int, correct_answers: int) -> int:
    """Server-side XP calculation — never trust client-submitted XP values."""
    if questions_answered <= 0:
        return 0
    correct = max(0, min(correct_answers, questions_answered))
    return (correct * XP_PER_CORRECT_ANSWER) + (questions_answered * XP_PER_QUESTION_ANSWERED)


def derive_level(total_xp: int) -> int:
    """Derive the player level from cumulative XP using the threshold table."""
    total_xp = max(0, total_xp)
    level = 1
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if total_xp >= threshold:
            level = i + 1
        else:
            break
    return min(level, MAX_LEVEL)


def xp_for_next_level(total_xp: int) -> Optional[int]:
    """XP required to reach the next level, or None if already at max."""
    current_level = derive_level(total_xp)
    if current_level >= MAX_LEVEL:
        return None  # Already at max level
    next_threshold = LEVEL_THRESHOLDS[current_level]  # 0-indexed: level N is at [N]
    return max(0, next_threshold - total_xp)


# ---------------------------------------------------------------------------
# Phase 4B: 10 Achievement Badges System — Canonical Definitions & Requirements
# ---------------------------------------------------------------------------
ACHIEVEMENTS_CATALOG = [
    {
        "id": "first_victory",
        "title": "First Victory",
        "description": "Complete your first game round.",
        "icon": "🏆",
        "category": "milestone",
        "target": 1,
        "progress_type": "rounds",
    },
    {
        "id": "getting_started",
        "title": "Getting Started",
        "description": "Answer 10 questions correctly in total.",
        "icon": "🎯",
        "category": "accuracy",
        "target": 10,
        "progress_type": "correct_answers",
    },
    {
        "id": "sharp_mind",
        "title": "Sharp Mind",
        "description": "Achieve at least 80% accuracy in a completed round with at least 10 questions.",
        "icon": "🧠",
        "category": "skill",
        "target": 80,
        "progress_type": "round_accuracy",
    },
    {
        "id": "perfect_round",
        "title": "Perfect Round",
        "description": "Answer every question correctly in a completed round containing at least 10 questions.",
        "icon": "⚡",
        "category": "mastery",
        "target": 100,
        "progress_type": "round_perfect",
    },
    {
        "id": "quiz_veteran",
        "title": "Quiz Veteran",
        "description": "Complete 10 game rounds.",
        "icon": "🎖️",
        "category": "dedication",
        "target": 10,
        "progress_type": "rounds",
    },
    {
        "id": "knowledge_seeker",
        "title": "Knowledge Seeker",
        "description": "Complete 25 game rounds.",
        "icon": "🔍",
        "category": "dedication",
        "target": 25,
        "progress_type": "rounds",
    },
    {
        "id": "century_club",
        "title": "Century Club",
        "description": "Answer 100 questions correctly in total.",
        "icon": "💯",
        "category": "accuracy",
        "target": 100,
        "progress_type": "correct_answers",
    },
    {
        "id": "level_up",
        "title": "Level Up",
        "description": "Reach player level 5.",
        "icon": "🚀",
        "category": "progression",
        "target": 5,
        "progress_type": "level",
    },
    {
        "id": "dedicated_player",
        "title": "Dedicated Player",
        "description": "Complete 50 game rounds.",
        "icon": "🛡️",
        "category": "dedication",
        "target": 50,
        "progress_type": "rounds",
    },
    {
        "id": "unstoppable",
        "title": "Unstoppable",
        "description": "Complete 100 game rounds.",
        "icon": "👑",
        "category": "mastery",
        "target": 100,
        "progress_type": "rounds",
    },
]

ACHIEVEMENTS_BY_ID = {ach["id"]: ach for ach in ACHIEVEMENTS_CATALOG}


def evaluate_and_grant_achievements(cursor, user_id: int):
    """
    Evaluates all 10 achievements based on trusted user stats and game history.
    Inserts newly unlocked achievements into user_achievements atomically.
    Returns (all_achievements_list, newly_unlocked_list).
    """
    # 1. Fetch aggregate stats from game_history
    cursor.execute(
        """
        SELECT
            COUNT(*) AS completed_rounds,
            COALESCE(SUM(correct_answers), 0) AS total_correct_answers,
            COALESCE(MAX(CASE WHEN questions_answered >= 10 THEN accuracy ELSE 0 END), 0) AS max_10q_accuracy,
            COALESCE(MAX(CASE WHEN questions_answered >= 10 AND correct_answers = questions_answered THEN 1 ELSE 0 END), 0) AS has_perfect_10q
        FROM game_history
        WHERE user_id = %s
        """,
        (user_id,),
    )
    history_row = cursor.fetchone() or {}

    completed_rounds = int(history_row.get("completed_rounds") or 0)
    total_correct = int(history_row.get("total_correct_answers") or 0)
    max_10q_accuracy = float(history_row.get("max_10q_accuracy") or 0.0)
    has_perfect_10q = bool(history_row.get("has_perfect_10q") or 0)

    # 2. Fetch user's current XP and level
    cursor.execute(
        "SELECT total_xp, player_level FROM users WHERE id = %s",
        (user_id,),
    )
    user_row = cursor.fetchone() or {}
    total_xp = int(user_row.get("total_xp") or 0)
    player_level = derive_level(total_xp)

    # 3. Fetch currently unlocked achievements for this user
    cursor.execute(
        "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = %s",
        (user_id,),
    )
    unlocked_rows = cursor.fetchall() or []
    unlocked_map = {}
    for row in unlocked_rows:
        dt = row.get("unlocked_at")
        iso_dt = dt.isoformat() if isinstance(dt, datetime) else (str(dt) if dt else None)
        unlocked_map[row.get("achievement_id")] = iso_dt

    newly_unlocked = []
    achievements_result = []

    for item in ACHIEVEMENTS_CATALOG:
        ach_id = item["id"]
        target = item["target"]
        prog_type = item["progress_type"]

        # Calculate trusted progress
        if prog_type == "rounds":
            current_val = completed_rounds
            progress_label = f"{min(current_val, target)}/{target} rounds"
            qualifies = current_val >= target
        elif prog_type == "correct_answers":
            current_val = total_correct
            progress_label = f"{min(current_val, target)}/{target} correct answers"
            qualifies = current_val >= target
        elif prog_type == "round_accuracy":
            current_val = round(max_10q_accuracy, 1)
            progress_label = f"{min(current_val, 80.0)}%/80% best (10+ Qs)"
            qualifies = max_10q_accuracy >= 80.0
        elif prog_type == "round_perfect":
            current_val = 1 if has_perfect_10q else 0
            progress_label = "100% (10+ Qs)" if has_perfect_10q else "Incomplete"
            qualifies = has_perfect_10q
        elif prog_type == "level":
            current_val = player_level
            progress_label = f"Level {min(current_val, target)}/{target}"
            qualifies = current_val >= target
        else:
            current_val = 0
            progress_label = "0/0"
            qualifies = False

        is_unlocked = ach_id in unlocked_map
        unlocked_at_str = unlocked_map.get(ach_id)

        # If qualifies and not yet stored in user_achievements, grant it!
        if qualifies and not is_unlocked:
            now_dt = datetime.now(timezone.utc)
            cursor.execute(
                """
                INSERT IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
                VALUES (%s, %s, %s)
                """,
                (user_id, ach_id, now_dt.strftime("%Y-%m-%d %H:%M:%S")),
            )
            is_unlocked = True
            unlocked_at_str = now_dt.isoformat()
            newly_unlocked.append({
                **item,
                "unlocked": True,
                "unlocked_at": unlocked_at_str,
                "current_val": current_val,
                "progress_label": progress_label,
            })

        achievements_result.append({
            **item,
            "unlocked": is_unlocked,
            "unlocked_at": unlocked_at_str,
            "current_val": current_val,
            "progress_label": progress_label,
            "progress_pct": 100.0 if is_unlocked else (
                round(min(100.0, (current_val / target) * 100), 1) if target > 0 else 0.0
            ),
        })

    return achievements_result, newly_unlocked


is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
app = FastAPI(
    title="Truth Pool Authentication API",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

# Supported origins for frontend development and deployment.
# Supports comma-separated FRONTEND_ORIGINS with safe local-development defaults,
# maintaining backward-compatibility with FRONTEND_ORIGIN.
default_origins = "http://localhost:8000,http://127.0.0.1:8000,https://truth-pool-hsxrawof.onslate.in"
raw_origins = os.getenv("FRONTEND_ORIGINS") or os.getenv("FRONTEND_ORIGIN") or default_origins
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
@app.middleware("http")
async def handle_auth_text_plain(request: Request, call_next):
    auth_paths = {"/auth/register", "/auth/login"}

    content_type = request.headers.get("content-type", "")
    media_type = content_type.split(";", 1)[0].strip().lower()

    if (
        request.method == "POST"
        and request.url.path in auth_paths
        and media_type == "text/plain"
    ):
        request.scope["headers"] = [
            (name, value)
            for name, value in request.scope["headers"]
            if name.lower() != b"content-type"
        ] + [(b"content-type", b"application/json")]

    return await call_next(request)

password_hasher = PasswordHasher()
bearer = HTTPBearer()

# Temporary in-memory sessions: they reset when the API restarts.
# For production, use persistent/revocable sessions in a database.
sessions = {}

# ---------------------------------------------------------------------------
# Rate Limiting (Brute-Force Protection for Auth Endpoints)
# ---------------------------------------------------------------------------
LOGIN_ATTEMPTS = defaultdict(list)
REGISTER_ATTEMPTS = defaultdict(list)
RATE_LIMIT_LOGIN_MAX = int(os.getenv("RATE_LIMIT_LOGIN_MAX", "30"))
RATE_LIMIT_REGISTER_MAX = int(os.getenv("RATE_LIMIT_REGISTER_MAX", "20"))
RATE_LIMIT_WINDOW_SECONDS = 60


def check_rate_limit(attempts_dict: dict, ip: str, max_attempts: int, window: int = 60):
    now = time.time()
    cutoff = now - window
    # Prune old timestamps
    attempts_dict[ip] = [ts for ts in attempts_dict[ip] if ts > cutoff]
    if len(attempts_dict[ip]) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment and try again.",
            headers={"Retry-After": str(window)},
        )
    attempts_dict[ip].append(now)


if os.getenv("ENVIRONMENT", "development") != "production":
    @app.post("/auth/rate-limit/reset")
    def reset_rate_limits():
        """Dev/Test helper: resets in-memory rate limit counters after test runs."""
        LOGIN_ATTEMPTS.clear()
        REGISTER_ATTEMPTS.clear()
        return {"status": "rate limits reset"}


def get_connection():
    config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "bluff_or_believe"),
    }
    # Optional Cloud MySQL SSL/TLS configuration (AWS RDS, Aiven, Azure, PlanetScale)
    ssl_ca = os.getenv("DB_SSL_CA")
    if ssl_ca:
        config["ssl_ca"] = ssl_ca
    if os.getenv("DB_SSL_DISABLED", "").lower() in ("true", "1", "yes"):
        config["ssl_disabled"] = True
    elif os.getenv("DB_SSL_VERIFY_CERT", "").lower() in ("false", "0", "no"):
        config["ssl_verify_cert"] = False
    return mysql.connector.connect(**config)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GameCompleteRequest(BaseModel):
    score: int = Field(ge=0, le=10000)
    questions_answered: int = Field(ge=0, le=1000)
    correct_answers: int = Field(ge=0, le=1000)
    category: Optional[str] = Field(None, max_length=100)
    difficulty: Optional[str] = Field(None, max_length=20)
    round_length: Optional[int] = Field(None, ge=1, le=1000)
    started_at: Optional[datetime] = None
    idempotency_key: Optional[str] = Field(None, max_length=64)

    @model_validator(mode="after")
    def validate_counts(self):
        if self.correct_answers > self.questions_answered:
            raise ValueError("correct_answers cannot exceed questions_answered")
        return self


class QuestionCompletedRequest(BaseModel):
    fandom_id: str = Field(min_length=1, max_length=100)
    question_id: int = Field(ge=1, le=1000)


def create_session(user_id: int):
    token = secrets.token_urlsafe(32)
    sessions[token] = {
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return token


def require_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    session = sessions.get(credentials.credentials)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    if session["expires_at"] <= datetime.now(timezone.utc):
        sessions.pop(credentials.credentials, None)
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return session["user_id"]


@app.get("/health")
def health():
    return {"status": "ok", "service": "Bluff or Believe API"}


@app.post("/auth/register", status_code=201)
def register(data: RegisterRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(REGISTER_ATTEMPTS, client_ip, RATE_LIMIT_REGISTER_MAX, RATE_LIMIT_WINDOW_SECONDS)

    username = data.username.strip()
    email = str(data.email).strip().lower()

    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    password_hash = password_hasher.hash(data.password)
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "INSERT INTO users (username, email, password_hash) "
            "VALUES (%s, %s, %s)",
            (username, email, password_hash),
        )
        connection.commit()

        user_id = cursor.lastrowid
        token = create_session(user_id)

        return {
            "message": "Registration successful",
            "user": {"id": user_id, "username": username, "email": email},
            "access_token": token,
            "token_type": "bearer",
        }

    except mysql.connector.IntegrityError:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=409, detail="Email is already registered")

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=500, detail="Database operation failed")

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/auth/login")
def login(data: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(LOGIN_ATTEMPTS, client_ip, RATE_LIMIT_LOGIN_MAX, RATE_LIMIT_WINDOW_SECONDS)

    email = str(data.email).strip().lower()
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT id, username, email, password_hash "
            "FROM users WHERE email = %s",
            (email,),
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        try:
            password_hasher.verify(user["password_hash"], data.password)
        except (VerifyMismatchError, VerificationError):
            raise HTTPException(
                status_code=401, detail="Invalid email or password"
            )

        token = create_session(user["id"])

        return {
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
            },
            "access_token": token,
            "token_type": "bearer",
        }

    except HTTPException:
        raise
    except mysql.connector.Error:
        raise HTTPException(status_code=500, detail="Database operation failed")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.delete("/auth/account")
def delete_account(
    response: Response,
    user_id: int = Depends(require_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        connection.commit()

        # Revoke all in-memory sessions for this user.
        expired_tokens = [
            token for token, session in sessions.items()
            if session["user_id"] == user_id
        ]
        for token in expired_tokens:
            sessions.pop(token, None)

        response.status_code = 200
        return {"message": "Account deleted successfully"}

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=500, detail="Account deletion failed")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/auth/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    sessions.pop(credentials.credentials, None)
    return {"message": "Logged out successfully"}


def init_db():
    """Ensure all tables exist with proper schema; apply non-destructive migrations."""
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()

        # --- users table (must exist before child tables reference it) ---
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        connection.commit()

        # --- game_history table ---
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS game_history (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
                PRIMARY KEY (id),
                UNIQUE KEY uq_game_history_user_idempotency (user_id, idempotency_key),
                KEY idx_game_history_user_id (user_id),
                KEY idx_game_history_completed_at (completed_at),
                CONSTRAINT fk_game_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        connection.commit()

        # Non-destructive column additions (migration safety)
        cursor.execute("SHOW COLUMNS FROM game_history LIKE 'started_at'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE game_history ADD COLUMN started_at TIMESTAMP NULL DEFAULT NULL AFTER round_length")
            connection.commit()

        cursor.execute("SHOW COLUMNS FROM game_history LIKE 'idempotency_key'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE game_history ADD COLUMN idempotency_key VARCHAR(64) DEFAULT NULL AFTER started_at")
            cursor.execute("ALTER TABLE game_history ADD UNIQUE KEY uq_game_history_user_idempotency (user_id, idempotency_key)")
            connection.commit()

        cursor.execute("SHOW COLUMNS FROM game_history LIKE 'xp_awarded'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE game_history ADD COLUMN xp_awarded INT UNSIGNED NOT NULL DEFAULT 0 AFTER idempotency_key")
            connection.commit()

        # --- users table: add XP and level columns ---
        cursor.execute("SHOW COLUMNS FROM users LIKE 'total_xp'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE users ADD COLUMN total_xp INT UNSIGNED NOT NULL DEFAULT 0")
            connection.commit()

        cursor.execute("SHOW COLUMNS FROM users LIKE 'player_level'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE users ADD COLUMN player_level TINYINT UNSIGNED NOT NULL DEFAULT 1")
            connection.commit()

        # Back-fill player_level from total_xp for existing users (safe, idempotent)
        cursor.execute("SELECT id, total_xp FROM users WHERE player_level = 1 AND total_xp > 0")
        needs_backfill = cursor.fetchall()
        for uid, xp in needs_backfill:
            lv = derive_level(int(xp or 0))
            cursor.execute("UPDATE users SET player_level = %s WHERE id = %s", (lv, uid))
        if needs_backfill:
            connection.commit()

        # --- user_achievements table (Phase 4B) ---
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
                CONSTRAINT fk_user_achievements_user FOREIGN KEY (user_id)
                    REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        connection.commit()

        # --- user_fandom_questions table (Phase 2) ---
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        connection.commit()

        # --- user_fandom_badges table (Phase 2) ---
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        connection.commit()

    except mysql.connector.Error as err:
        print(f"Database schema init warning: {err}")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/games/complete", status_code=200)
def save_completed_game(
    data: GameCompleteRequest,
    user_id: int = Depends(require_user),
):
    # Server-side accuracy calculation (never trust client value)
    if data.questions_answered > 0:
        accuracy = round((data.correct_answers / data.questions_answered) * 100, 2)
    else:
        accuracy = 0.0

    # Server-side XP calculation (never trust client-submitted XP)
    # Formula: (correct_answers × 10) + (questions_answered × 5)
    # Only genuine completed rounds reach this endpoint; abandoned rounds do not.
    xp_earned = calculate_xp_for_round(data.questions_answered, data.correct_answers)

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Idempotency check: if this idempotency_key was already saved for this user,
        # return the previously recorded game without re-awarding XP.
        if data.idempotency_key:
            cursor.execute(
                """
                SELECT id, user_id, score, questions_answered, correct_answers,
                       CAST(accuracy AS DOUBLE) AS accuracy, category, difficulty,
                       round_length, started_at, completed_at, idempotency_key,
                       xp_awarded
                FROM game_history
                WHERE user_id = %s AND idempotency_key = %s
                """,
                (user_id, data.idempotency_key),
            )
            existing = cursor.fetchone()
            if existing:
                if existing.get("started_at") and isinstance(existing["started_at"], datetime):
                    existing["started_at"] = existing["started_at"].isoformat()
                if existing.get("completed_at") and isinstance(existing["completed_at"], datetime):
                    existing["completed_at"] = existing["completed_at"].isoformat()
                # Fetch current XP/level for idempotent response
                cursor.execute(
                    "SELECT total_xp, player_level FROM users WHERE id = %s",
                    (user_id,),
                )
                user_row = cursor.fetchone()
                current_xp = int(user_row["total_xp"] or 0) if user_row else 0
                current_level = int(user_row["player_level"] or 1) if user_row else 1
                return {
                    "message": "Game round already recorded",
                    "idempotent": True,
                    "game": existing,
                    "xp": {
                        "xp_earned": existing.get("xp_awarded", 0),
                        "xp_earned_this_round": 0,  # No XP re-awarded on duplicate
                        "total_xp": current_xp,
                        "player_level": current_level,
                        "xp_to_next_level": xp_for_next_level(current_xp),
                        "level_thresholds": LEVEL_THRESHOLDS,
                        "leveled_up": False,
                    },
                }

        # Fetch user's current XP/level BEFORE this round
        cursor.execute(
            "SELECT total_xp, player_level FROM users WHERE id = %s FOR UPDATE",
            (user_id,),
        )
        user_row = cursor.fetchone()
        xp_before = int(user_row["total_xp"] or 0) if user_row else 0
        level_before = int(user_row["player_level"] or 1) if user_row else 1

        # Calculate new cumulative XP and level
        xp_after = xp_before + xp_earned
        level_after = derive_level(xp_after)
        leveled_up = level_after > level_before

        # Insert completed game with server-calculated XP
        cursor.execute(
            """
            INSERT INTO game_history
            (user_id, score, questions_answered, correct_answers, accuracy,
             category, difficulty, round_length, started_at, idempotency_key, xp_awarded)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                data.score,
                data.questions_answered,
                data.correct_answers,
                accuracy,
                data.category,
                data.difficulty,
                data.round_length,
                data.started_at,
                data.idempotency_key,
                xp_earned,
            ),
        )
        game_id = cursor.lastrowid

        # Update user's cumulative XP and level atomically
        cursor.execute(
            "UPDATE users SET total_xp = %s, player_level = %s WHERE id = %s",
            (xp_after, level_after, user_id),
        )

        # Evaluate and grant achievements based on updated state
        achievements_result, newly_unlocked = evaluate_and_grant_achievements(cursor, user_id)
        connection.commit()

        # Fetch the saved game record
        cursor.execute(
            """
            SELECT id, user_id, score, questions_answered, correct_answers,
                   CAST(accuracy AS DOUBLE) AS accuracy, category, difficulty,
                   round_length, started_at, completed_at, idempotency_key, xp_awarded
            FROM game_history
            WHERE id = %s
            """,
            (game_id,),
        )
        saved = cursor.fetchone()
        if saved:
            if saved.get("started_at") and isinstance(saved["started_at"], datetime):
                saved["started_at"] = saved["started_at"].isoformat()
            if saved.get("completed_at") and isinstance(saved["completed_at"], datetime):
                saved["completed_at"] = saved["completed_at"].isoformat()

        return {
            "message": "Game round saved successfully",
            "idempotent": False,
            "game": saved,
            "xp": {
                "xp_earned": xp_earned,
                "xp_earned_this_round": xp_earned,
                "total_xp": xp_after,
                "player_level": level_after,
                "xp_to_next_level": xp_for_next_level(xp_after),
                "level_thresholds": LEVEL_THRESHOLDS,
                "leveled_up": leveled_up,
                "level_before": level_before,
                "level_after": level_after,
            },
            "achievements": {
                "newly_unlocked": newly_unlocked,
                "total_unlocked": sum(1 for a in achievements_result if a["unlocked"]),
                "total_count": len(achievements_result),
                "items": achievements_result,
            },
        }

    except mysql.connector.IntegrityError:
        if connection:
            connection.rollback()
        # Concurrent request with same idempotency_key — safe fallback read
        if data.idempotency_key:
            try:
                cursor.execute(
                    """
                    SELECT id, user_id, score, questions_answered, correct_answers,
                           CAST(accuracy AS DOUBLE) AS accuracy, category, difficulty,
                           round_length, started_at, completed_at, idempotency_key, xp_awarded
                    FROM game_history
                    WHERE user_id = %s AND idempotency_key = %s
                    """,
                    (user_id, data.idempotency_key),
                )
                existing = cursor.fetchone()
                if existing:
                    if existing.get("started_at") and isinstance(existing["started_at"], datetime):
                        existing["started_at"] = existing["started_at"].isoformat()
                    if existing.get("completed_at") and isinstance(existing["completed_at"], datetime):
                        existing["completed_at"] = existing["completed_at"].isoformat()
                    cursor.execute("SELECT total_xp, player_level FROM users WHERE id = %s", (user_id,))
                    user_row = cursor.fetchone()
                    current_xp = int(user_row["total_xp"] or 0) if user_row else 0
                    current_level = int(user_row["player_level"] or 1) if user_row else 1
                    ach_result, _ = evaluate_and_grant_achievements(cursor, user_id)
                    return {
                        "message": "Game round already recorded",
                        "idempotent": True,
                        "game": existing,
                        "xp": {
                            "xp_earned": existing.get("xp_awarded", 0),
                            "xp_earned_this_round": 0,
                            "total_xp": current_xp,
                            "player_level": current_level,
                            "xp_to_next_level": xp_for_next_level(current_xp),
                            "level_thresholds": LEVEL_THRESHOLDS,
                            "leveled_up": False,
                        },
                        "achievements": {
                            "newly_unlocked": [],
                            "total_unlocked": sum(1 for a in ach_result if a["unlocked"]),
                            "total_count": len(ach_result),
                            "items": ach_result,
                        },
                    }
            except Exception:
                pass
        raise HTTPException(status_code=409, detail="Duplicate game record conflict")

    except mysql.connector.Error:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=500, detail="Database operation failed")

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/games/history")
def get_game_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(require_user),
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT COUNT(*) AS total FROM game_history WHERE user_id = %s",
            (user_id,),
        )
        total = cursor.fetchone()["total"]

        cursor.execute(
            """
            SELECT id, user_id, score, questions_answered, correct_answers,
                   CAST(accuracy AS DOUBLE) AS accuracy, category, difficulty,
                   round_length, started_at, completed_at
            FROM game_history
            WHERE user_id = %s
            ORDER BY completed_at DESC, id DESC
            LIMIT %s OFFSET %s
            """,
            (user_id, limit, offset),
        )
        rows = cursor.fetchall()

        for row in rows:
            if row.get("started_at") and isinstance(row["started_at"], datetime):
                row["started_at"] = row["started_at"].isoformat()
            if row.get("completed_at") and isinstance(row["completed_at"], datetime):
                row["completed_at"] = row["completed_at"].isoformat()

        return {
            "games": rows,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    except mysql.connector.Error:
        raise HTTPException(status_code=500, detail="Database operation failed")

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/players/me/xp")
def get_player_xp(
    user_id: int = Depends(require_user),
):
    """Returns the authenticated player's current XP, level, and progression info."""
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT total_xp, player_level FROM users WHERE id = %s",
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        total_xp = int(row["total_xp"] or 0)
        # Always re-derive level to keep it in sync (defensive)
        player_level = derive_level(total_xp)

        # If derived level differs from stored, correct it silently
        stored_level = int(row["player_level"] or 1)
        if player_level != stored_level:
            cursor.execute(
                "UPDATE users SET player_level = %s WHERE id = %s",
                (player_level, user_id),
            )
            connection.commit()

        # XP within the current level (for progress bar)
        current_level_start_xp = LEVEL_THRESHOLDS[player_level - 1]
        if player_level < MAX_LEVEL:
            next_level_xp = LEVEL_THRESHOLDS[player_level]
            xp_in_level = total_xp - current_level_start_xp
            xp_needed_for_level = next_level_xp - current_level_start_xp
            level_progress_pct = round(
                (xp_in_level / xp_needed_for_level) * 100, 1
            ) if xp_needed_for_level > 0 else 100.0
        else:
            next_level_xp = None
            xp_in_level = total_xp - current_level_start_xp
            xp_needed_for_level = 0
            level_progress_pct = 100.0

        return {
            "total_xp": total_xp,
            "player_level": player_level,
            "max_level": MAX_LEVEL,
            "xp_to_next_level": xp_for_next_level(total_xp),
            "xp_in_current_level": xp_in_level,
            "xp_needed_for_level": xp_needed_for_level,
            "level_progress_pct": level_progress_pct,
            "level_thresholds": LEVEL_THRESHOLDS,
            "current_level_start_xp": current_level_start_xp,
            "next_level_start_xp": next_level_xp,
        }

    except HTTPException:
        raise
    except mysql.connector.Error:
        raise HTTPException(status_code=500, detail="Database operation failed")

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/players/me/stats")
def get_player_stats(
    user_id: int = Depends(require_user),
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Fetch both game history aggregates AND user XP/level in one trip
        cursor.execute(
            """
            SELECT
                COUNT(*) AS completed_rounds,
                COALESCE(SUM(questions_answered), 0) AS total_questions_answered,
                COALESCE(SUM(correct_answers), 0) AS total_correct_answers,
                COALESCE(MAX(score), 0) AS best_score,
                MAX(completed_at) AS most_recent_completed_at
            FROM game_history
            WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cursor.fetchone()

        cursor.execute(
            "SELECT total_xp, player_level FROM users WHERE id = %s",
            (user_id,),
        )
        user_row = cursor.fetchone()

        completed_rounds = int(row["completed_rounds"] or 0)
        total_q = int(row["total_questions_answered"] or 0)
        total_c = int(row["total_correct_answers"] or 0)
        best_score = int(row["best_score"] or 0)
        most_recent = row["most_recent_completed_at"]

        total_xp = int(user_row["total_xp"] or 0) if user_row else 0
        player_level = derive_level(total_xp)

        if total_q > 0:
            overall_accuracy = round((total_c / total_q) * 100, 2)
        else:
            overall_accuracy = 0.0

        achievements_result, _ = evaluate_and_grant_achievements(cursor, user_id)
        connection.commit()

        return {
            "completed_rounds": completed_rounds,
            "total_questions_answered": total_q,
            "total_correct_answers": total_c,
            "overall_accuracy": overall_accuracy,
            "best_score": best_score,
            "most_recent_completed_at": (
                most_recent.isoformat() if isinstance(most_recent, datetime) else None
            ),
            "total_xp": total_xp,
            "player_level": player_level,
            "xp_to_next_level": xp_for_next_level(total_xp),
            "achievements_summary": {
                "unlocked_count": sum(1 for a in achievements_result if a["unlocked"]),
                "total_count": len(achievements_result),
            },
        }

    except mysql.connector.Error:
        raise HTTPException(status_code=500, detail="Database operation failed")

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/players/me/achievements")
def get_player_achievements(
    user_id: int = Depends(require_user),
):
    """
    Returns the authenticated player's complete achievements dashboard payload:
    All 10 badges with unlocked status, real progress numbers, percentage,
    unlock timestamps, and summary counts.
    """
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        achievements_result, _ = evaluate_and_grant_achievements(cursor, user_id)
        connection.commit()

        unlocked_count = sum(1 for a in achievements_result if a["unlocked"])
        total_count = len(achievements_result)

        return {
            "unlocked_count": unlocked_count,
            "total_count": total_count,
            "completion_pct": round((unlocked_count / total_count) * 100, 1) if total_count > 0 else 0.0,
            "achievements": achievements_result,
        }

    except mysql.connector.Error:
        raise HTTPException(status_code=500, detail="Database operation failed")

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ---------------------------------------------------------------------------
# Phase 2: Fandom Badge Unlock System Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/fandom/question-completed")
def record_fandom_question_completed(
    data: QuestionCompletedRequest,
    user_id: int = Depends(require_user),
):
    """
    Records a completed question for an authenticated user and fandom.
    Counts each unique question ID at most once toward badge progression.
    Evaluates and awards Tier 1 (100 Qs) and Tier 2 (200 Qs) badges automatically.
    """
    fandom_id = data.fandom_id.strip()
    question_id = data.question_id

    if fandom_id not in FANDOM_BADGES_BY_FANDOM:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fandom '{fandom_id}'. Valid fandoms: {list(FANDOM_BADGES_BY_FANDOM.keys())}",
        )

    valid_ids = FANDOM_VALID_QUESTION_IDS.get(fandom_id, set())
    if question_id not in valid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid question ID {question_id} for fandom '{fandom_id}' (must exist in dataset).",
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # 1. Record completed question (deduplicated via unique key constraint)
        cursor.execute(
            """
            INSERT IGNORE INTO user_fandom_questions (user_id, fandom_id, question_id)
            VALUES (%s, %s, %s)
            """,
            (user_id, fandom_id, question_id),
        )
        was_new_question = (cursor.rowcount == 1)

        # 2. Query total unique questions completed for this user and fandom
        cursor.execute(
            """
            SELECT COUNT(DISTINCT question_id) AS completed_count
            FROM user_fandom_questions
            WHERE user_id = %s AND fandom_id = %s
            """,
            (user_id, fandom_id),
        )
        row = cursor.fetchone()
        completed_count = int(row["completed_count"] or 0) if row else 0

        # 3. Query existing unlocked badges for this user and fandom
        cursor.execute(
            """
            SELECT badge_id, badge_tier, unlocked_at
            FROM user_fandom_badges
            WHERE user_id = %s AND fandom_id = %s
            """,
            (user_id, fandom_id),
        )
        unlocked_rows = cursor.fetchall() or []
        unlocked_badge_ids = {r["badge_id"] for r in unlocked_rows}

        # 4. Evaluate badges according to canonical badge configuration
        newly_unlocked = []
        now_dt = datetime.now(timezone.utc)
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        fandom_badges = FANDOM_BADGES_BY_FANDOM.get(fandom_id, [])
        for badge in fandom_badges:
            req_q = badge["required_questions"]
            b_id = badge["badge_id"]
            tier = badge["badge_tier"]

            # Award if user reached threshold and has not yet earned this badge
            if completed_count >= req_q and b_id not in unlocked_badge_ids:
                cursor.execute(
                    """
                    INSERT IGNORE INTO user_fandom_badges (user_id, fandom_id, badge_id, badge_tier, unlocked_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (user_id, fandom_id, b_id, tier, now_str),
                )
                unlocked_badge_ids.add(b_id)
                newly_unlocked.append({
                    **badge,
                    "unlocked": True,
                    "unlocked_at": now_dt.isoformat(),
                })

        connection.commit()

        # Query all currently earned badges for this fandom
        cursor.execute(
            """
            SELECT badge_id, badge_tier, unlocked_at
            FROM user_fandom_badges
            WHERE user_id = %s AND fandom_id = %s
            ORDER BY badge_tier ASC
            """,
            (user_id, fandom_id),
        )
        earned_rows = cursor.fetchall() or []
        earned_badges = []
        for er in earned_rows:
            b_info = next((b for b in fandom_badges if b["badge_id"] == er["badge_id"]), None)
            if b_info:
                dt = er.get("unlocked_at")
                iso_dt = dt.isoformat() if isinstance(dt, datetime) else (str(dt) if dt else None)
                earned_badges.append({
                    **b_info,
                    "unlocked": True,
                    "unlocked_at": iso_dt,
                })

        return {
            "fandom_id": fandom_id,
            "question_id": question_id,
            "already_completed": not was_new_question,
            "completed_questions": completed_count,
            "total_questions": 200,
            "progress_pct": round(min(100.0, (completed_count / 200) * 100), 1),
            "newly_unlocked_badges": newly_unlocked,
            "earned_badges": earned_badges,
        }

    except HTTPException:
        if connection:
            connection.rollback()
        raise
    except mysql.connector.Error:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=500, detail="Database operation failed")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/fandom/progress")
def get_fandom_progress(
    fandom_id: Optional[str] = Query(None),
    user_id: int = Depends(require_user),
):
    """
    Returns the authenticated user's completed-question count and unlock status
    per fandom. Supports filtering by fandom_id or retrieving all 11 fandoms.
    """
    if fandom_id and fandom_id not in FANDOM_BADGES_BY_FANDOM:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fandom '{fandom_id}'. Valid fandoms: {list(FANDOM_BADGES_BY_FANDOM.keys())}",
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        if fandom_id:
            cursor.execute(
                """
                SELECT fandom_id, COUNT(DISTINCT question_id) AS completed_count
                FROM user_fandom_questions
                WHERE user_id = %s AND fandom_id = %s
                GROUP BY fandom_id
                """,
                (user_id, fandom_id),
            )
        else:
            cursor.execute(
                """
                SELECT fandom_id, COUNT(DISTINCT question_id) AS completed_count
                FROM user_fandom_questions
                WHERE user_id = %s
                GROUP BY fandom_id
                """,
                (user_id,),
            )
        q_rows = cursor.fetchall() or []
        counts_map = {r["fandom_id"]: int(r["completed_count"] or 0) for r in q_rows}

        if fandom_id:
            cursor.execute(
                """
                SELECT fandom_id, badge_id, badge_tier, unlocked_at
                FROM user_fandom_badges
                WHERE user_id = %s AND fandom_id = %s
                """,
                (user_id, fandom_id),
            )
        else:
            cursor.execute(
                """
                SELECT fandom_id, badge_id, badge_tier, unlocked_at
                FROM user_fandom_badges
                WHERE user_id = %s
                """,
                (user_id,),
            )
        badge_rows = cursor.fetchall() or []
        badges_by_fid = {}
        for br in badge_rows:
            fid = br["fandom_id"]
            dt = br.get("unlocked_at")
            iso_dt = dt.isoformat() if isinstance(dt, datetime) else (str(dt) if dt else None)
            badges_by_fid.setdefault(fid, {})[br["badge_tier"]] = {
                "badge_id": br["badge_id"],
                "unlocked_at": iso_dt,
            }

        target_fandoms = [fandom_id] if fandom_id else sorted(FANDOM_BADGES_BY_FANDOM.keys())
        progress_list = []

        for fid in target_fandoms:
            count = counts_map.get(fid, 0)
            earned_dict = badges_by_fid.get(fid, {})
            tier1_earned = 1 in earned_dict
            tier2_earned = 2 in earned_dict

            progress_list.append({
                "fandom_id": fid,
                "completed_questions": count,
                "total_questions": 200,
                "progress_pct": round(min(100.0, (count / 200) * 100), 1),
                "tier1_unlocked": tier1_earned,
                "tier1_unlocked_at": earned_dict.get(1, {}).get("unlocked_at"),
                "tier2_unlocked": tier2_earned,
                "tier2_unlocked_at": earned_dict.get(2, {}).get("unlocked_at"),
            })

        return {
            "total_fandoms": len(target_fandoms),
            "fandoms": progress_list if not fandom_id else progress_list[0],
        }

    except HTTPException:
        raise
    except mysql.connector.Error:
        raise HTTPException(status_code=500, detail="Database operation failed")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/fandom/badges")
def get_fandom_badges(
    fandom_id: Optional[str] = Query(None),
    user_id: int = Depends(require_user),
):
    """
    Returns all 22 fandom achievement badges with the authenticated user's
    unlock status, unlock timestamp, and current question progress.
    """
    if fandom_id and fandom_id not in FANDOM_BADGES_BY_FANDOM:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fandom '{fandom_id}'. Valid fandoms: {list(FANDOM_BADGES_BY_FANDOM.keys())}",
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT fandom_id, COUNT(DISTINCT question_id) AS completed_count
            FROM user_fandom_questions
            WHERE user_id = %s
            GROUP BY fandom_id
            """,
            (user_id,),
        )
        q_rows = cursor.fetchall() or []
        counts_map = {r["fandom_id"]: int(r["completed_count"] or 0) for r in q_rows}

        cursor.execute(
            """
            SELECT badge_id, unlocked_at
            FROM user_fandom_badges
            WHERE user_id = %s
            """,
            (user_id,),
        )
        badge_rows = cursor.fetchall() or []
        unlocked_map = {}
        for r in badge_rows:
            dt = r.get("unlocked_at")
            iso_dt = dt.isoformat() if isinstance(dt, datetime) else (str(dt) if dt else None)
            unlocked_map[r["badge_id"]] = iso_dt

        catalog = FANDOM_BADGES_CATALOG if not fandom_id else FANDOM_BADGES_BY_FANDOM.get(fandom_id, [])

        badges_result = []
        for b in catalog:
            b_id = b["badge_id"]
            fid = b["fandom_id"]
            current_q = counts_map.get(fid, 0)
            req_q = b["required_questions"]
            is_unlocked = b_id in unlocked_map

            badges_result.append({
                **b,
                "unlocked": is_unlocked,
                "unlocked_at": unlocked_map.get(b_id),
                "current_questions": current_q,
                "progress_pct": 100.0 if is_unlocked else round(min(100.0, (current_q / req_q) * 100), 1),
            })

        unlocked_count = sum(1 for b in badges_result if b["unlocked"])
        total_count = len(badges_result)

        return {
            "unlocked_count": unlocked_count,
            "total_count": total_count,
            "completion_pct": round((unlocked_count / total_count) * 100, 1) if total_count > 0 else 0.0,
            "badges": badges_result,
        }

    except HTTPException:
        raise
    except mysql.connector.Error:
        raise HTTPException(status_code=500, detail="Database operation failed")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
