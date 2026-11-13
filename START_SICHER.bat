@echo off
rem ============================================================
rem  Field Terminal - SICHERER Start (Grafik aus, Profil lokal)
rem  Fuer Rechner, auf denen START.bat ein schwarzes Fenster zeigt
rem  oder sich sofort schliesst. Das Profil liegt dann unter
rem  %LocalAppData%\FieldTerminal (Zustand reist nicht mit dem Stick).
rem  Field Terminal - Start vom Stick
rem  Oeffnet index.html in einem Edge-Anwendungsfenster (ohne
rem  Adresszeile und Tabs). Das Browserprofil liegt im Ordner
rem  "profil" neben dieser Datei; Zustand, Protokoll und Kennungs-
rem  Hash reisen damit mit dem Stick. Ordner "profil" loeschen =
rem  alles auf Anfang.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

if not exist "%~dp0index.html" goto fehlt
if not exist "%~dp0szenario.js" goto fehlt
if not exist "%~dp0karte-modul.js" goto fehlt

set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE goto kein_edge

rem Dateiadresse bilden: Backslashes zu Schraegstrichen, Leerzeichen zu %%20
set "BASIS=%~dp0"
set "URL=!BASIS:\=/!"
set "URL=!URL: =%%20!"

start "" "!EDGE!" --app="file:///!URL!index.html" --user-data-dir="%LocalAppData%\FieldTerminal\profil" --disable-gpu --disable-software-rasterizer --start-fullscreen --no-first-run --no-default-browser-check --window-size=1440,900
exit /b 0

:fehlt
echo index.html, szenario.js oder karte-modul.js fehlt neben dieser Datei.
pause
exit /b 1

:kein_edge
echo Microsoft Edge wurde nicht gefunden.
pause
exit /b 1
