"""Helper script to compile a standalone, self-contained ffsubsync binary
for the current operating system (Windows, macOS, or Linux).
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    root = Path(__file__).resolve().parent.parent
    bin_dir = root / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

    exe_name = "ffsubsync.exe" if sys.platform == "win32" else "ffsubsync"
    target_bin = bin_dir / exe_name

    print(f"[INFO] Compiling standalone {exe_name}...")

    # 1. Custom hook for webrtcvad / webrtcvad-wheels
    hooks_dir = root / "pyinstaller_hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)
    hook_file = hooks_dir / "hook-webrtcvad.py"
    hook_file.write_text(
        "from PyInstaller.utils.hooks import copy_metadata\n"
        "try:\n"
        "    datas = copy_metadata('webrtcvad')\n"
        "except Exception:\n"
        "    datas = copy_metadata('webrtcvad-wheels')\n",
        encoding="utf-8"
    )

    # 2. Entrypoint script for ffsubsync
    entry_file = root / "temp_ffsubsync_entry.py"
    entry_file.write_text(
        "import sys\n"
        "from ffsubsync import main\n\n"
        "if __name__ == '__main__':\n"
        "    sys.exit(main())\n",
        encoding="utf-8"
    )

    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--onefile",
        "--clean",
        "--name", "ffsubsync",
        "--additional-hooks-dir", str(hooks_dir),
        "--collect-all", "ffsubsync",
        "--collect-all", "auditok",
        str(entry_file)
    ]

    try:
        subprocess.check_call(cmd, cwd=str(root))
        dist_bin = root / "dist" / exe_name
        if not dist_bin.exists():
            raise FileNotFoundError(f"Expected compiled binary not found at: {dist_bin}")

        shutil.copy2(str(dist_bin), str(target_bin))
        if sys.platform != "win32":
            os.chmod(str(target_bin), 0o755)
        print(f"[SUCCESS] Standalone {exe_name} placed in {target_bin}")
    finally:
        # Cleanup temporary files
        if entry_file.exists():
            entry_file.unlink(missing_ok=True)
        if hook_file.exists():
            hook_file.unlink(missing_ok=True)
        if hooks_dir.exists():
            shutil.rmtree(str(hooks_dir), ignore_errors=True)
        spec_file = root / "ffsubsync.spec"
        if spec_file.exists():
            spec_file.unlink(missing_ok=True)
        build_dir = root / "build"
        if build_dir.exists():
            shutil.rmtree(str(build_dir), ignore_errors=True)
        dist_dir = root / "dist"
        if dist_dir.exists():
            shutil.rmtree(str(dist_dir), ignore_errors=True)


if __name__ == "__main__":
    main()
