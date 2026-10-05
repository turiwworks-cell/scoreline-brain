@echo off
setlocal
title Scoreline
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-Scoreline.ps1" %*
set "SCORELINE_EXIT=%ERRORLEVEL%"
if not "%SCORELINE_EXIT%"=="0" (
  echo.
  echo Scoreline could not start. Read the message above.
  if not defined SCORELINE_NO_PAUSE pause
)
exit /b %SCORELINE_EXIT%
