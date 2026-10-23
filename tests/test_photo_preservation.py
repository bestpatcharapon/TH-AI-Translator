"""Detect missed headings and preserve numbers independently of OCR values."""

import unittest

from PIL import Image, ImageDraw, ImageFont

from photo_detection import text_boxes
from photo_translation import number_boxes, overlap, parse_tsv


class PhotoPreservationTests(unittest.TestCase):
    def test_an_isolated_digit_shaped_decoration_is_not_protected_as_a_price(self):
        tsv = (
            "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
            "5\t1\t1\t1\t1\t1\t30\t120\t20\t55\t85\t2\n"
        )
        self.assertEqual(number_boxes(tsv, 1, 640, 1000), [])

    def test_one_digit_ocr_still_protects_space_for_a_missing_zero(self):
        tsv = (
            "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
            "4\t1\t1\t1\t1\t0\t80\t20\t8\t15\t-1\t\n"
            "5\t1\t1\t1\t1\t1\t80\t20\t8\t15\t80\t5\n"
            "5\t1\t1\t1\t1\t2\t110\t20\t35\t15\t95\tBaht\n"
        )
        # Ordinary text filtering drops this value. Protection must not depend on it.
        self.assertFalse(any(region["text"] == "5" for region in parse_tsv(tsv, 1, 200, 100)))
        boxes = number_boxes(tsv, 1, 200, 100)
        self.assertEqual(len(boxes), 1)
        self.assertLessEqual(boxes[0]["x"], 80)
        self.assertGreaterEqual(boxes[0]["x"] + boxes[0]["width"], 98)
        self.assertNotIn("text", boxes[0])

    def test_neural_detector_finds_a_black_thai_heading_on_yellow(self):
        image = Image.new("RGB", (640, 900), "#111111")
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((35, 180, 350, 235), 24, fill="#f6b318")
        font = ImageFont.truetype("static/fonts/NotoSansThai-Bold.ttf", 28)
        caption = "อาหารจานเดียว"
        draw.text((60, 185), caption, font=font, fill="black")
        left, top, right, bottom = draw.textbbox((60, 185), caption, font=font)
        expected = dict(x=left, y=top, width=right - left, height=bottom - top)
        detected = text_boxes(image)
        self.assertTrue(any(overlap(box, expected) > 0.65 for box in detected), detected)
        self.assertTrue(all(box["text"] == "" and box["reading_review"] for box in detected))
