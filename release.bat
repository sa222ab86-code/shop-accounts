@echo off
cd /d "%~dp0"
chcp 65001 > nul
title Shop Accounts - Publish release to GitHub
color 0B

net session >nul 2>&1
if %errorlevel% equ 0 goto is_admin
echo Requesting administrator permission, please click Yes...
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:is_admin
cls
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set CSC_IDENTITY_AUTO_DISCOVERY=false

echo ===================================================================
echo   Shop Accounts - build and upload a new release to GitHub
echo ===================================================================
echo.
node -v >nul 2>&1
if %errorlevel% equ 0 goto node_ok
color 0C
echo [ERROR] Node.js was not found. Install it from https://nodejs.org then run again.
pause
exit /b

:node_ok
for /f %%v in ('node -p "require('./package.json').version"') do set VER=%%v
echo Version in package.json: %VER%
echo This number must be HIGHER than the version installed on the device,
echo otherwise the update will not appear. Edit "version" in package.json if needed.
echo.

if defined GH_TOKEN goto have_token
echo Paste your GitHub token then press Enter.
echo The token is used only inside this window and is NOT saved on disk.
echo.
set /p GH_TOKEN=Token: 
if not defined GH_TOKEN (
  echo No token entered.
  pause
  exit /b
)

:have_token
echo.
echo [1/3] Cleaning old files...
taskkill /F /IM ShopAccounts.exe >nul 2>&1
if exist dist rmdir /s /q dist
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"

echo [2/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 call npm install --registry=https://registry.npmmirror.com

echo [3/3] Building and uploading to GitHub...
call npm run release
if %errorlevel% equ 0 goto success

echo.
echo [WARNING] Failed, retrying without download mirrors...
set ELECTRON_MIRROR=
set ELECTRON_BUILDER_BINARIES_MIRROR=
call npm run release
if %errorlevel% equ 0 goto success

color 0C
echo.
echo ===================================================================
echo [ERROR] Release failed. Common reasons:
echo ===================================================================
echo 1. Token wrong, expired, or without the "repo" permission [401 or 403].
echo 2. Repository name or owner in package.json does not match GitHub.
echo 3. A release with the same version already exists on GitHub: raise the
echo    version number in package.json and run again.
echo 4. Slow internet or antivirus blocking the builder.
echo.
pause
exit /b

:success
cls
color 0A
echo ===================================================================
echo [SUCCESS] Release %VER% was uploaded to GitHub as a DRAFT.
echo ===================================================================
echo.
echo Last step: open the page that will open now, find the draft
echo "v%VER%", press Edit, then press "Publish release".
echo.
echo Press any key to open the releases page...
pause > nul
start https://github.com/sa222ab86-code/shop-accounts/releases
exit /b
