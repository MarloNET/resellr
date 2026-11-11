@echo off
rem Monthly availability report of resellr for the previous month (CU-277, Technical Specification 2.18):
rem the launcher writes the text file into the log folder.
setlocal
set "MONTH="
for /f "usebackq delims=" %%m in (`powershell.exe -NoProfile -NonInteractive -Command "(Get-Date).AddMonths(-1).ToString('yyyy-MM')"`) do set "MONTH=%%m"
if not defined MONTH exit /b 1
"%~dp0node.exe" "%~dp0app\launcher.mjs" availability-report %MONTH%
exit /b %ERRORLEVEL%
