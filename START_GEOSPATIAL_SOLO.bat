@echo off
rem Shadow Terminal - eigenstaendige Geospatial-V2-Testansicht
setlocal
set "SHADOW_TERMINAL_FRAGMENT=?geospatial-v2=solo"
call "%~dp0START_3D.bat"
exit /b %errorlevel%
