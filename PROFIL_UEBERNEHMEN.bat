@echo off
rem ============================================================
rem  Field Terminal - PROFIL UEBERNEHMEN
rem  Kopiert den Ordner "profil" (neben dieser Datei) in das lokale
rem  Profil unter %LocalAppData%\FieldTerminal\profil. Ein dort
rem  vorhandenes lokales Profil wird NICHT geloescht, sondern in
rem  "profil_vorher_..." umbenannt. Danach START_LOKAL.bat starten.
rem  Vorher alle Field-Terminal-Fenster schliessen.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
if not exist "%~dp0profil\" (
  echo Kein Ordner "profil" neben dieser Datei gefunden.
  pause
  exit /b 1
)
set "BASIS=%LocalAppData%\FieldTerminal"
set "LOK=!BASIS!\profil"
if not exist "!BASIS!" mkdir "!BASIS!"
if exist "!LOK!" (
  set "ALT=profil_vorher_%DATE:~-4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
  set "ALT=!ALT: =0!"
  move "!LOK!" "!BASIS!\!ALT!" >nul
  if errorlevel 1 (
    echo Das lokale Profil ist in Benutzung. Bitte alle Field-Terminal-Fenster schliessen und erneut starten.
    pause
    exit /b 1
  )
  echo Vorhandenes lokales Profil gesichert als !ALT!
)
echo Kopiere Profil, bitte warten ...
robocopy "%~dp0profil" "!LOK!" /E /R:1 /W:1 /NFL /NDL /NJH /NP /XF Singleton* lockfile /XD Crashpad "Code Cache" GPUCache ShaderCache GrShaderCache
if errorlevel 8 (
  echo Beim Kopieren sind Fehler aufgetreten.
  pause
  exit /b 1
)
echo.
echo Fertig. Jetzt START_LOKAL.bat starten.
pause
exit /b 0
