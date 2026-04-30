@echo off
echo.
echo  SONIQ - Starting...
echo.

cd /d "%USERPROFILE%\Downloads"

:: Try Python 3 first
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Found Python - starting server...
    echo  Open Chrome: http://localhost:8080/soniq_v12.html
    echo.
    python -m http.server 8080
    goto end
)

:: Try py launcher
py --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Found Python - starting server...
    echo  Open Chrome: http://localhost:8080/soniq_v12.html
    echo.
    py -m http.server 8080
    goto end
)

:: Try Python3 explicitly
python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Found Python3 - starting server...
    echo  Open Chrome: http://localhost:8080/soniq_v12.html
    echo.
    python3 -m http.server 8080
    goto end
)

:: No Python found
echo  ==========================================
echo  Python not found on your computer.
echo  ==========================================
echo.
echo  Install it in 2 minutes:
echo  1. Open Microsoft Store
echo  2. Search: Python
echo  3. Install Python 3.12 (free)
echo  4. Come back and double-click this file again
echo.
echo  OR go to: https://www.python.org/downloads/
echo.

:end
pause
