@echo off
setlocal

set "RUNTIME_DIR=%~dp0.runtime"

echo Stopping backend/tunnel from PID files...

for %%F in (backend.pid tunnel.pid) do (
  if exist "%RUNTIME_DIR%\%%F" (
    for /f %%P in ("%RUNTIME_DIR%\%%F") do taskkill /PID %%P /T /F >nul 2>&1
    del /q "%RUNTIME_DIR%\%%F" >nul 2>&1
  )
)

rem Fallback cleanup for older launcher versions
taskkill /FI "WINDOWTITLE eq Abious Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Abious Public Tunnel*" /T /F >nul 2>&1

echo Public site stop command completed.

endlocal
