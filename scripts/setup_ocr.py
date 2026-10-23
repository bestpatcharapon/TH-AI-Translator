"""Install portable Tesseract and catalog OCR models without sudo.

Usage: python scripts/setup_ocr.py [--languages th,en,ar] [--models-only] [--force]
Existing models are kept unless --force is passed. Downloads use pinned upstream
revisions and atomic replacement so interruption never leaves a partial model.
"""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAST_REVISION = "87416418657359cb625c412a48b6e1d6d41c29bd"
BEST_REVISION = "e12c65a915945e4c28e237a9b52bc4a8f39a0cec"


def selected_models(languages=None):
    catalog = json.loads((ROOT / "static/language-catalog.json").read_text(encoding="utf-8"))
    codes = list(catalog) if languages is None else languages.split(",")
    models = {"eng", "osd"}
    for code in codes:
        code = code.strip()
        if code not in catalog or not catalog[code].get("ocr"):
            if languages is not None:
                raise ValueError(f"No OCR model configured for language: {code}")
            continue
        models.update(catalog[code]["ocr"].split("+"))
    if "jpn" in models:
        models.add("jpn_vert")
    return sorted(models)


def install_runtime(target):
    if not shutil.which("apt-get") or not shutil.which("dpkg-deb"):
        raise SystemExit(
            "Install Tesseract with your OS package manager, then use --models-only "
            "and set TESSDATA_PREFIX to .ocr/usr/share/tesseract-ocr/5/tessdata."
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
    ]
    with tempfile.TemporaryDirectory(prefix="translator-ocr-") as temporary:
        subprocess.run(["apt-get", "download", *packages], cwd=temporary, check=True)
        for package in Path(temporary).glob("*.deb"):
            subprocess.run(["dpkg-deb", "-x", str(package), str(target)], check=True)


def install_model(model, destination, force=False):
    path = destination / f"{model}.traineddata"
    if path.exists() and path.stat().st_size >= 1000 and not force:
        return
    repository, revision = (
        ("tessdata_best", BEST_REVISION) if model == "tha" else ("tessdata_fast", FAST_REVISION)
    )
    url = f"https://raw.githubusercontent.com/tesseract-ocr/{repository}/{revision}/{model}.traineddata"
    temporary = None
    try:
        with (
            urllib.request.urlopen(url, timeout=90) as response,
            tempfile.NamedTemporaryFile(
                dir=destination, suffix=".download", delete=False
            ) as output,
        ):
            temporary = Path(output.name)
            shutil.copyfileobj(response, output)
        if temporary.stat().st_size < 1000:
            raise RuntimeError(f"Invalid OCR model download: {model}")
        temporary.replace(path)
        print(f"Installed {model}", flush=True)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--languages", help="Comma-separated catalog codes; defaults to all OCR languages"
    )
    parser.add_argument("--models-only", action="store_true", help="Skip apt runtime installation")
    parser.add_argument("--force", action="store_true", help="Replace existing model files")
    args = parser.parse_args()
    try:
        models = selected_models(args.languages)
    except ValueError as error:
        parser.error(str(error))
    target = ROOT / ".ocr"
    destination = target / "usr/share/tesseract-ocr/5/tessdata"
    destination.mkdir(parents=True, exist_ok=True)
    if not args.models_only:
        install_runtime(target)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda model: install_model(model, destination, args.force), models))
    env = os.environ.copy()
    libraries = [str(path) for path in (target / "usr/lib").glob("*-linux-gnu")]
    env["LD_LIBRARY_PATH"] = os.pathsep.join(
        libraries + ([env["LD_LIBRARY_PATH"]] if env.get("LD_LIBRARY_PATH") else [])
    )
    env["TESSDATA_PREFIX"] = str(destination)
    command = target / "usr/bin/tesseract"
    subprocess.run(
        [
            str(command) if command.exists() else os.getenv("TESSERACT_CMD", "tesseract"),
            "--list-langs",
        ],
        env=env,
        check=True,
    )
    print(f"OCR ready: {len(models)} model files in .ocr/ (ignored by version control).")


if __name__ == "__main__":
    main()
