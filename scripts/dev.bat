@echo off
setlocal

REM Resolve repository root based on the location of this script
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR%"=="" (
  echo [dev.bat] Failed to resolve script directory.
  exit /b 1
)
REM Trim trailing backslash
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "REPO_ROOT=%%~fI"
set "DEV_PS1=%REPO_ROOT%\scripts\dev.ps1"

if not exist "%DEV_PS1%" (
  echo [dev.bat] Could not find "%DEV_PS1%".
  echo Update REPO_ROOT inside dev.bat if you moved the repository.
  pause
  exit /b 1
)

set "PW_CMD="
for /f "delims=" %%i in ('where pwsh 2^>nul') do (
  set "PW_CMD=%%i"
  goto foundshell
)
set "PW_CMD=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

:foundshell
"%PW_CMD%" -NoExit -ExecutionPolicy Bypass -File "%DEV_PS1%" %*
set "EXITCODE=%errorlevel%"
if not "%EXITCODE%"=="0" (
  echo Dev launcher exited with code %EXITCODE%.
  pause
)
exit /b %EXITCODE%
