# ผลตรวจระบบ — 30 ตุลาคม 2026

ตรวจโค้ดใน working tree ปัจจุบันบนเครื่องนี้ (HEAD `c9d0167` พร้อมงานที่ยังไม่ได้ commit) ไม่ใช่ผลตรวจ production หรือการรับรองความแม่นยำทุกภาษา ไม่แก้โค้ดแอประหว่างรอบตรวจนี้ สร้างเฉพาะรายงานและไฟล์ build ที่ Git ignore

## สถานะโดยรวม

ระบบหลักทำงานได้ในกรณีที่ตรวจ ทั้งข้อความ เอกสาร รูปภาพ เสียง แชทสด และเครื่องมือตรวจทาน มีฐานการทดสอบครอบคลุม แต่ยังมีข้อผิดพลาดหน้าจอเล็กน้อย ปัญหาบริการภายนอก และหลักฐานคุณภาพที่ยังไม่ครบ จึงยังสรุปว่าใช้งานได้ถูกต้องทุกภาษา ทุกอุปกรณ์ หรือพร้อม production ทั้งหมดไม่ได้

| การตรวจ | ผล |
| --- | --- |
| Python unittest | ผ่าน 244 tests, 8.257 วินาที ไม่มี failure/error/skip |
| Browser regression | ผ่าน 22 จาก 23 ชุด; dialect-layout ล้มเหลวเพราะเนื้อหาล้นแนวตั้ง 5 px |
| Ruff lint / Python format | ผ่าน; 94 ไฟล์อยู่ในรูปแบบที่กำหนด |
| JavaScript syntax / Prettier | ผ่าน |
| BasedPyright | 0 errors, 0 warnings, 0 notes |
| ความเข้ากันได้ของ dependencies | `pip check` ผ่าน |
| เตรียม Vercel static assets | `scripts/build_vercel.py` ผ่าน; ไม่ได้ deploy |
| PWA ขณะออฟไลน์ | register service worker จริง, cache 21 assets, ปิดเน็ตแล้ว reload หน้าเว็บได้ ไม่มี pageerror |
| OCR บนเครื่อง | Paddle อ่านภาพสังเคราะห์ไทย 2 บรรทัดตรงทุกตัวอักษร; cold run 4.841 วินาที |
| บริการ AI/เสียงจริง | ทุกเส้นทางที่เลือกทดสอบสำเร็จในที่สุด; มี 503 หนึ่งครั้งและ 429 สองครั้งก่อน retry |

ผล browser รายชุด: [browser-results.json](browser-results.json) และ [browser-check.log](browser-check.log)

## สิ่งที่พบ เรียงตามผลต่อการใช้งาน

### 1. เสียงสแลงยังถอดผิด แม้ HTTP สำเร็จ

TTS ต้นฉบับ `ฉันอยู่สองด้อม เมนของฉันคือมือกลอง` ถูกถอดเป็น `ฉันอยู่ 2 ดอมเมนของฉันคือมือกล่อง` ระบบส่ง `review_required: true` และเหตุผล `possible_word_confusion` ถูกต้อง จึงยังต้องให้ผู้ใช้ตรวจข้อความก่อนแปลหรือส่งจริง

สคริปต์ benchmark นำคำถอดเสียงนี้ไปแปลต่อโดยตรงเพื่อสำรวจผล ได้ `I'm in 2. My main is drummer.` แม้ขั้นตรวจความหมายรายงาน `revised` แล้ว กรณีนี้แสดงว่าการตรวจของ AI ยังช่วยกู้ความหมายจากต้นฉบับที่ถอดผิดได้ไม่ครบ ไม่ได้แสดงว่า UI ส่งข้อความที่ติดธงนี้อัตโนมัติ; การหยุดรอให้ตรวจข้อความของ UI ผ่านชุดทดสอบจำลอง

ตัวอย่างเสียงแพ้ถั่วลิสงและค่าโดยสาร 150 ไม่ใช่ 50 ผ่านการถอดและรักษาใจความในตัวอย่างที่ลอง แต่เป็นเสียงสังเคราะห์ที่ชัด ไม่ใช่ไมค์/สำเนียง/เสียงรบกวนจริง

หลักฐาน: [features-live.json](features-live.json)

### 2. บริการผู้ช่วย/ตรวจทานยังล้มเหลวเป็นครั้งคราว

- `/api/assist` action `source_info` ตอบ HTTP 503 ว่า `ข้อมูลจากผู้ช่วยไม่สมบูรณ์ กรุณาลองอีกครั้ง` หนึ่งครั้ง หลังลองใหม่ตอบ 200 ได้ตัวอย่างสองประโยค
- `/api/analyze` และ `/api/compare` ตอบ HTTP 429 พร้อม `retry_after` 3 และ 1 วินาทีตามลำดับ หลังเว้นระยะแล้วลองใหม่สำเร็จทั้งคู่
- ไม่พบ 429 ในการแปลรูป/เอกสาร/เสียงชุดนี้ แต่ไม่ใช่หลักฐานว่าข้อจำกัดโควตาหายไป

หลักฐาน: [api-live.json](api-live.json) เก็บทั้งครั้งที่ล้มเหลวและ retry ไม่ได้นับเฉพาะครั้งสำเร็จ

### 3. โปรเซส Flask เดิมยังไม่โหลด backend ล่าสุด

การเรียกจริงในรอบนี้:

| URL | ผล |
| --- | --- |
| `http://127.0.0.1:5000/sw.js` (โปรเซสเดิม) | HTTP 404 |
| `http://127.0.0.1:5001/sw.js` (โปรเซสใหม่จาก working tree) | HTTP 200 |

โค้ด route มีอยู่ที่ `app.py:478` จึงควรรีสตาร์ตโปรเซสเดิมเมื่อจะใช้ backend ล่าสุด ไม่ได้หยุดหรือแทนที่โปรเซสของผู้ใช้ระหว่างการตรวจ ชุด browser ในรายงานใช้โปรเซสใหม่พอร์ต 5001

### 4. ปุ่มแนะนำคำตอบถูกตัดขอบในหน้าจอมือถือบางกรณี

- ทำซ้ำ: interface อังกฤษ → โหมด Northern Thai → ข้อความสั้นพร้อมตัวอย่างประโยค → viewport 390×844
- `.output-scroll`: `clientHeight=231`, `scrollHeight=236` ทำให้ท้ายปุ่ม Suggest 3 replies ถูกตัด 5 px จนกว่าจะเลื่อน
- Assertion: `tests/browser/dialect-layout.cjs:97`; layout ที่เกี่ยวข้อง `static/style.css:4761`
- การตรวจวินิจฉัยที่ข้ามเฉพาะ assertion นี้ผ่านเงื่อนไขที่เหลือของขนาดจอ ภาษา รายละเอียด การยืนยันความหมาย และ focus แต่ไม่นับเป็นการผ่านชุดทดสอบเดิม

ภาพ: [dialect-overflow-en-390.png](dialect-overflow-en-390.png)

### 5. เครื่องมือคะแนน blind คืน kappa ผิดในกรณีข้อมูลหมวดเดียว

`scripts/blind_evaluation.py:182–183` คืน `1.0` เมื่อผู้ประเมินสองคนเลือก label เดียวกันทุกข้อ เช่น:

```python
cohen_kappa(["tie", "tie"], ["tie", "tie"])  # ปัจจุบันได้ 1.0
```

กรณีนี้ observed agreement และ expected agreement เท่ากับ 1 ทั้งคู่ สูตร `(observed - expected) / (1 - expected)` จึงเป็น `0/0` ควรรายงาน `None`/undefined ตาม docstring และแยก raw agreement 100% ออกจาก kappa ที่คำนวณไม่ได้ ไม่ควรสรุปว่าคะแนนหลังหักโอกาสตรงกันโดยบังเอิญสมบูรณ์แบบ ยังไม่มี test ครอบคลุมกรณีนี้

ปัญหาอยู่ในเครื่องมือประเมิน ไม่กระทบ endpoint แปลโดยตรง

### 6. คู่มือผู้ใช้ยังอ้างปุ่มที่ลบแล้ว

`docs/USER_GUIDE.md:24` ยังบอกให้กดปุ่ม “ตรวจทานโดย AI” เพื่อกางเครื่องมือ แต่ปัจจุบัน Why this? / Check translation / Deep review แสดงโดยตรงแล้ว

## การทดสอบบริการจริงรอบนี้

| ส่วน | ผลและขอบเขต |
| --- | --- |
| ข้อความ Business | 200: นัดเจอที่สถานีพรุ่งนี้ 9 โมง คงสถานที่/เวลา |
| Live Chat | 200: ข้อความขอบคุณและนัดพรุ่งนี้พร้อมบริบทสนทนา |
| ตัวอย่างประโยค / อธิบาย / ตรวจคำแปล / 3 คำตอบ | ทุก action ได้ 200 ในที่สุด; source_info ครั้งแรก 503 |
| Deep review / เปรียบเทียบ | ครั้งแรก 429; retry ได้ 200; เปรียบเทียบ Hello กับ Goodbye เลือกความหมายคำทักทายได้ |
| เอกสาร TXT → แปล | 200 ทั้ง extract/translate; คงทั้ง 3 บรรทัด ความหมายยังไม่ได้ซื้อ 50 ไม่ใช่ 5 คน และทายาบนแผล |
| รูปสังเคราะห์ไทย → อังกฤษ | 200; OCR/แปลครบ 4 พื้นที่ คงราคา 1,250 และประกัน 2 ปี |
| เสียงอ่าน/ถอดเสียง → แปล | สำเร็จครบ 3 ตัวอย่าง; สแลงผิดตามรายละเอียดด้านบน |

อ่านหลักฐานดิบเพื่อประเมินความหมายเองได้ที่ [api-live.json](api-live.json) และ [features-live.json](features-live.json) ไม่มีข้อมูลผู้ใช้จริงหรือ API key ในไฟล์เหล่านี้

การวัด controlled performance ด้วย provider จำลอง 50 ms ต่อ chunk พบข้อมูลครบและลำดับถูกต้อง แต่ตัวอย่าง 3 chunks ครั้งเดียวได้ serial 0.1503s และเส้นทางแอป 0.1722s จึงใช้ผลนี้อ้างว่าเร็วขึ้นไม่ได้: [performance-controlled.json](performance-controlled.json)

## สิ่งที่ยังไม่ยืนยัน

- ยังไม่มีผล blind rating จากผู้ประเมินอิสระใน `reports/blind-evaluation`; มีเพียงชุด 60 เคสและเครื่องมือ
- `data/real-media` ยังไม่มี manifest/สื่อจริงและยังไม่มีผล `reports/real-media`; รูปและเสียงรอบนี้เป็นสังเคราะห์
- ยังไม่ได้ตรวจ deployed Vercel, concurrency/load บน production, Safari/Firefox, โทรศัพท์จริง หรือไมค์/กล้องจริง
- เส้นทาง OCR บน Vercel ต่างจาก local Paddle ผล local จึงไม่ยืนยัน production OCR
- ไม่มี CI configuration ใน repository ที่ตรวจพบ การรัน checks ยังทำตามคำสั่งด้วยตนเอง
- ผล unit/browser ที่ mock AI ยืนยันพฤติกรรม validation, การยกเลิก/แยกข้อมูล, rendering และ error handling ไม่ใช่ความแม่นยำคำแปลทั้ง 113 ภาษา
- รอบนี้เป็นการตรวจการทำงานและความพร้อม ไม่ใช่ security audit หรือ penetration test

## คำสั่งหลักสำหรับทำซ้ำ

```sh
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m ruff check .
.venv/bin/python -m ruff format --check .
.venv/bin/python -m pip check
npm run check
npm run typecheck
npm run format:check
PORT=5001 .venv/bin/python app.py
# อีก terminal:
TRANSLATOR_TEST_URL=http://127.0.0.1:5001 \
LD_LIBRARY_PATH=/tmp/translator-browser-libs/extracted/usr/lib/x86_64-linux-gnu \
npm run test:browser
.venv/bin/python scripts/build_vercel.py
```

`npm run test:browser` หยุดเมื่อชุดใดล้มเหลว รอบตรวจนี้จึงรันทั้ง 23 scripts แยกกันเพื่อเก็บผลทั้งหมด โดยไม่แก้ assertion ให้ผลเป็นผ่าน

การทดสอบบริการจริงใช้โควตาผู้ให้บริการ; สคริปต์รูป/เอกสาร/เสียงที่ใช้คือ `scripts/benchmark_feature_quality.py --live` ส่วน API สั้น ๆ ส่งผ่าน Flask พอร์ต 5001 และเก็บผลไว้ในรายงานนี้
