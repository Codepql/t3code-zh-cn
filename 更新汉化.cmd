@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" restore
if errorlevel 1 goto end
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" apply
:end
pause
