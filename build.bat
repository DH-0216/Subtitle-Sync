@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo =======================================================
echo          Subtitle Sync Studio - All-in-One Builder
echo =======================================================
echo.

set "APP_VERSION="
for /f "usebackq tokens=*" %%v in (`python -c "import re; m = re.search(r'APP_VERSION\s*=\s*[\x22\x27]([^\x22\x27]+)', open('src/constants.py', encoding='utf-8').read()); print(m.group(1))" 2^>nul`) do set "APP_VERSION=%%v"
if not defined APP_VERSION set "APP_VERSION=1.2.1"
echo Detected Version: v!APP_VERSION!
echo.

if not exist "bin" mkdir "bin"

:: ---------------------------------------------------------------------------
:: STEP 1: Verify & install Python dependencies
:: ---------------------------------------------------------------------------
echo [1/7] Checking required Python packages...
python -m pip install customtkinter ffsubsync pyinstaller pillow auditok --no-warn-script-location
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install required Python packages.
    echo Please make sure Python and pip are installed and added to PATH.
    if "%1"=="" pause
    exit /b %errorlevel%
)

:: ---------------------------------------------------------------------------
:: STEP 2: App Icon Verification
:: ---------------------------------------------------------------------------
echo.
echo [2/7] Verifying application icon...
if not exist "app_icon.ico" (
    echo Generating app_icon.ico...
    python create_icon.py
)

:: ---------------------------------------------------------------------------
:: STEP 3: Ensure bin\ffmpeg.exe
:: ---------------------------------------------------------------------------
echo.
echo [3/7] Checking bin\ffmpeg.exe...
if exist "bin\ffmpeg.exe" (
    echo [INFO] bin\ffmpeg.exe is already present!
) else (
    echo [INFO] bin\ffmpeg.exe not found in workspace. Searching local system...
    for /f "delims=" %%F in ('where.exe ffmpeg.exe 2^>nul') do (
        copy /y "%%F" "bin\ffmpeg.exe" >nul
        echo [SUCCESS] Auto-copied ffmpeg.exe from: %%F
    )
)

if not exist "bin\ffmpeg.exe" (
    echo [INFO] Local FFmpeg not found on system PATH.
    echo Downloading official FFmpeg build from gyan.dev...
    powershell -NoProfile -Command ^
        "$ProgressPreference = 'SilentlyContinue';" ^
        "$url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';" ^
        "$zip = '%~dp0bin\ffmpeg_temp.zip';" ^
        "$extDir = '%~dp0bin\temp_extract';" ^
        "try {" ^
        "    Write-Host 'Connecting to gyan.dev...';" ^
        "    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
        "    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing;" ^
        "    Write-Host 'Extracting ffmpeg.exe...';" ^
        "    Expand-Archive -Path $zip -DestinationPath $extDir -Force;" ^
        "    $ff = Get-ChildItem -Path $extDir -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1;" ^
        "    if ($ff) {" ^
        "        Copy-Item -Path $ff.FullName -Destination '%~dp0bin\ffmpeg.exe' -Force;" ^
        "        Write-Host '[SUCCESS] ffmpeg.exe successfully placed in bin\ folder.';" ^
        "    } else {" ^
        "        Write-Host '[ERROR] ffmpeg.exe not found in archive.';" ^
        "    }" ^
        "} catch {" ^
        "    Write-Host ('[ERROR] Download failed: ' + $_.Exception.Message);" ^
        "} finally {" ^
        "    if (Test-Path $extDir) { Remove-Item -Path $extDir -Recurse -Force -ErrorAction SilentlyContinue }" ^
        "    if (Test-Path $zip) { Remove-Item -Path $zip -Force -ErrorAction SilentlyContinue }" ^
        "}"
)

if exist "bin\ffmpeg.exe" (
    echo [SUCCESS] bin\ffmpeg.exe is ready!
) else (
    echo [WARNING] bin\ffmpeg.exe could not be acquired automatically.
)

:: ---------------------------------------------------------------------------
:: STEP 4: Ensure bin\ffsubsync.exe
:: ---------------------------------------------------------------------------
echo.
echo [4/7] Checking bin\ffsubsync.exe...
if exist "bin\ffsubsync.exe" (
    echo [INFO] bin\ffsubsync.exe is already present!
) else (
    echo [INFO] bin\ffsubsync.exe not found. Compiling standalone binary on the fly...
    if not exist "pyinstaller_hooks" mkdir "pyinstaller_hooks"
    (
        echo from PyInstaller.utils.hooks import copy_metadata
        echo try:
        echo     datas = copy_metadata('webrtcvad'^)
        echo except Exception:
        echo     datas = copy_metadata('webrtcvad-wheels'^)
    ) > "pyinstaller_hooks\hook-webrtcvad.py"

    (
        echo import sys
        echo from ffsubsync import main
        echo if __name__ == '__main__':
        echo     sys.exit(main(^)^)
    ) > "build_entry_ffsubsync.py"

    pyinstaller --onefile --clean --name ffsubsync --additional-hooks-dir pyinstaller_hooks --collect-all ffsubsync --collect-all auditok build_entry_ffsubsync.py >nul 2>&1

    if exist "dist\ffsubsync.exe" (
        copy /y "dist\ffsubsync.exe" "bin\ffsubsync.exe" >nul
        echo [SUCCESS] bin\ffsubsync.exe compiled successfully!
    ) else (
        echo [ERROR] Failed to compile bin\ffsubsync.exe automatically.
    )

    if exist "build" rmdir /s /q "build"
    if exist "dist\ffsubsync.exe" del /q "dist\ffsubsync.exe"
    if exist "build_entry_ffsubsync.py" del /q "build_entry_ffsubsync.py"
    if exist "ffsubsync.spec" del /q "ffsubsync.spec"
    if exist "pyinstaller_hooks" rmdir /s /q "pyinstaller_hooks"
)

if exist "bin\ffsubsync.exe" (
    echo [SUCCESS] bin\ffsubsync.exe is ready!
)

:: If user only passed flag --binaries, stop here
if "%1"=="--binaries" (
    echo.
    echo [SUCCESS] All engine binaries verified and ready in bin\ folder!
    exit /b 0
)

:: ---------------------------------------------------------------------------
:: STEP 5: Packaging SubtitleSync.exe with PyInstaller
:: ---------------------------------------------------------------------------
echo.
echo [5/7] Packaging SubtitleSync.exe with PyInstaller...
pyinstaller --noconsole --onefile --clean --name "SubtitleSync" --icon "app_icon.ico" --add-data "app_icon.ico;." --add-binary "bin\ffsubsync.exe;bin" --collect-all customtkinter --collect-all certifi subsync_modern.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] PyInstaller build failed.
    if "%1"=="" pause
    exit /b %errorlevel%
)

:: Cleaning temporary build files
if exist "build" rmdir /s /q "build"
if exist "SubtitleSync.spec" del /q "SubtitleSync.spec"

echo Generating portable version: dist\SubtitleSync-Portable.exe...
copy /y "dist\SubtitleSync.exe" "dist\SubtitleSync-Portable.exe" >nul

:: ---------------------------------------------------------------------------
:: STEP 6: Updating Shortcut
:: ---------------------------------------------------------------------------
echo.
echo [6/7] Updating double-click shortcut 'Subtitle Sync.lnk'...
powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $s = $WshShell.CreateShortcut('%~dp0Subtitle Sync.lnk'); $s.TargetPath = '%~dp0dist\SubtitleSync-Portable.exe'; $s.WorkingDirectory = '%~dp0dist'; $s.IconLocation = '%~dp0app_icon.ico, 0'; $s.Save()"

:: ---------------------------------------------------------------------------
:: STEP 7: Building Windows Setup Installer with Inno Setup
:: ---------------------------------------------------------------------------
echo.
echo [7/7] Checking for Inno Setup compiler...
set "ISCC_PATH="
if exist "C:\Program Files\Inno Setup 7\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 7\ISCC.exe"
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"

if "!ISCC_PATH!"=="" (
    echo [INFO] Inno Setup compiler not found. Skipped Setup.exe creation.
    goto :step_finish
)

if not exist "bin\ffmpeg.exe" (
    echo [INFO] Skipped installer creation - ffmpeg.exe not present in bin folder.
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
if "%1"=="" pause
