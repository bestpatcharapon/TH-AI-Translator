# แก้ Image บน Vercel ที่ไม่มี native OCR

อาการในภาพคือ `ocr_runtime()` หา Tesseract ไม่พบ ขณะที่ `vercel.json` ตั้งใจไม่นำ `.ocr/**` เข้าฟังก์ชัน การทดสอบบนเครื่องที่ติดตั้ง OCR แล้วจึงไม่พบข้อจำกัดนี้ในรอบก่อน

แก้ให้ `PHOTO_OCR_BACKEND=auto` เลือก `vision` เมื่อ `VERCEL=1` และเลือก `local` บนเครื่องทั่วไป บน Vercel ใช้ RapidOCR detector/ONNX ที่มากับ dependency หาเฉพาะตำแหน่งข้อความ จากนั้นอ่านภาพตัดด้วย AI และแปลตามพิกัดจริง ไม่ต้องใช้ไฟล์ใน `.ocr` หรือเรียก Tesseract/Paddle

การอ่านในโหมดนี้ครอบคลุมรูปเล็กและข้อความเกิน 30 ส่วน สูงสุด 160 ส่วน โดยแบ่งภาพตัดความละเอียดสูงเป็นชุดละ 5 ส่วน ถ้าเกินขีดจำกัดหรือไม่มีข้อความจะคืนข้อผิดพลาดก่อนเรียก AI บริเวณตัวเลขล้วนยังเก็บพิกเซลต้นฉบับ

เพิ่มทางเลือก `PHOTO_READING_PROVIDER=gemini` ซึ่งต้องมี `GEMINI_API_KEY` และใช้ `GEMINI_PHOTO_MODEL` ค่าเริ่มต้น `gemini-3.5-flash-lite` การเลือกนี้ส่งภาพตัดไป Gemini และใช้โควตา Gemini ส่วนการแปลข้อความยังเป็น Groq ค่าเริ่มต้นยังเป็น `groq` เพื่อไม่เปลี่ยนผู้ให้บริการภาพโดยอัตโนมัติ

## หลักฐานและข้อจำกัด

- ชุด Python หลังแก้มี 219 รายการ รวม regression ใหม่ 6 รายการ ทดสอบการเลือก backend/ผู้ให้บริการ การไม่มี native binary รูปเล็ก ตัวเลข มากกว่า 30 ส่วน ขีดจำกัด และสถานะ backend
- Ruff และ format ผ่าน
- จำลอง `VERCEL=1` และบล็อกการเรียก Tesseract/Paddle ด้วย exception จากนั้นใช้ RapidOCR และบริการ AI จริง
- [ครั้งแรก](serverless-photo.json) ติด 429
- [Groq หลังรอ](serverless-photo-retry.json) และ [ภาพตัดความละเอียดสูง](serverless-photo-hires.json) ตอบ 200 แต่ยังอ่านคำไทยผิด 2 บรรทัด การตอบ 200 ไม่ใช่ความถูกต้องของ OCR
- [Gemini แบบ opt-in](serverless-photo-gemini.json) ตอบ 200 ใน 4.53 วินาที อ่านตรงต้นฉบับ 4/4 บรรทัดและแปลครบ 4 พื้นที่ เป็นรูปสังเคราะห์เพียงรูปเดียว ไม่ใช่ผลทดสอบเมนูจริงของผู้ใช้หรือทุกภาษา
- ยังไม่ได้ deploy หรือยืนยันการทำงานของเวอร์ชันนี้บน Vercel production

## นำไปใช้

นำโค้ดที่แก้ขึ้น deployment ใหม่ และตั้ง Environment Variables ของ Vercel:

```dotenv
PHOTO_OCR_BACKEND=vision
PHOTO_READING_PROVIDER=gemini
GEMINI_API_KEY=<คีย์ของคุณ ตั้งใน Vercel ไม่เก็บใน git>
```

ต้องมี `GROQ_API_KEY` เดิมสำหรับแปลด้วย หลัง deploy ตรวจ `/api/ocr-status` ว่า `photo_backend` เป็น `vision` หากไม่เลือก Gemini สามารถใช้ค่าเริ่มต้น Groq ได้ แต่พบข้อจำกัดการอ่านไทยดังหลักฐานด้านบน

Vercel ระบุว่า `VERCEL=1` ใช้ได้ทั้ง build/runtime เมื่อเปิด system environment variables: [เอกสาร Vercel](https://vercel.com/docs/environment-variables/system-environment-variables#vercel) การกำหนด `PHOTO_OCR_BACKEND=vision` เองทำให้ไม่ต้องพึ่งการตรวจตัวแปรนั้น
