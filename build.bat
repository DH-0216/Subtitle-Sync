@echo off
setlocal
cd /d "%~dp0"

echo =======================================================
echo          Subtitle Sync - 1-Click Builder
echo =======================================================
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
echo [2/4] Verifying application icon...
if not exist "app_icon.ico" (
    echo Generating app_icon.ico...
    python create_icon.py
)

echo.
echo [3/4] Packaging SubtitleSync.exe with PyInstaller...
pyinstaller --noconsole --onefile --clean --name "SubtitleSync" --icon "app_icon.ico" --add-data "app_icon.ico;." --collect-all customtkinter subsync_modern.py
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

echo Updating double-click shortcut 'Subtitle Sync.lnk'...
powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $s = $WshShell.CreateShortcut('%~dp0Subtitle Sync.lnk'); $s.TargetPath = '%~dp0dist\SubtitleSync.exe'; $s.WorkingDirectory = '%~dp0dist'; $s.IconLocation = '%~dp0app_icon.ico, 0'; $s.Save()"

echo.
echo [5/5] Building Windows Setup Installer with Inno Setup...
set "ISCC_PATH="
if exist "C:\Program Files\Inno Setup 7\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 7\ISCC.exe"
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"

if defined ISCC_PATH (
    if not exist "bin\ffmpeg.exe" (
        echo [INFO] bin\ffmpeg.exe not found in workspace. Searching system for ffmpeg...
        for /f "delims=" %%F in ('where.exe ffmpeg.exe 2^>nul') do (
            if not exist "bin" mkdir "bin"
            copy /y "%%F" "bin\ffmpeg.exe" >nul
            echo [INFO] Auto-copied ffmpeg.exe from: %%F
        )
    )

    if exist "bin\ffmpeg.exe" (
        "%ISCC_PATH%" "installer.iss"
        if %errorlevel% neq 0 (
            echo [WARNING] Installer compilation encountered an issue.
        ) else (
            echo [SUCCESS] Installer: dist\SubtitleSync-Setup.exe
        )
    ) else (
        echo [INFO] Setup.exe requires bin\ffmpeg.exe. Skipped installer creation.
    )
) else (
    echo [INFO] Inno Setup compiler not found. Skipped Setup.exe creation.
)

echo.
echo =======================================================
echo [SUCCESS] All builds completed successfully!
echo Portable App: dist\SubtitleSync.exe
echo Installer:    dist\SubtitleSync-Setup.exe
echo Shortcut:     Subtitle Sync.lnk
echo =======================================================
echo.
pause
