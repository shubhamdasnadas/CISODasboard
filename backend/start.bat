@echo off
REM CISO Dashboard backend — Windows startup script
REM Double-click this file (or run from cmd) to start the backend.

echo.
echo === CISO Dashboard Backend ===
echo.

REM Make sure we're in the right directory
cd /d "%~dp0"

REM Install dependencies on first run
if not exist "node_modules\" (
  echo [setup] First run — installing dependencies...
  call npm install
  if errorlevel 1 goto :error
)

REM Start the server
echo [start] Launching API on http://localhost:5000
echo [start] Health check: http://localhost:5000/api/health
echo.
npm run dev

goto :eof

:error
echo.
echo [error] Setup failed. See messages above.
exit /b 1
