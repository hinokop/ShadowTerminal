@echo off
rem ============================================================
rem  Field Terminal - DIAGNOSE
rem  Startet das Fenster mit dem Profil auf dem Stick bzw. im
rem  Ordner, schreibt Protokoll und Systemangaben in diagnose.txt
rem  neben dieser Datei und beendet sich nach etwa 15 Sekunden.
rem  Bitte diagnose.txt anschliessend schicken.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "OUT=%~dp0diagnose.txt"
set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE (
  echo Microsoft Edge wurde nicht gefunden.
  pause
  exit /b 1
)
set "BASIS=%~dp0"
set "URL=!BASIS:\=/!"
set "URL=!URL: =%%20!"
echo Diagnose laeuft, bitte das Fenster beobachten (ca. 15 s) ...
start "" "!EDGE!" --app="file:///!URL!index.html" --user-data-dir="%~dp0profil" --disable-gpu --disable-software-rasterizer --enable-logging --v=0 --no-first-run --no-default-browser-check --window-size=1440,900
timeout /t 15 /nobreak >nul
(
  echo FIELD TERMINAL DIAGNOSE
  echo Datum: %DATE% %TIME%
  echo Ordner: %~dp0
  echo Edge: !EDGE!
  powershell -NoProfile -Command "(Get-Item '!EDGE!').VersionInfo.ProductVersion"
  echo Windows:
  ver
  echo.
  echo --- Inhalt profil
  dir /a "%~dp0profil"
  echo.
  echo --- Last Version
  if exist "%~dp0profil\Last Version" (type "%~dp0profil\Last Version") else echo nicht vorhanden
  echo.
  echo --- Singleton-Dateien
  dir /a "%~dp0profil\Singleton*" 2^>nul
  echo.
  echo --- Laufende Edge-Prozesse
  tasklist /fi "imagename eq msedge.exe" /fo csv /nh
  echo.
  echo --- chrome_debug.log ^(letzte 60 Zeilen^)
  if exist "%~dp0profil\chrome_debug.log" (powershell -NoProfile -Command "Get-Content -LiteralPath '%~dp0profil\chrome_debug.log' -Tail 60") else echo keine Protokolldatei
) > "!OUT!" 2>&1
echo Fertig. Datei: !OUT!
pause
exit /b 0
