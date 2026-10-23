@echo off
setlocal
cd /d "%~dp0"

echo =======================================================
echo          Subtitle Sync - 1-Click Builder
echo =======================================================
echo.

echo [1/4] Checking and installing required packages...
python -m pip install --upgrade customtkinter ffsubsync pyinstaller pillow
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
echo [4/4] Cleaning temporary build files...
if exist "build" rmdir /s /q "build"
if exist "SubtitleSync.spec" del /q "SubtitleSync.spec"

echo Updating double-click shortcut 'Subtitle Sync.lnk'...
powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $s = $WshShell.CreateShortcut('%~dp0Subtitle Sync.lnk'); $s.TargetPath = '%~dp0dist\SubtitleSync.exe'; $s.WorkingDirectory = '%~dp0dist'; $s.IconLocation = '%~dp0app_icon.ico, 0'; $s.Save()"

echo.
echo =======================================================
echo [SUCCESS] Build completed successfully!
echo Executable: dist\SubtitleSync.exe
echo Shortcut:   Subtitle Sync.lnk
echo =======================================================
echo.
pause
