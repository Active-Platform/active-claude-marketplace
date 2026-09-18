@echo off
rem Windows shim: bare `bf-doc` resolves here (SessionStart adds tools/ to PATH) and runs the portable DLL.
dotnet "%~dp0bf-doc.dll" %*
