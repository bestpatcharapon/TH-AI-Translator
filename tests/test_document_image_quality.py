"""Offline image/payload regressions, not measurements of provider OCR accuracy."""

import base64
import io
import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pymupdf
from PIL import Image, ImageDraw

import document_ocr
import services


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def receipt_image() -> Image.Image:
    image = Image.new("RGB", (200, 100), "white")
    ImageDraw.Draw(image).multiline_text(
        (8, 8), "Invoice 001\nAmount 1,234.50\nVAT 86.42\nTotal 1,320.92", fill="black"
    )
    return image


class DocumentImageQualityTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(
            os.environ,
            {
                "TYPHOON_OCR_API_KEY": "offline-test-only",
                "TYPHOON_OCR_MODEL": "typhoon-ocr",
                "TYPHOON_BASE_URL": "https://api.opentyphoon.ai/v1",
                "TYPHOON_OCR_TIMEOUT_SECONDS": "45",
                "TYPHOON_OCR_MAX_TOKENS": "8192",
                "GROQ_VISION_MAX_TOKENS": "900",
            },
        )
        environment.start()
        self.addCleanup(environment.stop)
        document_ocr._page_cache.clear()
        self.addCleanup(document_ocr._page_cache.clear)

    def provider_payload(self, provider: str, data: bytes, *, pdf: bool = False) -> bytes:
        # Deliberately supplied response: these assertions cover transport, not recognition.
        text = "# ใบเสร็จ 001\nยอด 1,234.50\nVAT 86.42\nรวม 1,320.92"
        response = SimpleNamespace(
            choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=text))]
        )
        groq = MagicMock()
        groq.chat.completions.create.return_value = response
        with (
            patch.dict(os.environ, {"DOCUMENT_OCR_PROVIDER": provider}),
            patch.object(document_ocr, "_typhoon_client") as typhoon,
        ):
            typhoon.return_value.chat.completions.create.return_value = response
            if pdf:
                result = services.extract_file(data, "receipt.pdf", "document", client=groq)
            else:
                result = services.read_image(data, groq)
            self.assertEqual(result.encode("utf-8"), text.encode("utf-8"))
            if provider == "typhoon":
                create = typhoon.return_value.chat.completions.create
                typhoon.assert_called_once()
                groq.chat.completions.create.assert_not_called()
            else:
                create = groq.chat.completions.create
                typhoon.assert_not_called()
            create.assert_called_once()
            url = create.call_args.kwargs["messages"][0]["content"][1]["image_url"]["url"]
        header, encoded = url.split(",", 1)
        expected_mime = "image/png" if provider == "typhoon" else "image/jpeg"
        self.assertEqual(header, f"data:{expected_mime};base64")
        payload = base64.b64decode(encoded, validate=True)
        signature = b"\x89PNG\r\n\x1a\n" if provider == "typhoon" else b"\xff\xd8\xff"
        self.assertTrue(payload.startswith(signature))
        with Image.open(io.BytesIO(payload)) as image:
            self.assertEqual(image.format, "PNG" if provider == "typhoon" else "JPEG")
            self.assertEqual(image.mode, "RGB")
        return payload

    def test_rgba_transparent_black_becomes_white_and_ink_stays_black(self):
        image = Image.new("RGBA", (96, 32), (0, 0, 0, 0))
        image.paste((0, 0, 0, 255), (32, 0, 64, 32))
        image.paste((0, 0, 0, 128), (64, 0, 96, 32))
        for lossless in (True, False):
            with self.subTest(lossless=lossless):
                with Image.open(
                    io.BytesIO(services.image_bytes(png_bytes(image), lossless))
                ) as out:
                    self.assertEqual(out.mode, "RGB")
                    self.assertEqual(out.getpixel((16, 16)), (255, 255, 255))
                    self.assertEqual(out.getpixel((48, 16)), (0, 0, 0))
                    self.assertEqual(out.getpixel((80, 16)), (127, 127, 127))

    def test_la_transparency_is_composited_on_white(self):
        image = Image.new("LA", (3, 1), (0, 0))
        image.putpixel((1, 0), (0, 255))
        image.putpixel((2, 0), (0, 128))
        with Image.open(io.BytesIO(services.image_bytes(png_bytes(image), True))) as out:
            self.assertEqual(out.mode, "RGB")
            self.assertEqual(
                [out.getpixel((x, 0)) for x in range(3)],
                [(255, 255, 255), (0, 0, 0), (127, 127, 127)],
            )

    def test_palette_transparency_is_composited_on_white(self):
        for transparency in (0, bytes([0, 255, 128])):
            with self.subTest(transparency=transparency):
                image = Image.new("P", (3, 1), 0)
                image.putpalette([0, 0, 0] * 256)
                image.putdata([0, 1, 2])
                image.info["transparency"] = transparency
                with Image.open(io.BytesIO(services.image_bytes(png_bytes(image), True))) as out:
                    self.assertEqual(out.mode, "RGB")
                    self.assertEqual(out.getpixel((0, 0)), (255, 255, 255))
                    self.assertEqual(out.getpixel((1, 0)), (0, 0, 0))
                    self.assertEqual(
                        out.getpixel((2, 0)),
                        (0, 0, 0) if isinstance(transparency, int) else (127, 127, 127),
                    )

    def test_exif_orientation_rotates_pixels_once(self):
        image = Image.new("RGB", (40, 20), "white")
        image.paste("black", (0, 0, 20, 20))
        exif = Image.Exif()
        exif[274] = 6  # Camera orientation: rotate 90 degrees clockwise.
        source = io.BytesIO()
        image.save(source, format="PNG", exif=exif)
        for lossless in (True, False):
            with self.subTest(lossless=lossless):
                normalized = services.image_bytes(source.getvalue(), lossless)
                with Image.open(io.BytesIO(normalized)) as out:
                    self.assertEqual(out.size, (20, 40))
                    self.assertEqual(out.getpixel((10, 10)), (0, 0, 0))
                    self.assertEqual(out.getpixel((10, 30)), (255, 255, 255))
                    self.assertNotIn(274, out.getexif())
                with Image.open(io.BytesIO(services.image_bytes(normalized, lossless))) as again:
                    self.assertEqual(again.size, (20, 40))

    def test_image_dimensions_are_capped_at_2200_with_aspect_ratio_preserved(self):
        for size, expected in [((4400, 2200), (2200, 1100)), ((1100, 4400), (550, 2200))]:
            data = png_bytes(Image.new("RGB", size, "white"))
            for lossless in (True, False):
                with self.subTest(size=size, lossless=lossless):
                    with Image.open(io.BytesIO(services.image_bytes(data, lossless))) as out:
                        self.assertEqual(out.size, expected)
                        self.assertLessEqual(max(out.size), 2200)

    def test_small_images_are_not_upscaled(self):
        for size in ((1, 1), (200, 100), (100, 200), (2200, 50)):
            data = png_bytes(Image.new("RGB", size, "white"))
            for lossless in (True, False):
                with self.subTest(size=size, lossless=lossless):
                    with Image.open(io.BytesIO(services.image_bytes(data, lossless))) as out:
                        self.assertEqual(out.size, size)

    def test_typhoon_receives_lossless_receipt_pixels_and_groq_receives_jpeg(self):
        image = receipt_image()
        data = png_bytes(image)
        for provider in ("typhoon", "groq"):
            with self.subTest(provider=provider):
                payload = self.provider_payload(provider, data)
                self.assertEqual(payload, services.image_bytes(data, provider == "typhoon"))
                with Image.open(io.BytesIO(payload)) as out:
                    self.assertEqual(out.size, image.size)
                    if provider == "typhoon":
                        self.assertEqual(out.tobytes(), image.tobytes())

    def test_typhoon_provider_receives_white_not_transparent_black_background(self):
        image = Image.new("RGBA", (200, 100), (0, 0, 0, 0))
        ImageDraw.Draw(image).text((8, 8), "Total 1,320.92", fill=(0, 0, 0, 255))
        payload = self.provider_payload("typhoon", png_bytes(image))
        expected = Image.new("RGB", image.size, "white")
        expected.paste(image, mask=image.getchannel("A"))
        with Image.open(io.BytesIO(payload)) as out:
            self.assertEqual(out.getpixel((199, 99)), (255, 255, 255))
            self.assertEqual(out.tobytes(), expected.tobytes())
            self.assertLess(min(out.tobytes()), 255)

    def test_scanned_pdf_provider_density_and_render_ceiling(self):
        scan = png_bytes(receipt_image())
        rasterize = pymupdf.Page.get_pixmap
        for width, height in ((200, 100), (1000, 500), (1500, 3000)):
            with pymupdf.open() as document:
                page = document.new_page(width=width, height=height)
                page.insert_image(page.rect, stream=scan)
                self.assertEqual(page.get_text(), "")
                data = document.tobytes()
            for provider, density in (("typhoon", 3), ("groq", 2)):
                with (
                    self.subTest(size=(width, height), provider=provider),
                    patch.object(
                        pymupdf.Page, "get_pixmap", autospec=True, side_effect=rasterize
                    ) as render,
                ):
                    payload = self.provider_payload(provider, data, pdf=True)
                    render.assert_called_once()
                    options = render.call_args.kwargs
                    scale = min(density, 2200 / max(width, height))
                    self.assertAlmostEqual(options["matrix"].a, scale)
                    self.assertAlmostEqual(options["matrix"].d, scale)
                    self.assertIs(options["alpha"], False)
                    with Image.open(io.BytesIO(payload)) as out:
                        self.assertEqual(out.size, (round(width * scale), round(height * scale)))
                        self.assertLessEqual(max(out.size), 2200)


if __name__ == "__main__":
    unittest.main()
