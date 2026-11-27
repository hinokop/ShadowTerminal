@echo off
rem Shadow Terminal - explizite Geospatial-V2-Testansicht
rem Verwendet denselben lokalen Profilordner wie START_3D.bat.
setlocal
set "SHADOW_TERMINAL_FRAGMENT=?geospatial-v2=1"
call "%~dp0START_3D.bat"
exit /b %errorlevel%
