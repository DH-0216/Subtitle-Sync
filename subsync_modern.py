"""Subtitle Sync Studio - Desktop application entry point.

Launches the Subtitle Sync GUI from the src package.
"""
import sys
from src.app import App

def main():
    app = App()
    app.mainloop()

if __name__ == "__main__":
    main()
