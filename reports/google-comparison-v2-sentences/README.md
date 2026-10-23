# เทียบประโยคใหม่ 14 ข้อหลังปรับ

Google มาจากหน้าเว็บจริงแบบไม่ล็อกอิน ทุกภาพแสดง Advanced ทั้งสองระบบรับข้อความและคู่ภาษาเดียวกัน ไม่มีคำใบ้ถิ่น คลังคำ หรือประวัติสนทนา แอปใช้ Natural / General / Text, bypass cache, gpt-oss-120b และ reasoning medium ผลเป็นการอ่านเทียบโดยผู้ช่วย ไม่ใช่ผลตัดสินของผู้ประเมินอิสระหรือคะแนนความแม่นยำโดยรวม

ประโยคและเกณฑ์ความหมายใน cases.json ถูกเขียนก่อนแก้ implementation และยังไม่ได้เรียกโมเดลกับประโยคเหล่านี้ระหว่างปรับ ใช้ประเมินเพิ่มเติมโดยไม่แก้โค้ดแอประหว่างเก็บผล แต่ผู้พัฒนาเป็นผู้เลือกโจทย์และตัดสินด้วย จึงไม่ใช่ blind/held-out benchmark อย่างเป็นทางการ

## สรุปเชิงคุณภาพ

- แอปชัดกว่า: 7 ข้อ
- ใกล้เคียง: 5 ข้อ
- มีปัญหาความหมายทั้งคู่: 1 ข้อ
- ทั้งคู่ยังควรปรับความลื่นไหล: 1 ข้อ

## ผลประโยคเต็ม

| ข้อ / ภาพ Google | ต้นฉบับ | Google | แอปหลังปรับ | ความเห็น |
|---|---|---|---|---|
| [01-travel-condition](01-travel-condition.png) | พรุ่งนี้ถ้ารถไฟเที่ยวแรกยกเลิก ช่วยจองรถบัสให้สองที่ แต่ยังไม่ต้องชำระเงินนะครับ | Tomorrow if the first train is cancelled. Please help reserve two buses. But you don't have to pay yet. | If the first train tomorrow gets cancelled, please reserve two seats on a bus, but you don’t need to pay yet. | แอปชัดกว่า — two seats on a bus รักษาจำนวนที่นั่ง Google two buses เปลี่ยนเป็นจำนวนรถ |
| [02-appointment-change](02-appointment-change.png) | ขอเลื่อนนัดจากบ่ายสามเป็นบ่ายสองครึ่งวันพฤหัสบดีหน้า ส่วนสถานที่ยังเหมือนเดิมครับ | I would like to postpone the appointment from 3:00 p.m. to 2:30 p.m. next Thursday. The location is still the same. | I’d like to move the appointment from 3 p.m. to 2:30 p.m. next Thursday. The location stays the same. | แอปชัดกว่า — move ถูกกว่า postpone เมื่อเปลี่ยนจาก 3pm เป็น 2:30pm ซึ่งเร็วขึ้น ทั้งคู่คงเวลาตัวเลข |
| [03-polite-pass](03-polite-pass.png) | ร้านนี้ไม่ได้แย่นะ แต่ถ้าต้องต่อคิวนานขนาดนั้น ผมคงขอผ่าน | This shop isn't bad. But if I had to queue for that long, I would probably pass. | This place isn’t bad, but if I have to wait that long in line, I’d probably pass. | ใกล้เคียง — ทั้งคู่คงว่าไม่แย่ แต่ผู้พูดขอผ่านหากคิวยาว แอป place กว้างกว่า shop ตามบริบทที่ยังไม่ระบุชนิดร้าน |
| [04-unseen-thai-idiom](04-unseen-thai-idiom.png) | เขาเป็นญาติของผู้จัดการ เรื่องนี้เลยลูบหน้าปะจมูก จะตรวจสอบตรง ๆ ก็ลำบาก | He is the manager's relative. For this matter, I rubbed my face and nose, and it was difficult to directly examine it. | He's the manager's relative, so he's getting a free pass. Investigating it directly would be difficult. | มีปัญหาความหมายทั้งคู่ — Google แปลสำนวนเป็นการแตะหน้า/จมูก แอปเข้าใจปัญหาเส้นสายมากขึ้นแต่ getting a free pass เติมผลลัพธ์ว่าได้รับการยกเว้น ซึ่งต้นฉบับยังไม่ได้ยืนยัน ทั้งคู่ยังควรแก้ |
| [05-tentative-promise](05-tentative-promise.png) | ผมไม่ได้รับปากว่าจะเสร็จวันนี้นะครับ แค่บอกว่าจะลองทำให้ทัน | I didn't promise to finish today. Just said I'll try to make it in time. | I didn't promise it would be finished today—just that I'd try to get it done on time. | ใกล้เคียง — ทั้งคู่แยกการรับปากว่าจะเสร็จออกจากแค่จะพยายามทำให้ทันได้ |
| [06-no-pressure](06-no-pressure.png) | ถ้าคุณยังไม่สะดวกตอบตอนนี้ ไว้พรุ่งนี้ค่อยคุยกันก็ได้ ไม่ต้องเกรงใจ | If you are not comfortable answering now. We can talk tomorrow. Don't be considerate. | If you can’t reply right now, we can talk tomorrow instead. No need to feel obliged. | แอปชัดกว่า — No need to feel obliged ใกล้เจตนาไม่ต้องเกรงใจ มากกว่า Don’t be considerate ที่กลับกลายเป็นไม่ต้องเอาใจใส่ผู้อื่น |
| [07-indirect-draft-request](07-indirect-draft-request.png) | I was wondering if you could take a look at the draft before I send it to the client. | ฉันสงสัยว่าคุณช่วยดูแบบร่างก่อนที่จะส่งไปให้ลูกค้าได้ไหม | คุณช่วยดูร่างก่อนที่ฉันจะส่งให้ลูกค้าได้ไหม | แอปชัดกว่า — แอปเป็นคำขอให้ช่วยดูร่างตามหน้าที่ของ I was wondering ส่วน Google ยังใช้ ฉันสงสัย โดยตรง |
| [08-refund-status](08-refund-status.png) | Please bear with me while I check whether the refund has gone through. | โปรดอดทนกับฉันในขณะที่ฉันตรวจสอบว่าการคืนเงินได้ผ่านไปแล้วหรือไม่ | กรุณารอสักครู่ขณะฉันตรวจสอบว่าเงินคืนได้ผ่านหรือยัง. | ทั้งคู่ยังควรปรับความลื่นไหล — ทั้งคู่ยังสื่อว่ากำลังตรวจสถานะได้ แต่ เงินคืนได้ผ่าน/การคืนเงินได้ผ่านไปแล้ว ไม่ลื่นไหล ควรเป็น ตรวจสอบว่าดำเนินการคืนเงินสำเร็จแล้วหรือยัง |
| [09-unless-cancel](09-unless-cancel.png) | You don't have to cancel the order unless the supplier confirms that it won't arrive on time. | คุณไม่จำเป็นต้องยกเลิกคำสั่งซื้อ เว้นแต่ซัพพลายเออร์จะยืนยันว่าจะมาถึงไม่ตรงเวลา | คุณไม่จำเป็นต้องยกเลิกคำสั่งซื้อ เว้นแต่ผู้จัดจำหน่ายยืนยันว่าจะไม่มาถึงตรงเวลา. | ใกล้เคียง — ทั้งคู่รักษาข้อยกเว้น supplier ยืนยันว่าจะมาถึงไม่ทัน เป็นเงื่อนไขการยกเลิกได้ |
| [10-cover-shift](10-cover-shift.png) | I can cover your shift this Friday, but I can't promise to do it every week. | ฉันสามารถครอบคลุมกะของคุณได้ในวันศุกร์นี้ แต่ฉันไม่สามารถสัญญาว่าจะทำทุกสัปดาห์ได้ | ช่วยทำกะของคุณในวันศุกร์นี้ได้ แต่ไม่สามารถสัญญาว่าจะทำทุกสัปดาห์ได้. | แอปชัดกว่า — แอปตีความ cover a shift เป็นการช่วยทำกะ Google ยังใช้ ครอบคลุมกะ ตามตัวอักษร |
| [11-no-conclusion](11-no-conclusion.png) | Let's not jump to conclusions; we haven't heard her side of the story yet. | อย่าเพิ่งด่วนสรุป เรายังไม่เคยได้ยินเรื่องราวของเธอเลย | อย่ารีบสรุปกันเลย; เรายังไม่ได้ฟังมุมมองของเธอเลย. | แอปชัดกว่า — แอปเก็บมุมมองของเธอและการยังไม่ได้ฟัง Google เรื่องราวของเธอ/ไม่เคยได้ยิน กว้างและแข็งกว่าเล็กน้อย จัดเป็นความต่างด้านการใช้คำมากกว่าความผิดรุนแรง |
| [12-fee-exception](12-fee-exception.png) | The new fee applies only to bookings made after June 1, not to existing reservations. | ค่าธรรมเนียมใหม่มีผลกับการจองที่ทำหลังวันที่ 1 มิถุนายนเท่านั้น ไม่รวมกับการจองที่มีอยู่ | ค่าธรรมเนียมใหม่จะใช้เฉพาะการจองที่ทำหลังวันที่ 1 มิถุนายนเท่านั้น ไม่รวมการจองที่มีอยู่เดิม. | ใกล้เคียง — ทั้งคู่รักษาหลังวันที่ 1 มิถุนายน และยกเว้นการจองเดิม ไม่เปลี่ยนเป็นตั้งแต่วันที่ 1 |
| [13-northern-sentence](13-northern-sentence.png) | เปิ้นบอกว่าวันนี้ฝนจะตก ถ้าจะออกไปกาดก็เอาจ้องไปตวยเน้อ | Pen said it will rain today. If you want to go out, just take it and stare at it. | They said it’s going to rain today. If you’re heading to the market, bring an umbrella with you, okay. | แอปชัดกว่า — แอปได้ตลาดและร่มพร้อมเงื่อนไขฝน Google กลายเป็นชื่อ Pen ตัดตลาดออก และแปลจ้องเป็น stare |
| [14-isan-question](14-isan-question.png) | เจ้ากินข้าวแล้วบ่ ถ้ายังบ่กินก็มากินนำกันเด้อ | Have you eaten yet? If you haven't eaten yet, come and eat. | Have you eaten yet? If not, come and eat together, okay? | ใกล้เคียง — ทั้งคู่คงคำถามและเชิญมากินเมื่อยังไม่ได้กิน แอปเก็บ together ชัดกว่า แต่ไม่ถือว่าต่างพอจะชี้ขาด |

## หลักฐานและข้อจำกัด

- `results.json` เก็บผลดิบ สถานะตรวจทาน เวลา และ code fingerprint; `cases.json` เก็บโจทย์/เกณฑ์; `assessment.json` เก็บความเห็น ไม่ได้ให้โมเดลของแอปตัดสินว่าใครชนะ
- รูป PNG เป็นภาพจริงจาก Google และ `source_fields` ในผลดิบตรวจว่าข้อความบนหน้า Google ตรงกับคำขอ
- ไม่เอาเวลาเว็บ Google ที่โหลดหน้าใหม่มาเทียบเป็นอันดับความเร็วกับ API ของแอป
- ยังไม่เทียบเสียง OCR รูปภาพ เอกสารยาว หรือภาษาอื่น และไม่ได้ใช้ข้อเหล่านี้วัดความแม่นยำเป็นเปอร์เซ็นต์
- ทั้ง 14 ข้อได้ HTTP 200 โดยเว้นช่วง 12 วินาทีระหว่างข้อ เพื่อลดการชนโควตา ไม่ได้จำลองผู้ใช้พร้อมกันจำนวนมาก

ดู[ภาพรวมผลก่อน–หลัง](../google-comparison-v2/README.md) และ[ผลรอบแรก](../google-comparison/README.md)
