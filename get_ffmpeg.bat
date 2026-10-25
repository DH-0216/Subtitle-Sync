@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo =======================================================
echo          Subtitle Sync - FFmpeg Setup Helper
echo =======================================================
echo.

if not exist "bin" mkdir "bin"

if exist "bin\ffmpeg.exe" (
    echo [INFO] bin\ffmpeg.exe is already present!
    echo [INFO] Nothing to download.
    goto :done
)

echo [1/3] Searching local system for existing FFmpeg...
for /f "delims=" %%F in ('where.exe ffmpeg.exe 2^>nul') do (
    copy /y "%%F" "bin\ffmpeg.exe" >nul
    echo [SUCCESS] Found FFmpeg on your system: %%F
    echo [SUCCESS] Copied to bin\ffmpeg.exe (0 MB downloaded).
    goto :done
)

echo [INFO] Local FFmpeg not found on system PATH.
echo [2/3] Downloading official FFmpeg build from gyan.dev...

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

if exist "bin\ffmpeg.exe" (
    echo.
    echo [3/3] Verification: bin\ffmpeg.exe is ready!
) else (
    echo.
    echo [!] Could not download FFmpeg automatically.
    echo     Offline Alternative: Place your own ffmpeg.exe into the 'bin\' folder,
    echo     or run 'winget install Gyan.FFmpeg' in PowerShell.
)

:done
echo.
echo =======================================================
if "%1"=="" pause
