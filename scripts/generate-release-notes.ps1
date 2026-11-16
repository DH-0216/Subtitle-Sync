param(
    [string]$Tag = "v2.2.3",
    [string]$OutputPath = "dist/RELEASE_NOTES.md",
    [string]$ChecksumPath = "dist/SHA256SUMS.txt"
)

$ErrorActionPreference = "Stop"

$checksumContent = ""
if (Test-Path $ChecksumPath) {
    $checksumContent = (Get-Content $ChecksumPath -Raw).Trim()
}

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("## Subtitle Sync $Tag 🎉")
[void]$sb.AppendLine()
[void]$sb.AppendLine("Fast, offline subtitle synchronization tool powered by FFmpeg and Whisper.")
[void]$sb.AppendLine()
[void]$sb.AppendLine("### 📦 Downloads & Assets")
[void]$sb.AppendLine('- **Windows Installer**: `SubtitleSync-Setup.exe` *(Recommended)*')
[void]$sb.AppendLine('- **Portable Version**: `SubtitleSync-Portable.exe` *(No installation required)*')
[void]$sb.AppendLine()

if ($checksumContent) {
    [void]$sb.AppendLine("### 🔒 Checksums (SHA256)")
    [void]$sb.AppendLine('```text')
    [void]$sb.AppendLine($checksumContent)
    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine()
}

[void]$sb.AppendLine("---")

$outDir = Split-Path $OutputPath -Parent
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Set-Content -Path $OutputPath -Value $sb.ToString() -Encoding UTF8
Write-Host "Generated release notes template at: $OutputPath"
