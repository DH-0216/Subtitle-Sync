# Subtitle Sync Studio

<p align="center">
  <img src="app_icon.png" alt="Subtitle Sync Icon" width="128" height="128">
</p>

<p align="center">
  <b>A sleek, modern desktop app to automatically synchronize out-of-sync subtitles with your movie's reference audio.</b>
</p>

<p align="center">
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

## 🚀 Quick Start (Download Executable)

1. Go to the [**Releases**](https://github.com/) section on GitHub.
2. Download the latest `SubtitleSync.exe`.
3. Ensure **[ffmpeg](https://ffmpeg.org/)** is installed on your computer.
4. Double-click `SubtitleSync.exe` to run!

---

## 🛠️ Prerequisites

Subtitle synchronization relies on **`ffmpeg`** to extract and analyze audio tracks from your video.

### Installing FFmpeg (Windows)

The easiest way is using Windows Package Manager (`winget`), which sets up your system `PATH` automatically:

1. Click **Start**, type **PowerShell**, and open it.
2. Run:
   ```powershell
   winget install ffmpeg
   ```
   *(Note: If prompted with multiple package options, run `winget install Gyan.FFmpeg`)*
3. Close PowerShell and open it again.
4. Verify that it worked:
   ```powershell
   ffmpeg -version
   ```

*(Alternative: You can also install manually from [ffmpeg.org](https://ffmpeg.org/download.html) or via `choco install ffmpeg`)*

---

## 💻 Running from Source

If you prefer running directly with Python:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/subtitle-sync-studio.git
cd subtitle-sync-studio

# 2. Install dependencies
pip install customtkinter ffsubsync

# 3. Launch the app
python subsync_modern.py
```

---

## 📦 Building the Executable (.exe)

You can build the standalone `.exe` with PyInstaller using the included 1-click builder:

1. Double-click **`build.bat`**.
2. It will automatically:
   - Check and install required build packages (`pyinstaller`, `pillow`, `customtkinter`, `ffsubsync`).
   - Package the app with the custom icon and assets.
   - Output `SubtitleSync.exe` directly inside the `dist/` directory.

Or run manually in your terminal:

```bash
pyinstaller --noconsole --onefile --clean --name "SubtitleSync" --icon "app_icon.ico" --add-data "app_icon.ico;." --collect-all customtkinter subsync_modern.py
```

---

## 📂 File Structure

```text
├── subsync_modern.py     # Main application source code
├── create_icon.py        # Icon generation script
├── app_icon.ico          # Windows multi-resolution icon
├── app_icon.png          # High-resolution icon preview
├── build.bat             # 1-click PyInstaller build script
├── dist/                 # Compiled executable output folder
│   └── SubtitleSync.exe  # Standalone double-click application
└── README.md             # Project documentation
```

---

## 📄 Output Files

Synchronized subtitle files are automatically saved in the same directory as the original subtitle files with a `.synced` suffix:
- Original: `Movie.Title.srt`
- Synchronized: `Movie.Title.synced.srt`

---

## 🙏 Credits

- UI built with [CustomTkinter](https://github.com/TomSchimansky/CustomTkinter).
- Speech alignment powered by [ffsubsync](https://github.com/smarnach/ffsubsync).
