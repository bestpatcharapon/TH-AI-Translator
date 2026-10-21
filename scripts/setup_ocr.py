"""Install a portable OCR runtime for Debian/Ubuntu without sudo or global changes.

Other platforms: install Tesseract plus language data normally and set TESSERACT_CMD
if its executable is not on PATH. See README.md.
"""

import os
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ["eng", "tha", "chi-sim", "jpn", "kor", "vie", "fra", "deu", "spa", "rus"]


def main():
    if not shutil.which("apt-get") or not shutil.which("dpkg-deb"):
        raise SystemExit(
            "Install Tesseract and its 10 language packs using your OS package manager, then add tesseract to PATH."
        )
    archive = (
        "libarchive13t64"
        if subprocess.run(
            ["apt-cache", "show", "libarchive13t64"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
        == 0
        else "libarchive13"
    )
    packages = [
        "tesseract-ocr",
        "libtesseract5",
        "liblept5",
        archive,
        "libgif7",
        "libwebpmux3",
        "libopenjp2-7",
        "tesseract-ocr-osd",
    ] + [f"tesseract-ocr-{language}" for language in LANGUAGES]
    target = ROOT / ".ocr"
    target.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="translator-ocr-") as temporary:
        subprocess.run(["apt-get", "download", *packages], cwd=temporary, check=True)
        for package in Path(temporary).glob("*.deb"):
            subprocess.run(["dpkg-deb", "-x", str(package), str(target)], check=True)
    # The accurate Thai model preserves small menu lettering better than the fast pack.
    thai_data = urllib.request.urlopen(
        "https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/tha.traineddata",
        timeout=60,
    ).read()
    (target / "usr/share/tesseract-ocr/5/tessdata/tha.traineddata").write_bytes(thai_data)
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = os.pathsep.join(
        str(path) for path in (target / "usr/lib").glob("*-linux-gnu")
    )
    env["TESSDATA_PREFIX"] = str(target / "usr/share/tesseract-ocr/5/tessdata")
    subprocess.run([str(target / "usr/bin/tesseract"), "--list-langs"], env=env, check=True)
    print("OCR is ready in .ocr/ (ignored by version control).")


if __name__ == "__main__":
    main()
