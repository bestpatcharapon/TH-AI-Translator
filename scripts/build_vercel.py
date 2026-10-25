"""Copy public UI assets to Vercel's CDN without changing local Flask routes."""

import shutil
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    destination = root / "public" / "static"
    shutil.copytree(root / "static", destination, dirs_exist_ok=True)
    print("Prepared public/static for Vercel.")


if __name__ == "__main__":
    main()
