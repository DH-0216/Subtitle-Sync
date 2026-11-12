@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: ---------------------------------------------------------------------------
:: Auto-Elevation: Automatically request Administrator privileges if not elevated
:: ---------------------------------------------------------------------------
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator privileges to build and package...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/k \""""%~f0"""" %*' -Verb RunAs"
    exit /b
)

echo =======================================================
echo     Subtitle Sync Studio - Electron Edition Builder
echo =======================================================
echo.

:: ---------------------------------------------------------------------------
:: STEP 1: Version & Environment Verification
:: ---------------------------------------------------------------------------
echo [1/6] Verifying Node.js environment...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed or not found on PATH.
    echo Please install Node.js v18 or higher from https://nodejs.org/
    if "%1"=="" pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm is not found on PATH.
    echo Please ensure npm is installed and added to PATH.
    if "%1"=="" pause
    exit /b 1
)

set "APP_VERSION="
for /f %%v in ('node -e "console.log(require('./package.json').version)" 2^>nul') do set "APP_VERSION=%%v"
if not defined APP_VERSION set "APP_VERSION=2.0.0"
echo [INFO] Detected Version: v!APP_VERSION!
echo.

:: ---------------------------------------------------------------------------
:: STEP 2: Project Dependencies
:: ---------------------------------------------------------------------------
echo [2/6] Checking project dependencies...
if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] npm install failed.
        if "%1"=="" pause
        exit /b %errorlevel%
    )
) else (
    echo [INFO] Project dependencies are installed.
)
echo.

:: ---------------------------------------------------------------------------
:: STEP 3: Ensure bin\ Directory and Engine Binaries
:: ---------------------------------------------------------------------------
echo [3/6] Checking engine binaries in bin\...
if not exist "bin" mkdir "bin"

:: 3.1 FFmpeg Check / Auto-acquisition
if exist "bin\ffmpeg.exe" (
    echo [INFO] bin\ffmpeg.exe is ready!
    goto :check_ffsubsync
)

echo [INFO] bin\ffmpeg.exe not found in workspace. Checking system PATH...
for /f "delims=" %%F in ('where.exe ffmpeg.exe 2^>nul') do (
    copy /y "%%F" "bin\ffmpeg.exe" >nul
    echo [SUCCESS] Auto-copied ffmpeg.exe from: %%F
)

if exist "bin\ffmpeg.exe" goto :check_ffsubsync

echo [INFO] Local FFmpeg not found on system PATH.
echo Downloading official FFmpeg build from gyan.dev...
powershell -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; $url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'; $zip = '%~dp0bin\ffmpeg_temp.zip'; $extDir = '%~dp0bin\temp_extract'; try { Write-Host 'Connecting to gyan.dev...'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing; Write-Host 'Extracting ffmpeg.exe...'; Expand-Archive -Path $zip -DestinationPath $extDir -Force; $ff = Get-ChildItem -Path $extDir -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1; if ($ff) { Copy-Item -Path $ff.FullName -Destination '%~dp0bin\ffmpeg.exe' -Force; Write-Host '[SUCCESS] ffmpeg.exe placed in bin\ folder.'; } else { Write-Host '[ERROR] ffmpeg.exe not found in archive.'; } } catch { Write-Host ('[ERROR] Download failed: ' + $_.Exception.Message); } finally { if (Test-Path $extDir) { Remove-Item -Path $extDir -Recurse -Force -ErrorAction SilentlyContinue }; if (Test-Path $zip) { Remove-Item -Path $zip -Force -ErrorAction SilentlyContinue }; }"

if not exist "bin\ffmpeg.exe" (
    echo [WARNING] bin\ffmpeg.exe is missing. Audio extraction might fail at runtime.
)

:check_ffsubsync
:: 3.2 FFSubSync Check / Auto-compilation
if exist "bin\ffsubsync.exe" (
    for %%A in ("bin\ffsubsync.exe") do (
        if %%~zA GTR 5000000 (
            echo [INFO] bin\ffsubsync.exe is ready!
            goto :binaries_done
        ) else (
            echo [WARNING] Found pip stub in bin\ffsubsync.exe (%%~zA bytes). Rebuilding standalone binary...
            del /q "bin\ffsubsync.exe"
        )
    )
)

echo [INFO] bin\ffsubsync.exe not found. Checking Python environment to build standalone binary...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Python is not found on PATH. Cannot automatically compile ffsubsync.exe.
    echo Please install Python with ffsubsync or place the standalone ffsubsync.exe (~43 MB) into bin\
    goto :binaries_done
)

echo [INFO] Compiling standalone ffsubsync.exe with PyInstaller...
python -m pip install ffsubsync pyinstaller auditok webrtcvad-wheels --quiet --no-warn-script-location

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
    echo [SUCCESS] bin\ffsubsync.exe (standalone) compiled successfully!
) else (
    echo [ERROR] Failed to compile bin\ffsubsync.exe.
)

:: Clean up temporary build files
if exist "build" rmdir /s /q "build"
if exist "dist\ffsubsync.exe" del /q "dist\ffsubsync.exe"
if exist "build_entry_ffsubsync.py" del /q "build_entry_ffsubsync.py"
if exist "ffsubsync.spec" del /q "ffsubsync.spec"
if exist "pyinstaller_hooks" rmdir /s /q "pyinstaller_hooks"

if not exist "bin\ffsubsync.exe" (
    echo [WARNING] bin\ffsubsync.exe is missing. Synchronization engine requires bin\ffsubsync.exe.
)

:binaries_done
:: If user passed flag --binaries, stop here
if "%1"=="--binaries" (
    echo.
    echo [SUCCESS] Engine binaries checked in bin\ folder!
    exit /b 0
)
echo.

:: ---------------------------------------------------------------------------
:: STEP 4: Build Application Bundles (Vite + Electron)
:: ---------------------------------------------------------------------------
echo [4/6] Building application (Vite + React + Electron)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application build failed.
    if "%1"=="" pause
    exit /b %errorlevel%
)
echo [SUCCESS] Build output generated in out\ directory.
echo.

:: ---------------------------------------------------------------------------
:: STEP 5: Package Executables with Electron Builder
:: ---------------------------------------------------------------------------
echo [5/6] Packaging desktop application with Electron Builder...

if "%1"=="--dir" (
    echo Target: Unpacked Directory - Fast Mode
    call npx electron-builder --win --dir
) else if "%1"=="--portable" (
    echo Target: Portable Executable only
    call npx electron-builder --win portable
) else if "%1"=="--installer" (
    echo Target: NSIS Setup Installer only
    call npx electron-builder --win nsis
) else (
    echo Target: Windows Setup Installer + Portable Executable
    call npx electron-builder --win
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Electron Builder packaging failed.
    if "%1"=="" pause
    exit /b %errorlevel%
)

:: Clean up any leftover versioned files so only the 2 primary executables remain
if exist "dist\SubtitleSync-Portable-*.exe" del /q "dist\SubtitleSync-Portable-*.exe" >nul 2>&1
if exist "dist\SubtitleSync-Setup-*.exe" del /q "dist\SubtitleSync-Setup-*.exe" >nul 2>&1
if exist "dist\SubtitleSync-Setup-*.blockmap" del /q "dist\SubtitleSync-Setup-*.blockmap" >nul 2>&1
echo.

:: ---------------------------------------------------------------------------
:: STEP 6: Update Double-Click Windows Shortcut
:: ---------------------------------------------------------------------------
echo [6/6] Updating desktop shortcut 'Subtitle Sync.lnk'...

set "SHORTCUT_TARGET="
if exist "dist\SubtitleSync-Portable.exe" (
    set "SHORTCUT_TARGET=%~dp0dist\SubtitleSync-Portable.exe"
) else if exist "dist\win-unpacked\Subtitle Sync Studio.exe" (
    set "SHORTCUT_TARGET=%~dp0dist\win-unpacked\Subtitle Sync Studio.exe"
)

if defined SHORTCUT_TARGET (
    powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $s = $WshShell.CreateShortcut('%~dp0Subtitle Sync.lnk'); $s.TargetPath = '!SHORTCUT_TARGET!'; $s.WorkingDirectory = '%~dp0dist'; $s.IconLocation = '%~dp0app_icon.ico, 0'; $s.Save()"
    echo [SUCCESS] Shortcut updated: Subtitle Sync.lnk
) else (
    echo [INFO] Shortcut target not found in dist. Skipping shortcut creation.
)

echo.
echo =======================================================
echo [SUCCESS] Build process completed successfully!
if exist "dist\SubtitleSync-Portable.exe" (
    echo Portable:  dist\SubtitleSync-Portable.exe
)
if exist "dist\SubtitleSync-Setup.exe" (
    echo Installer: dist\SubtitleSync-Setup.exe
)
if exist "dist\win-unpacked\Subtitle Sync Studio.exe" (
    echo Unpacked:  dist\win-unpacked\Subtitle Sync Studio.exe
)
if exist "Subtitle Sync.lnk" (
    echo Shortcut:  Subtitle Sync.lnk
)
echo =======================================================
echo.
if "%1"=="" pause
