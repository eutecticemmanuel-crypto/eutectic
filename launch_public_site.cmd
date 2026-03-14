@echo off
setlocal
cd /d "%~dp0"

set "RUNTIME_DIR=%~dp0.runtime"
set "NPM_CACHE=%~dp0.npm-cache"
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
if not exist "%NPM_CACHE%" mkdir "%NPM_CACHE%"

echo Starting backend and tunnel in background...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$wd = '%~dp0';" ^
  "$rt = Join-Path $wd '.runtime';" ^
  "$backendOut = Join-Path $rt 'backend.log';" ^
  "$backendErr = Join-Path $rt 'backend.err.log';" ^
  "$tunnelOut = Join-Path $rt 'tunnel.log';" ^
  "$tunnelErr = Join-Path $rt 'tunnel.err.log';" ^
  "$backend = Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory $wd -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -PassThru;" ^
  "Set-Content -Path (Join-Path $rt 'backend.pid') -Value $backend.Id;" ^
  "$env:npm_config_cache = Join-Path $wd '.npm-cache';" ^
  "$env:npm_config_update_notifier = 'false';" ^
  "$tunnel = Start-Process -FilePath 'npx.cmd' -ArgumentList '--yes','localtunnel','--port','3000' -WorkingDirectory $wd -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru;" ^
  "Set-Content -Path (Join-Path $rt 'tunnel.pid') -Value $tunnel.Id;"

echo Done.
echo.
echo Backend log: %RUNTIME_DIR%\backend.log
echo Tunnel log : %RUNTIME_DIR%\tunnel.log
echo.
echo Open tunnel log after 5-10 seconds and copy URL like:
echo https://xxxx.loca.lt
echo.
echo Quick command to view tunnel log:
echo powershell -NoProfile -Command "Get-Content '%RUNTIME_DIR%\tunnel.log' -Wait"
endlocal
