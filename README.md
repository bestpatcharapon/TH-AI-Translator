# TH AI Translator

เว็บแอปแปลภาษาที่เน้นภาษาไทยพูดจริง สํานวน สแลง และภาษาถิ่น (Flask + Groq) แปลข้อความ 113 ภาษา รูปภาพ เอกสาร และแชทสดสองภาษา ใช้ได้ทั้งมือถือและเดสก์ท็อป และติดตั้งเป็นแอป (PWA) ได้

- 👤 **ผู้ใช้งาน:** [คู่มือการใช้งาน](docs/USER_GUIDE.md)
- 🛠️ **นักพัฒนา:** [คู่มือนักพัฒนาแบบละเอียด](docs/DEVELOPMENT.md) (การตั้งค่า `.env`, OCR, Vercel, สถาปัตยกรรม)
- 📊 **คุณภาพ:** [ผลเทียบ Google Translate](reports/google-comparison-v2/README.md) · [ชุดประเมินแบบ blind](reports/blind-evaluation/README.md) · [ทดสอบรูป/เสียงจริง](data/real-media/README.md)

## เริ่มใช้งานเร็ว

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ใส่ GROQ_API_KEY
python app.py          # เปิด http://127.0.0.1:5000
```

แปลรูปบนเครื่องตัวเองต้องติดตั้ง OCR เพิ่ม (`python scripts/setup_ocr.py` หรือ `python scripts/setup_paddle_ocr.py`) ดูรายละเอียดใน[คู่มือนักพัฒนา](docs/DEVELOPMENT.md#ติดตั้ง-ocr-สําหรับแปลบนรูป)

## ตรวจสอบ

```bash
pip install -r requirements-dev.txt && npm ci
python -m unittest discover -s tests
ruff check . && ruff format --check .
npm run check && npm run typecheck && npm run format:check
npm run test:browser   # เปิด Flask ไว้อีก terminal ก่อน
```

ชุดทดสอบไม่ใช้โควตา API การวัดคุณภาพคําแปลจริงต้องสั่ง `--live` แยกต่างหาก (ดูลิงก์ด้านคุณภาพด้านบน)

## ความเป็นส่วนตัว

ข้อความ รูป และเสียงถูกส่งไปยังผู้ให้บริการ AI (Groq และ Gemini ถ้าเปิดใช้) เพื่อแปล ส่วนเสียงอ่านส่งไปที่ Microsoft Edge TTS ไฟล์ไม่ถูกบันทึกลงดิสก์ของเซิร์ฟเวอร์ ประวัติและคลังคําเก็บเฉพาะในเบราว์เซอร์ Service worker เก็บไว้แค่ไฟล์หน้าเว็บเท่านั้น ไม่เก็บข้อความหรือคําแปล
