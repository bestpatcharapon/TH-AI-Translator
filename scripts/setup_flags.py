"""Vendor the catalog's SVG flags and their MIT license from a pinned revision.

Run with the project's Python. Runtime pages use only local assets.
"""

import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent.parent
REVISION = "ac7e0eb3259eb62aa6100c435607e2fe03896a97"
BASE = f"https://raw.githubusercontent.com/lipis/flag-icons/{REVISION}"


def download(path):
    with urlopen(f"{BASE}/{path}", timeout=30) as response:
        return response.read()


def main():
    catalog_path = ROOT / "static/language-catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    codes = sorted({entry["flag"] for entry in catalog.values()})
    if "auto" in codes:
        raise ValueError("Every language needs a representative country or region flag")
    countries = {entry["code"]: entry["name"] for entry in json.loads(download("country.json"))}
    license_text = download("LICENSE")

    def fetch(code):
        if code not in countries:
            raise ValueError(f"Unknown country/region flag: {code}")
        data = download(f"flags/4x3/{code}.svg")
        if ElementTree.fromstring(data).tag != "{http://www.w3.org/2000/svg}svg":
            raise ValueError(f"Invalid SVG: {code}")
        return code, data

    with ThreadPoolExecutor(max_workers=8) as pool:
        assets = list(pool.map(fetch, codes))
    directory = ROOT / "static/flags"
    directory.mkdir(exist_ok=True)
    for code, data in assets:
        (directory / f"{code}.svg").write_bytes(data)
    (directory / "LICENSE.flag-icons.txt").write_bytes(license_text)
    (directory / "README.md").write_text(
        f"SVG country and region flags from https://github.com/lipis/flag-icons\n"
        f"Revision: {REVISION}\nLicense: MIT, see LICENSE.flag-icons.txt.\n\n"
        "A flag is a representative country or region for a language, not its sole owner.\n"
        "The catalog keeps regional flags where available, including Welsh, Scottish Gaelic,\n"
        "Basque, Catalan and Galician. Detect language keeps the existing auto.svg globe.\n"
        "Language choices and their flag mappings are in ../language-catalog.json.\n"
        "Run .venv/bin/python scripts/setup_flags.py to restore these assets.\n",
        encoding="utf-8",
    )
    for entry in catalog.values():
        entry["flagName"] = countries[entry["flag"]]
    catalog_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Installed {len(assets)} local SVG flags for {len(catalog)} languages with license attribution."
    )


if __name__ == "__main__":
    main()
