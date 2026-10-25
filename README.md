# Subtitle Sync Studio

<p align="center">
  <img src="app_icon.png" alt="Subtitle Sync Icon" width="128" height="128">
</p>

<p align="center">
  <b>A sleek, modern desktop app to automatically synchronize out-of-sync subtitles with your movie's reference audio.</b>
</p>

<p align="center">
  <a href="https://github.com/DH-0216/Subtitle-Sync/releases"><img src="https://img.shields.io/github/downloads/DH-0216/Subtitle-Sync/total?color=2ea44f&logo=github" alt="Total Downloads"></a>
  <a href="https://github.com/DH-0216/Subtitle-Sync/releases"><img src="https://img.shields.io/github/v/release/DH-0216/Subtitle-Sync?logo=github" alt="Latest Release"></a>
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white" alt="Python Version">
  <img src="https://img.shields.io/badge/UI-CustomTkinter-blue" alt="CustomTkinter">
  <img src="https://img.shields.io/badge/Engine-ffsubsync-6C5CE7" alt="ffsubsync">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white" alt="Windows">
</p>

---

## ✨ Features

- **Guided Step-by-Step Workflow**: Clear 3-step interface (`STEP 1: Movie`, `STEP 2: Subtitles`, `STEP 3: Synchronize`).
- **Batch Processing**: Add multiple subtitle files at once and synchronize them in sequence.
- **Modern UI & Dark Mode**: Sleek cards, clean typography, dynamic status indicators, and one-click Dark/Light mode toggle.
- **Embedded Activity Console**: View speech alignment progress in real time with detailed exit reports.
- **Direct Output Access**: Quickly open the destination folder containing your `.synced` subtitles with one click.
- **Standalone Portable App**: Available as a single double-clickable Windows `.exe` with zero installation required.

---

## 🚀 Quick Start (Download)

Go to the [**Releases**](https://github.com/DH-0216/Subtitle-Sync/releases) section on GitHub and pick your preferred download:

| Package | File | Description |
| :--- | :--- | :--- |
| **Windows Installer** *(Recommended)* | **`SubtitleSync-Setup.exe`** | Standard setup wizard. Installs to Program Files, adds Start Menu & Desktop shortcuts, includes standard uninstaller, and sets up FFmpeg offline. |
| **Portable Version** | **`SubtitleSync.exe`** | Standalone single `.exe`. Zero installation required. If FFmpeg is missing, prompts with an in-app 1-click auto-setup button. |

---

## 🛠️ Prerequisites

> [!NOTE]
> If you downloaded **`SubtitleSync-Setup.exe`** or **`SubtitleSync.exe`**, FFmpeg is handled automatically! You do not need to install it manually.

Subtitle synchronization uses **`ffmpeg`** to extract and analyze speech audio from your video files. If you are **running from source** or prefer installing it manually on Windows:

1. Open **PowerShell** and run:
   ```powershell
   winget install ffmpeg
   ```
   *(Note: If prompted with multiple package options, run `winget install Gyan.FFmpeg`)*
2. Verify that it worked:
   ```powershell
   ffmpeg -version
   ```

*(Alternative: You can also download manually from [ffmpeg.org/download.html](https://ffmpeg.org/download.html) and add it to your system `PATH`)*

---

## 💻 Running from Source

If you prefer running directly with Python:

```bash
# 1. Clone the repository
git clone https://github.com/DH-0216/Subtitle-Sync.git
cd Subtitle-Sync

# 2. Install dependencies
pip install customtkinter ffsubsync

# 3. Launch the app
python subsync_modern.py
```

---

## 📦 Building the Executable & Installer

You can build both the standalone portable `.exe` and the standard Windows setup installer using the included 1-click builder:

1. Double-click **`build.bat`**.
2. It will automatically:
   - Check and verify required build dependencies.
   - Package the portable **`dist/SubtitleSync.exe`** with PyInstaller and embedded assets.
   - Auto-locate `ffmpeg.exe` and compile the **`dist/SubtitleSync-Setup.exe`** installer with Inno Setup.
   - Create a desktop shortcut for quick access.

Or build the portable `.exe` manually in your terminal:

```bash
pyinstaller --noconsole --onefile --clean --name "SubtitleSync" --icon "app_icon.ico" --add-data "app_icon.ico;." --collect-all customtkinter subsync_modern.py
```

---

## 📂 File Structure

```text
├── subsync_modern.py        # Main application source code
├── installer.iss            # Inno Setup Windows installer script
├── create_icon.py           # Icon generation script
├── app_icon.ico             # Windows multi-resolution icon
├── app_icon.png             # High-resolution icon preview
├── build.bat                # 1-click builder script (Portable & Installer)
├── dist/                    # Compiled distribution output folder
│   ├── SubtitleSync-Setup.exe  # Standard Windows Setup Installer
│   └── SubtitleSync.exe        # Standalone portable application
└── README.md                # Project documentation
```

---

## 📄 Output Files

Synchronized subtitle files are automatically saved in the same directory as the original subtitle files with a `.synced` suffix:
- Original: `Movie.Title.srt`
- Synchronized: `Movie.Title.synced.srt`

---

## 🙏 Credits & Third-Party Notices

Subtitle Sync Studio relies on the following open-source projects:

- **[FFmpeg](https://ffmpeg.org/)**: Multimedia framework used to extract and analyze audio tracks from video files. FFmpeg is licensed under the [GNU LGPL / GPL](https://ffmpeg.org/legal.html). Its source code can be downloaded from [ffmpeg.org/download.html](https://ffmpeg.org/download.html).
- **[ffsubsync](https://github.com/smacke/ffsubsync)**: Speech-to-subtitle alignment engine powered by [ffsubsync](https://github.com/smacke/ffsubsync) (MIT License).
- **[CustomTkinter](https://github.com/TomSchimansky/CustomTkinter)**: Desktop UI interface built with [CustomTkinter](https://github.com/TomSchimansky/CustomTkinter) (Creative Commons Zero / MIT License).
