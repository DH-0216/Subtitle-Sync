# scripts/prepare-binaries.ps1
# Automates acquisition and preparation of runtime engine binaries for Subtitle Sync Studio

$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$binDir = Join-Path $workspaceRoot "bin"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " Preparing Subtitle Sync Studio Engine Binaries       " -ForegroundColor Cyan
Write-Host " Target Directory: $binDir" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

# -----------------------------------------------------------------------------
# 1. FFmpeg
# -----------------------------------------------------------------------------
$ffmpegPath = Join-Path $binDir "ffmpeg.exe"
if (Test-Path $ffmpegPath) {
    Write-Host "[OK] bin\ffmpeg.exe is ready." -ForegroundColor Green
} else {
    Write-Host "[...] bin\ffmpeg.exe not found. Checking system PATH..." -ForegroundColor Yellow
    $systemFfmpeg = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
    if ($systemFfmpeg) {
        Write-Host "[OK] Found ffmpeg in system PATH: $($systemFfmpeg.Source)" -ForegroundColor Green
        Copy-Item -Path $systemFfmpeg.Source -Destination $ffmpegPath -Force
    } else {
        Write-Host "[...] Downloading official FFmpeg build from gyan.dev..." -ForegroundColor Yellow
        $zipPath = Join-Path $binDir "ffmpeg_temp.zip"
        $extractDir = Join-Path $binDir "ffmpeg_temp_extract"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
        
        try {
            Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
            Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
            $foundFfmpeg = Get-ChildItem -Path $extractDir -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1
            if ($foundFfmpeg) {
                Copy-Item -Path $foundFfmpeg.FullName -Destination $ffmpegPath -Force
                Write-Host "[OK] FFmpeg binary extracted to bin\ffmpeg.exe" -ForegroundColor Green
            } else {
                throw "ffmpeg.exe not found in extracted archive."
            }
        } finally {
            if (Test-Path $extractDir) { Remove-Item -Path $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
            if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue }
        }
    }
}

# -----------------------------------------------------------------------------
# 2. FFSubSync Standalone Binary
# -----------------------------------------------------------------------------
$ffsubsyncPath = Join-Path $binDir "ffsubsync.exe"
$needFfsubsync = $true
if (Test-Path $ffsubsyncPath) {
    $size = (Get-Item $ffsubsyncPath).Length
    if ($size -gt 5000000) {
        Write-Host "[OK] bin\ffsubsync.exe is ready ($([math]::Round($size/1MB, 2)) MB)." -ForegroundColor Green
        $needFfsubsync = $false
    } else {
        Write-Host "[!] Found small stub in bin\ffsubsync.exe ($size bytes). Rebuilding..." -ForegroundColor Yellow
        Remove-Item -Path $ffsubsyncPath -Force -ErrorAction SilentlyContinue
    }
}

if ($needFfsubsync) {
    Write-Host "[...] Compiling standalone ffsubsync.exe with PyInstaller..." -ForegroundColor Yellow
    
    python -m pip install --upgrade pip --quiet --no-warn-script-location
    python -m pip install ffsubsync pyinstaller auditok webrtcvad-wheels --quiet --no-warn-script-location
    
    $hooksDir = Join-Path $workspaceRoot "pyinstaller_hooks"
    if (-not (Test-Path $hooksDir)) {
        New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
    }
    
    $hookContent = @"
from PyInstaller.utils.hooks import copy_metadata
try:
    datas = copy_metadata('webrtcvad')
except Exception:
    datas = copy_metadata('webrtcvad-wheels')
"@
    Set-Content -Path (Join-Path $hooksDir "hook-webrtcvad.py") -Value $hookContent -Encoding utf8
    
    $entryContent = @"
import sys
from ffsubsync import main
if __name__ == '__main__':
    sys.exit(main())
"@
    $entryFile = Join-Path $workspaceRoot "build_entry_ffsubsync.py"
    Set-Content -Path $entryFile -Value $entryContent -Encoding utf8
    
    try {
        Push-Location $workspaceRoot
        pyinstaller --onefile --clean --name ffsubsync `
            --additional-hooks-dir pyinstaller_hooks `
            --collect-all ffsubsync `
            --collect-all auditok `
            build_entry_ffsubsync.py
            
        $compiledExe = Join-Path $workspaceRoot "dist\ffsubsync.exe"
        if (Test-Path $compiledExe) {
            Copy-Item -Path $compiledExe -Destination $ffsubsyncPath -Force
            Write-Host "[OK] bin\ffsubsync.exe compiled successfully." -ForegroundColor Green
        } else {
            throw "PyInstaller completed but dist\ffsubsync.exe was not found."
        }
    } finally {
        Pop-Location
        if (Test-Path (Join-Path $workspaceRoot "build")) { Remove-Item -Path (Join-Path $workspaceRoot "build") -Recurse -Force -ErrorAction SilentlyContinue }
        if (Test-Path (Join-Path $workspaceRoot "dist\ffsubsync.exe")) { Remove-Item -Path (Join-Path $workspaceRoot "dist\ffsubsync.exe") -Force -ErrorAction SilentlyContinue }
        if (Test-Path $entryFile) { Remove-Item -Path $entryFile -Force -ErrorAction SilentlyContinue }
        if (Test-Path (Join-Path $workspaceRoot "ffsubsync.spec")) { Remove-Item -Path (Join-Path $workspaceRoot "ffsubsync.spec") -Force -ErrorAction SilentlyContinue }
        if (Test-Path $hooksDir) { Remove-Item -Path $hooksDir -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

# -----------------------------------------------------------------------------
# 3. Whisper AI & GGML Backend
# -----------------------------------------------------------------------------
$whisperExe = Join-Path $binDir "whisper.exe"
$whisperDll = Join-Path $binDir "whisper.dll"

if ((Test-Path $whisperExe) -and (Test-Path $whisperDll)) {
    Write-Host "[OK] bin\whisper.exe and AI backend libraries are ready." -ForegroundColor Green
} else {
    Write-Host "[...] Downloading official whisper.cpp release (Windows x64)..." -ForegroundColor Yellow
    $zipPath = Join-Path $binDir "whisper_temp.zip"
    $extractDir = Join-Path $binDir "whisper_extract"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    $candidateUrls = [System.Collections.Generic.List[string]]::new()
    
    # Try fetching latest release asset from GitHub API
    $apiHeaders = @{ 'User-Agent' = 'PowerShell' }
    if ($env:GITHUB_TOKEN) {
        $apiHeaders['Authorization'] = "Bearer $env:GITHUB_TOKEN"
    }
    try {
        $releases = Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/whisper.cpp/releases' -Headers $apiHeaders -TimeoutSec 10 -UseBasicParsing
        foreach ($r in $releases) {
            $asset = $r.assets | Where-Object { $_.name -eq 'whisper-bin-x64.zip' } | Select-Object -First 1
            if ($asset) {
                $candidateUrls.Add($asset.browser_download_url)
                break
            }
        }
    } catch {
        Write-Host "Notice: Using static release fallback URLs for whisper.cpp..." -ForegroundColor Gray
    }
    
    $candidateUrls.Add('https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip')
    $candidateUrls.Add('https://github.com/ggml-org/whisper.cpp/releases/download/b5130/whisper-bin-x64.zip')
    
    $downloaded = $false
    foreach ($u in $candidateUrls) {
        try {
            Write-Host "Connecting to: $u" -ForegroundColor Gray
            Invoke-WebRequest -Uri $u -OutFile $zipPath -TimeoutSec 60 -UseBasicParsing
            if ((Test-Path $zipPath) -and ((Get-Item $zipPath).Length -gt 1000000)) {
                $downloaded = $true
                break
            }
        } catch {
            continue
        }
    }
    
    if (-not $downloaded) {
        throw "Unable to download valid whisper-bin-x64.zip from any candidate URL."
    }
    
    try {
        Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
        Get-ChildItem -Path $extractDir -Recurse | Where-Object { $_.Extension -in '.exe', '.dll' } | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination $binDir -Force
        }
        $cliExe = Join-Path $binDir "whisper-cli.exe"
        if (Test-Path $cliExe) {
            Copy-Item -Path $cliExe -Destination $whisperExe -Force
        }
        # Clean up test binaries to keep installer compact
        Get-ChildItem -Path $binDir -Filter "test-*.exe" | Remove-Item -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Whisper AI binaries and DLLs placed in bin\." -ForegroundColor Green
    } finally {
        if (Test-Path $extractDir) { Remove-Item -Path $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
        if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue }
    }
}

# -----------------------------------------------------------------------------
# 4. Microsoft Visual C++ 2015-2022 Runtime Bundling
# -----------------------------------------------------------------------------
Write-Host "[...] Checking Visual C++ runtime DLLs..." -ForegroundColor Yellow
$sys32 = [System.IO.Path]::Combine($env:SystemRoot, "System32")
$patterns = @("msvcp140*.dll", "vcruntime140*.dll", "vcomp140.dll")
$copiedCount = 0
foreach ($pat in $patterns) {
    Get-ChildItem -Path $sys32 -Filter $pat -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $binDir -Force
        $copiedCount++
    }
}
# Delete debug DLLs if any copied
Get-ChildItem -Path $binDir -Filter "*140d*.dll" | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $binDir -Filter "*140_*d*.dll" | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $binDir -Filter "*140_threadsd.dll" | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "[OK] Microsoft Visual C++ runtime DLLs verified in bin\." -ForegroundColor Green

# -----------------------------------------------------------------------------
# Verification Summary
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " Engine Binaries Verification Summary                 " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
$requiredFiles = @("ffmpeg.exe", "ffsubsync.exe", "whisper.exe", "whisper.dll", "msvcp140.dll", "vcruntime140.dll")
$allValid = $true
foreach ($file in $requiredFiles) {
    $fPath = Join-Path $binDir $file
    if (Test-Path $fPath) {
        $sizeMb = [math]::Round((Get-Item $fPath).Length / 1MB, 2)
        Write-Host "  [READY] $file ($sizeMb MB)" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
        $allValid = $false
    }
}

if (-not $allValid) {
    throw "One or more critical engine binaries are missing."
}

Write-Host ""
Write-Host "[SUCCESS] All engine binaries are in place and verified." -ForegroundColor Green
