@echo off
rem ============================================================
rem  Field Terminal - LOKALER Start (Grafik aus, Profil lokal)
rem  Das Profil liegt unter %LocalAppData%\FieldTerminal\profil.
rem  Beim ersten Start wird ein vorhandener Ordner "profil" vom
rem  Stick einmalig dorthin KOPIERT (Dossiers und Zustand kommen
rem  mit). Danach arbeiten Stick und Rechner getrennt weiter.
rem  Abgleich zwischen beiden Staenden: in der Anwendung Profil
rem  exportieren und auf der anderen Seite importieren.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

if not exist "%~dp0index.html" goto fehlt
if not exist "%~dp0szenario.js" goto fehlt
if not exist "%~dp0karte-modul.js" goto fehlt
if not exist "%~dp0akten-modul.js" goto fehlt

set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE goto kein_edge

rem Dateiadresse bilden: Backslashes zu Schraegstrichen, Leerzeichen zu %%20
set "BASIS=%~dp0"
set "URL=!BASIS:\=/!"
set "URL=!URL: =%%20!"

set "LOK=%LocalAppData%\FieldTerminal\profil"
if not exist "!LOK!" if exist "%~dp0profil" (
  echo Einmalige Uebernahme des Stick-Profils, bitte kurz warten ...
  robocopy "%~dp0profil" "!LOK!" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
)
start "" "!EDGE!" --app="file:///!URL!index.html" --user-data-dir="!LOK!" --disable-gpu --disable-software-rasterizer --start-fullscreen --no-first-run --no-default-browser-check --window-size=1440,900
exit /b 0

:fehlt
echo index.html, szenario.js, karte-modul.js oder akten-modul.js fehlt neben dieser Datei.
pause
exit /b 1

:kein_edge
echo Microsoft Edge wurde nicht gefunden.
pause
exit /b 1
