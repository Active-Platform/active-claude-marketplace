@echo off
rem Windows shim: bare `bf-doc` resolves here (SessionStart adds tools/ to PATH) and runs the portable DLL.
setlocal
set "sub=%~1"
if defined sub if "%sub:~0,2%"=="__" goto hook

where dotnet >nul 2>nul
if errorlevel 1 (
    >&2 echo bf-doc needs the .NET 10 runtime: https://dotnet.microsoft.com/download
    exit /b 1
)
dotnet "%~dp0bf-doc.dll" %*
exit /b %errorlevel%

:hook
rem The plugin's hooks run through this shim. With no usable .NET runtime there is nothing to put on PATH
rem and nothing to auto-approve, so a hook subcommand degrades to silence rather than reporting a launch
rem failure on every Bash command of the session.
dotnet "%~dp0bf-doc.dll" %* 2>nul
exit /b 0
