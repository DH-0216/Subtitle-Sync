param(
    [string]$Tag = "v2.2.3",
    [string]$Title = "",
    [string]$OutputPath = "dist/RELEASE_NOTES.md",
    [string]$ChecksumPath = "dist/SHA256SUMS.txt",
    [string]$Repo = ""
)

$ErrorActionPreference = "Stop"

$checksumContent = ""
if (Test-Path $ChecksumPath) {
    $checksumContent = (Get-Content $ChecksumPath -Raw).Trim()
}

$heading = if ($Title) { $Title } else { "Subtitle Sync $Tag" }

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("## $heading 🎉")
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

# Fetch GitHub auto-generated release notes (using .github/release.yml categories)
if ($Repo) {
    try {
        $genNotes = (gh api "repos/$Repo/releases/generate-notes" -f tag_name="$Tag" --jq .body 2>$null)
        if ($genNotes -and $genNotes.Trim()) {
            [void]$sb.AppendLine("---")
            [void]$sb.AppendLine()
            [void]$sb.AppendLine($genNotes.Trim())
        }
    } catch {
        Write-Host "Could not fetch auto-generated changelog from GitHub API."
    }
}

$outDir = Split-Path $OutputPath -Parent
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Set-Content -Path $OutputPath -Value $sb.ToString() -Encoding UTF8
Write-Host "Generated release notes template at: $OutputPath"
