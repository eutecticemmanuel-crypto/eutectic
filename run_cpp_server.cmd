@echo off
REM Run script for Abious C++ Backend Server

echo ========================================
echo Starting Abious C++ Backend Server
echo ========================================

REM Check if build exists
if not exist "build\server.exe" (
    echo ERROR: Server not built yet!
    echo Run build_cpp_backend.cmd first
    pause
    exit /b 1
)

REM Set MongoDB URI (optional - uses default if not set)
if not defined MONGODB_URI (
    echo Using default MongoDB URI: mongodb://127.0.0.1:27017
)

REM Set port (optional)
if not defined PORT (
    set PORT=3000
)

echo.
echo Server configuration:
echo   Port: %PORT%
echo   MongoDB: %MONGODB_URI%
echo.

REM Run the server from the parent directory
cd build
server.exe ..

pause
