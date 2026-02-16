@echo off
setlocal
cd /d "%~dp0"

echo [IN.N.O.V8] Step 1/3 - Installing build dependencies...
py -3 -m pip install --upgrade pip
if errorlevel 1 goto :error

py -3 -m pip install -r requirements.txt pyinstaller
if errorlevel 1 goto :error

echo [IN.N.O.V8] Step 2/3 - Building executable with PyInstaller...
py -3 -m PyInstaller --noconfirm --clean installer\INNOV8Assistant2026.spec
if errorlevel 1 goto :error

echo [IN.N.O.V8] Step 3/3 - Build finished.
echo Output: %cd%\dist\INNOV8Assistant2026\INNOV8Assistant2026.exe
exit /b 0

:error
echo [IN.N.O.V8] Build failed.
exit /b 1
