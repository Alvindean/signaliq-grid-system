@echo off
title SONIQ Deploy Tool
color 0A

echo.
echo  ==========================================
echo   SONIQ — One-Click Deploy to Vercel
echo  ==========================================
echo.

:: Check if git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Git is not installed.
    echo.
    echo  Install it from: https://git-scm.com/download/win
    echo  Make sure to check "Add Git to PATH" during install.
    echo.
    pause
    exit
)

:: Check if soniq_v12.html exists in Downloads
if not exist "%USERPROFILE%\Downloads\soniq_v12.html" (
    echo  ERROR: soniq_v12.html not found in Downloads folder.
    echo.
    echo  Download it from Claude and put it in:
    echo  %USERPROFILE%\Downloads\
    echo.
    pause
    exit
)

:: Set up repo folder
set REPO_DIR=%USERPROFILE%\Documents\soniq-repo

:: Clone repo if it doesn't exist yet
if not exist "%REPO_DIR%" (
    echo  First time setup — cloning your GitHub repo...
    echo.
    set /p GITHUB_URL="Paste your GitHub repo URL (e.g. https://github.com/Alvindean/soniq): "
    git clone %GITHUB_URL% "%REPO_DIR%"
    if %errorlevel% neq 0 (
        echo.
        echo  Clone failed. Check your GitHub URL and try again.
        pause
        exit
    )
    echo  ✓ Repo cloned to %REPO_DIR%
)

:: Copy latest index.html
echo  Copying latest soniq_v12.html to repo...
copy /Y "%USERPROFILE%\Downloads\soniq_v12.html" "%REPO_DIR%\public\index.html" >nul
echo  ✓ File copied

:: Git push
cd /d "%REPO_DIR%"
git add public/index.html
git commit -m "Update SONIQ app - %date% %time%"
git push

if %errorlevel% neq 0 (
    echo.
    echo  Push failed. You may need to log in to GitHub.
    echo  Run this command in the repo folder:
    echo  git config --global credential.helper manager
    echo.
    pause
    exit
)

echo.
echo  ==========================================
echo   ✓ DEPLOYED SUCCESSFULLY
echo  ==========================================
echo.
echo  Vercel is building your update now.
echo  It will be live in about 30 seconds.
echo.
echo  Opening your site...
start https://project-47rl2.vercel.app
echo.
pause
