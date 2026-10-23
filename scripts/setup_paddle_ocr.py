"""Install official Paddle models locally; no downloads happen during image requests."""

import argparse
import hashlib
import json
import shutil
import tarfile
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = ("PP-OCRv6_medium_det", "th_PP-OCRv5_mobile_rec", "PP-OCRv6_medium_rec")
BASE = "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0"


def install_model(name, force=False):
    destination = ROOT / ".ocr/paddle" / name
    if (
        (destination / "inference.json").is_file()
        and (destination / "inference.pdiparams").is_file()
        and (destination / "inference.yml").is_file()
        and not force
    ):
        print(f"Ready: {name}", flush=True)
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    url = f"{BASE}/{name}_infer.tar"
    with tempfile.TemporaryDirectory(dir=destination.parent, prefix="download-") as work:
        archive = Path(work) / "model.tar"
        with urllib.request.urlopen(url, timeout=120) as source, archive.open("wb") as output:
            shutil.copyfileobj(source, output)
        extracted = Path(work) / "extracted"
        extracted.mkdir()
        with tarfile.open(archive) as model:
            if sum(member.size for member in model.getmembers()) > 300 * 1024 * 1024:
                raise RuntimeError(f"Model too large: {name}")
            model.extractall(extracted, filter="data")
        config = next(extracted.rglob("inference.json"), None)
        if config is None or not all(
            (config.parent / filename).is_file()
            for filename in ("inference.pdiparams", "inference.yml")
        ):
            raise RuntimeError(f"Invalid model archive: {name}")
        if destination.exists():
            shutil.rmtree(destination)
        shutil.move(str(config.parent), destination)
        (destination / "download.json").write_text(
            json.dumps(
                {"source": url, "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest()},
                indent=2,
            )
            + "\n"
        )
        print(f"Installed: {name}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    options = parser.parse_args()
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(lambda name: install_model(name, options.force), MODELS))
    print("Paddle OCR models ready in .ocr/paddle/.")


if __name__ == "__main__":
    main()
