# 🎯 Truth Pool

### A fandom-based Fact or Trap game

**Truth Pool** is a web-based trivia game built around the fictional universes fans love. Players evaluate claims about characters, events, powers, and storylines, deciding whether each claim is a **FACT** or a **TRAP**.

The project combines fandom trivia with player accounts, XP, badges, and progress tracking. It was developed as a hands-on project in frontend development, API integration, database management, and gamified experiences.

> **Think you know your universe? Prove it.**

## 📌 Project Status

**Status: Completed as a development project; deployment was not pursued.**

The project is retained as a completed codebase and learning portfolio. It is not presented as a live, publicly deployed service, and it may not receive further updates.

## ✨ Features

- **Fact or Trap gameplay** — Evaluate claims about fictional characters, events, powers, and storylines.
- **Multiple fandoms** — Structured question collections for superhero universes, anime, animation, and television.
- **Player accounts** — Registration and login through a FastAPI backend.
- **XP and progression** — Gamified player progress.
- **Badge system** — Achievements linked to gameplay and fandom categories.
- **Question datasets** — JSON-based question content that can be maintained separately from the application code.
- **Player data storage** — MySQL integration for account data and supported progress features.
- **Password hashing** — Argon2-based password hashing in the authentication backend.

Features listed here describe the intended application capabilities. Running the project in a new environment may require additional configuration and testing.

## 🌌 Fandom Examples

The question collections were designed to cover fandoms such as:

- Marvel
- DC
- One Piece
- Naruto
- Dragon Ball
- Bleach
- Demon Slayer
- My Hero Academia
- Ben 10
- The Boys
- Game of Thrones

The fandoms and questions available at runtime depend on the datasets included in the repository.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Webpage structure |
| CSS3 | Styling and layout |
| JavaScript | Frontend interactions and gameplay |
| JSON | Question and badge data |
| Python | Backend development |
| FastAPI | Authentication and REST API |
| MySQL | Database |
| Argon2 | Password hashing |
| Uvicorn | ASGI server |
| Git and GitHub | Version control and source hosting |

## 🏗️ Architecture

```text
                  TRUTH POOL
                      |
          +-----------+-----------+
          |                       |
       Frontend                 Backend
    HTML / CSS / JS           FastAPI / Python
          |                       |
          |                  Authentication
          |                       |
          +-------------------- MySQL
                      |
             Player accounts and
              supported progress
```

The frontend presents the game and communicates with the FastAPI backend. The backend handles authentication and database operations. JSON files provide the fandom question and badge content.

## 📁 Project Structure

```text
Truth_Pool/
├── index.html
├── server.py
├── auth_api.py
├── requirements.txt
├── .env.example
├── .gitignore
├── assets/
├── css/
├── data/
├── js/
├── scripts/
├── tests/
├── reports/
└── README.md
```

This is a simplified overview. The actual repository may contain additional files and folders.

## 🚀 Run Locally

These instructions describe the expected local setup. Because the project is no longer actively maintained, compatibility with newer software versions is not guaranteed.

### Prerequisites

- Python 3.12 or another compatible Python version
- MySQL
- Git
- A modern web browser

### 1. Clone the repository

```powershell
git clone https://github.com/meshak-1234/Truth_Pool.git
cd Truth_Pool
```

### 2. Create and activate a virtual environment

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use the virtual environment's Python executable directly.

### 3. Install dependencies

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a local `.env` file from the example:

```powershell
Copy-Item .env.example .env
```

Edit `.env` locally and provide the settings that match your MySQL installation. For example:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_local_mysql_username
DB_PASSWORD=your_local_mysql_password
DB_NAME=bluff_or_believe

ENVIRONMENT=development
FRONTEND_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
```

Make sure the MySQL server and required database tables are set up before running the backend.

**Security:** Never commit `.env` or real credentials to source control. Keep secrets out of screenshots, issue reports, and public messages.

### 5. Start the backend

In the project directory, run:

```powershell
uvicorn auth_api:app --host 127.0.0.1 --port 8001 --reload
```

If startup succeeds, the health endpoint is expected at:

```text
http://127.0.0.1:8001/health
```

During development, API documentation may be available at:

```text
http://127.0.0.1:8001/docs
```

### 6. Start the frontend

Open a second terminal in the project directory:

```powershell
python server.py
```

Open the local address configured by `server.py` (commonly `http://localhost:8000`).

If the frontend cannot contact the backend, check the frontend API base URL, backend status, database connection, and CORS settings.

## 🗂️ Question Dataset Format

Question content is stored in JSON files. A representative question object may look like this:

```json
{
  "id": "marvel_001",
  "claim": "Example claim about a fictional universe.",
  "answer": "FACT",
  "category": "Marvel",
  "difficulty": "easy",
  "explanation": "An explanation supporting the correct answer.",
  "source_name": "Reference name",
  "source_url": "https://example.com"
}
```

Use the exact schema expected by the application when adding or modifying questions.

### Dataset guidelines

- Keep question IDs unique.
- Use consistent answer labels (`FACT` and `TRAP`) matching the application.
- Write clear explanations.
- Verify claims against reliable sources.
- Avoid duplicates and misleading wording.
- Validate JSON syntax before loading the data.

## 🔐 Security Considerations

This repository is a development project, not a claim of a production security audit.

- Store secrets in environment variables.
- Do not commit `.env` or production credentials.
- Use HTTPS when hosting the application.
- Use TLS for remote database connections.
- Review session persistence, token revocation, and rate limiting before any public deployment.
- Back up the database before migrations or destructive changes.
- Test authentication and account deletion in any new environment.

## 🧪 Testing

When running or modifying the project, test the following:

- JSON datasets parse successfully.
- Registration and login work.
- Passwords are stored as hashes, not plaintext.
- Database records can be saved and retrieved.
- XP, badges, and progress behave as expected.
- Invalid requests are handled safely.
- Frontend and backend connectivity works.
- The application behaves correctly after a backend restart.

No claim of current production deployment or ongoing automated monitoring is made.

## 📚 What This Project Explores

Truth Pool brings together several practical software development concepts:

- Building an interactive frontend with HTML, CSS, and JavaScript.
- Designing a REST API using FastAPI.
- Connecting a Python backend to MySQL.
- Managing structured JSON datasets.
- Implementing account registration and authentication.
- Using password hashing for safer credential storage.
- Designing gamification features such as XP, badges, and progression.
- Managing source code with Git and GitHub.

## ⚖️ Intellectual Property

Truth Pool is an unofficial fan-oriented trivia project. Names, characters, franchises, and trademarks referenced in question collections belong to their respective owners. The project is not affiliated with or endorsed by those rights holders.

## 👨‍💻 Repository

**Project:** Truth Pool  
**Source code:** [meshak-1234/Truth_Pool](https://github.com/meshak-1234/Truth_Pool)

---

**Truth Pool — Fact or Trap? Test what you know about the worlds you love.**
