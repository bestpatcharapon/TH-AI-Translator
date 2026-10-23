"""Real codec and OCR ordering regressions; no external AI requests."""

import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

import app as server
from language_catalog import OCR_LANGUAGES
from photo_translation import ocr_runtime, parse_tsv
from scripts.setup_ocr import install_model, selected_models
from services import image_bytes


def heif_image():
    output = io.BytesIO()
    image = Image.new("RGB", (120, 80), "white")
    image.save(output, format="HEIF", quality=90)
    return output.getvalue()


class ImageFormatTests(unittest.TestCase):
    def test_heif_decodes_to_browser_compatible_png_and_jpeg(self):
        data = heif_image()
        for lossless, expected in [(True, "PNG"), (False, "JPEG")]:
            with Image.open(io.BytesIO(image_bytes(data, lossless))) as image:
                self.assertEqual(image.format, expected)
                self.assertEqual(image.size, (120, 80))

    def test_preview_is_local_and_checks_actual_content(self):
        client = server.app.test_client()
        with patch.object(server, "get_client") as provider:
            result = client.post(
                "/api/photo-preview", data={"file": (io.BytesIO(heif_image()), "phone.heic")}
            )
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.mimetype, "image/png")
            self.assertIn("no-store", result.headers["Cache-Control"])
            with Image.open(io.BytesIO(result.data)) as image:
                self.assertEqual(image.size, (120, 80))
            bad = client.post(
                "/api/photo-preview", data={"file": (io.BytesIO(b"not an image"), "fake.heic")}
            )
            self.assertEqual(bad.status_code, 400)
            self.assertIn("error", bad.json)
            provider.assert_not_called()

    def test_heif_photo_translation_returns_normalized_original(self):
        client = server.app.test_client()
        region = {"x": 5, "y": 5, "width": 50, "height": 15, "text": "hello"}
        with (
            patch("photo_translation.positioned_text", return_value=[region]),
            patch("photo_translation.translate_regions", return_value=["สวัสดี"]),
            patch.object(server, "get_client"),
        ):
            result = client.post(
                "/api/photo-translate",
                data={
                    "source": "en",
                    "target": "th",
                    "file": (io.BytesIO(heif_image()), "phone.heic"),
                },
            )
            self.assertEqual(result.status_code, 200, result.json)
            self.assertTrue(result.json["image"].startswith("data:image/png;base64,"))
            self.assertEqual(result.json["regions"][0]["translation"], "สวัสดี")

    def test_exif_orientation_is_applied(self):
        for format_name in ["JPEG", "HEIF"]:
            with self.subTest(format=format_name):
                output = io.BytesIO()
                image = Image.new("RGB", (120, 80), "white")
                exif = Image.Exif()
                exif[274] = 6
                image.save(output, format=format_name, exif=exif.tobytes())
                with Image.open(io.BytesIO(image_bytes(output.getvalue(), True))) as normalized:
                    self.assertEqual(normalized.size, (80, 120))

    def test_unsupported_actual_format_is_rejected(self):
        output = io.BytesIO()
        Image.new("RGB", (10, 10)).save(output, format="GIF")
        with self.assertRaises(ValueError):
            image_bytes(output.getvalue())

    def test_ocr_downloads_follow_catalog_and_language_selection(self):
        self.assertEqual(
            set(selected_models()), set(OCR_LANGUAGES.values()) | {"eng", "osd", "jpn_vert"}
        )
        self.assertEqual(set(selected_models("ar,zh-TW")), {"ara", "chi_tra", "eng", "osd"})
        self.assertEqual(OCR_LANGUAGES["lo"], "lao")
        with self.assertRaises(ValueError):
            selected_models("haw")

    def test_failed_model_download_does_not_replace_existing_model(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ara.traineddata"
            path.write_bytes(b"existing model")
            with patch(
                "scripts.setup_ocr.urllib.request.urlopen", return_value=io.BytesIO(b"short")
            ):
                with self.assertRaises(RuntimeError):
                    install_model("ara", Path(directory), force=True)
            self.assertEqual(path.read_bytes(), b"existing model")
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_portable_runtime_uses_installed_models_before_system_runtime(self):
        with (
            patch.dict("os.environ", {}, clear=True),
            patch("photo_translation.Path.exists", return_value=True),
            patch("photo_translation.shutil.which", return_value="/usr/bin/tesseract"),
        ):
            command, env = ocr_runtime()
            self.assertIn(".ocr/usr/bin/tesseract", command)
            self.assertIn(".ocr/usr/share/tesseract-ocr/5/tessdata", env["TESSDATA_PREFIX"])

    def test_explicit_runtime_and_model_directory_are_preserved(self):
        with patch.dict(
            "os.environ",
            {"TESSERACT_CMD": "/custom/tesseract", "TESSDATA_PREFIX": "/custom/models"},
            clear=True,
        ):
            command, env = ocr_runtime()
            self.assertEqual(command, "/custom/tesseract")
            self.assertEqual(env["TESSDATA_PREFIX"], "/custom/models")

    def test_rtl_ocr_keeps_logical_word_order_with_mixed_digits(self):
        header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
        # Tesseract returns logical word order; physical x coordinates run backwards.
        rows = [
            "4\t1\t1\t1\t1\t0\t10\t20\t170\t20\t-1\t",
            "5\t1\t1\t1\t1\t1\t120\t20\t60\t20\t95\tمرحبا",
            "5\t1\t1\t1\t1\t2\t60\t20\t50\t20\t95\tبالعالم",
            "5\t1\t1\t1\t1\t3\t10\t20\t40\t20\t95\t123",
        ]
        regions = parse_tsv(header + "\n".join(rows), 1, 300, 300)
        self.assertEqual([region["text"] for region in regions], ["مرحبا بالعالم 123"])
