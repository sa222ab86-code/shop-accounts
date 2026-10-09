@echo off
chcp 65001 > nul
title Fix desktop icon cache
color 0B
echo ===================================================================
echo   Refresh the Windows icon cache [fixes an old icon on the desktop]
echo ===================================================================
echo.
echo Before running this file:
echo   1. Uninstall the old app from Settings - Apps.
echo   2. Delete the old shortcut from the desktop.
echo.
echo The screen will flicker for a few seconds. Press any key to continue...
pause > nul
ie4uinit.exe -show >nul 2>&1
taskkill /F /IM explorer.exe >nul 2>&1
del /a /f /q "%LOCALAPPDATA%\IconCache.db" >nul 2>&1
del /a /f /q "%LOCALAPPDATA%\Microsoft\Windows\Explorer\iconcache*" >nul 2>&1
del /a /f /q "%LOCALAPPDATA%\Microsoft\Windows\Explorer\thumbcache*" >nul 2>&1
start explorer.exe
echo.
echo Done. Now install the new Setup file again and look at the icon.
echo If it is still old, restart the computer once.
echo.
pause
