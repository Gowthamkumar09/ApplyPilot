@echo off
cd /d "%~dp0"
if not exist backend\.venv (
  python -m venv backend\.venv
  call backend\.venv\Scripts\activate
  pip install -r backend\requirements.txt
) else (
  call backend\.venv\Scripts\activate
)
if not exist backend\.env copy .env.example backend\.env
pushd frontend
if not exist node_modules call npm install
call npm run build
popd
start "" http://localhost:8000
cd backend
uvicorn app.main:app --port 8000
