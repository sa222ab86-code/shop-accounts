@echo off
cd /d "%~dp0"
chcp 65001 > nul
title Shop Accounts - Desktop Build Tool
color 0B

:: Administrator rights are needed so electron-builder can create symbolic links (fixes the winCodeSign error)
net session >nul 2>&1
if %errorlevel% equ 0 goto is_admin
echo Requesting administrator permission, please click Yes...
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:is_admin
cls
:: Fast download mirrors (in case GitHub is slow or blocked)
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set CSC_IDENTITY_AUTO_DISCOVERY=false

echo ===================================================================
echo   Shop Accounts - build the Windows desktop app [EXE installer]
echo ===================================================================
echo.
echo This tool will: close the running app, clean old files, install
echo dependencies, and build the installer inside the "dist" folder.
echo.
echo Requirement: Node.js LTS from https://nodejs.org
echo.
echo Press any key to start...
pause > nul

:check_node
cls
echo [1/5] Checking Node.js...
node -v >nul 2>&1
if %errorlevel% equ 0 goto node_ok
color 0C
echo.
echo [ERROR] Node.js was not found.
echo 1. Install Node.js LTS from https://nodejs.org  [keep "Add to PATH" checked]
echo 2. CLOSE this window and run build_desktop.bat again.
echo.
pause
exit /b

:node_ok
echo Node.js version:
node -v
echo.

echo [2/5] Cleaning old build files...
taskkill /F /IM ShopAccounts.exe >nul 2>&1
if exist dist rmdir /s /q dist
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
echo Done.
echo.

echo [3/5] Installing dependencies [first time may take a few minutes]...
call npm install
if %errorlevel% equ 0 goto install_ok
echo.
echo [WARNING] npm install failed, retrying with a mirror registry...
call npm install --registry=https://registry.npmmirror.com
if %errorlevel% equ 0 goto install_ok
color 0C
echo.
echo [ERROR] Could not install dependencies. Check your internet connection and try again.
echo.
pause
exit /b

:install_ok
echo.
echo [4/5] Building the installer...
call npm run dist
if %errorlevel% equ 0 goto success

echo.
echo [WARNING] Build failed, retrying without download mirrors...
set ELECTRON_MIRROR=
set ELECTRON_BUILDER_BINARIES_MIRROR=
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
call npm run dist
if %errorlevel% equ 0 goto success

color 0C
echo.
echo ===================================================================
echo [ERROR] Packaging failed. Common reasons:
echo ===================================================================
echo.
echo 1. The app is still running [Access is denied]: close ShopAccounts from
echo    Task Manager, then run this file again.
echo 2. Antivirus or Windows Defender blocks the builder: pause real-time
echo    protection for a few minutes and try again.
echo 3. Slow or blocked internet: try another network or a VPN.
echo 4. The project is inside a ZIP or a protected folder: extract it to a
echo    normal folder such as Desktop or C:\Projects.
echo 5. package.json contains "signAndEditExecutable": false - remove that line.
echo.
pause
exit /b

:success
cls
color 0A
echo ===================================================================
echo [SUCCESS] The desktop app was built successfully!
echo ===================================================================
echo.
echo [5/5] Installer files:
for %%f in (dist\*.exe) do echo     %%f
echo.
echo Install the file named "ShopAccounts Setup ...exe".
echo A ready-to-run copy without installing is inside dist\win-unpacked
echo.
echo Press any key to open the output folder...
pause > nul
explorer dist
exit /b
