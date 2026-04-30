@echo off
echo.
echo  ==========================================
echo   SONIQ - AI Song Creation Studio
echo  ==========================================
echo.
echo  Starting local server...
echo.
echo  When the server starts, open Chrome and go to:
echo.
echo     http://localhost:8080/soniq_v12.html
echo.
echo  Keep this window open while using SONIQ.
echo  Press Ctrl+C to stop.
echo  ==========================================
echo.
cd /d "%USERPROFILE%\Downloads"
python -m http.server 8080
pause
