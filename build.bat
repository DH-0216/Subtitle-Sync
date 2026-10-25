@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo =======================================================
echo          Subtitle Sync - 1-Click Builder
echo =======================================================
echo.

set "APP_VERSION="
for /f "usebackq tokens=*" %%v in (`python -c "import re; m = re.search(r'APP_VERSION\s*=\s*[\x22\x27]([^\x22\x27]+)', open('src/constants.py', encoding='utf-8').read()); print(m.group(1))" 2^>nul`) do set "APP_VERSION=%%v"
if not defined APP_VERSION set "APP_VERSION=1.2.0"
echo Detected Version: v!APP_VERSION!
echo.

echo [1/5] Checking required packages...
python -m pip install customtkinter ffsubsync pyinstaller pillow --no-warn-script-location
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install required packages.
    echo Please make sure Python and pip are installed and added to PATH.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/5] Verifying application icon...
if not exist "app_icon.ico" (
    echo Generating app_icon.ico...
    python create_icon.py
)

echo.
echo [3/5] Packaging SubtitleSync.exe with PyInstaller...
pyinstaller --noconsole --onefile --clean --name "SubtitleSync" --icon "app_icon.ico" --add-data "app_icon.ico;." --collect-all customtkinter --collect-all certifi subsync_modern.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] PyInstaller build failed.
    pause
    exit /b %errorlevel%
)

echo.
echo [4/5] Cleaning temporary build files...
if exist "build" rmdir /s /q "build"
if exist "SubtitleSync.spec" del /q "SubtitleSync.spec"

echo Generating portable version: dist\SubtitleSync-Portable.exe...
copy /y "dist\SubtitleSync.exe" "dist\SubtitleSync-Portable.exe" >nul

echo Updating double-click shortcut 'Subtitle Sync.lnk'...
powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $s = $WshShell.CreateShortcut('%~dp0Subtitle Sync.lnk'); $s.TargetPath = '%~dp0dist\SubtitleSync-Portable.exe'; $s.WorkingDirectory = '%~dp0dist'; $s.IconLocation = '%~dp0app_icon.ico, 0'; $s.Save()"

echo.
echo [5/5] Building Windows Setup Installer with Inno Setup...
set "ISCC_PATH="
if exist "C:\Program Files\Inno Setup 7\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 7\ISCC.exe"
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"

if "!ISCC_PATH!"=="" (
    echo [INFO] Inno Setup compiler not found. Skipped Setup.exe creation.
    goto :step_finish
)

if not exist "bin\ffmpeg.exe" (
    echo [INFO] bin\ffmpeg.exe not found in workspace. Searching system for ffmpeg...
    for /f "delims=" %%F in ('where.exe ffmpeg.exe 2^>nul') do (
        if not exist "bin" mkdir "bin"
        copy /y "%%F" "bin\ffmpeg.exe" >nul
        echo [INFO] Auto-copied ffmpeg.exe from: %%F
    )
)

if not exist "bin\ffmpeg.exe" (
    echo.
    echo [WARNING] bin\ffmpeg.exe is missing - required to bundle the offline installer.
    set /p "DL_FFMPEG=    Would you like to download it now via get_ffmpeg.bat? [Y/N]: "
    if /i "!DL_FFMPEG!"=="Y" (
        call "%~dp0get_ffmpeg.bat" --quiet
    )
)

if not exist "bin\ffmpeg.exe" (
    echo [INFO] Skipped installer creation - ffmpeg.exe not present in bin folder.
    echo        To build offline later: place ffmpeg.exe into 'bin\' or run get_ffmpeg.bat.
    goto :step_finish
)

echo Compiling installer with Inno Setup...
"!ISCC_PATH!" "installer.iss"
if %errorlevel% neq 0 (
    echo [WARNING] Installer compilation encountered an issue.
) else (
    echo [SUCCESS] Installer: dist\SubtitleSync-Setup.exe
)

:step_finish
if exist "dist\SubtitleSync.exe" del /q "dist\SubtitleSync.exe"

echo.
echo =======================================================
echo [SUCCESS] Build process completed!
echo Portable App: dist\SubtitleSync-Portable.exe
if exist "dist\SubtitleSync-Setup.exe" (
    echo Installer:    dist\SubtitleSync-Setup.exe
)
echo Shortcut:     Subtitle Sync.lnk
echo =======================================================
echo.
pause
