@echo off
REM Build script for Abious C++ Backend
REM This script sets up and builds the C++ backend with MongoDB

echo ========================================
echo Building Abious C++ Backend
echo ========================================

REM Check for prerequisites
where cmake >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake is not installed. Please install CMake first.
    exit /b 1
)

REM Check if MongoDB is installed
where mongod >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Warning: MongoDB is not in PATH. Make sure MongoDB is installed.
    echo You can download from: https://www.mongodb.com/try/download/community
)

REM Create build directory
if not exist build mkdir build

cd build

REM Configure with CMake
echo.
echo Running CMake configuration...
cmake .. -G "Ninja" -DCMAKE_BUILD_TYPE=Release

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake configuration failed!
    exit /b 1
)

REM Build
echo.
echo Building project...
cmake --build . --config Release

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo To run the server:
echo   cd build
echo   server.exe ..
echo.
echo Or set MongoDB URI and run:
echo   set MONGODB_URI=mongodb://localhost:27017
echo   server.exe ..
echo.

pause
