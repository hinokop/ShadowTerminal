@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
  py -3 "%~dp0terminal_lokal.py"
  if errorlevel 1 pause
  exit /b
)
python "%~dp0terminal_lokal.py"
if errorlevel 1 (
  echo Fuer den lokalen Datenbankzugriff wird Python 3 benoetigt.
  pause
)
