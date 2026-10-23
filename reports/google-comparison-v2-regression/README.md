# เทียบซ้ำ 12 ข้อเดิมหลังปรับ

Google มาจากหน้าเว็บจริงแบบไม่ล็อกอิน ทุกภาพแสดง Advanced ทั้งสองระบบรับข้อความและคู่ภาษาเดียวกัน ไม่มีคำใบ้ถิ่น คลังคำ หรือประวัติสนทนา แอปใช้ Natural / General / Text, bypass cache, gpt-oss-120b และ reasoning medium ผลเป็นการอ่านเทียบโดยผู้ช่วย ไม่ใช่ผลตัดสินของผู้ประเมินอิสระหรือคะแนนความแม่นยำโดยรวม

ข้อเหล่านี้เคยเห็นผลแล้วและใช้ปรับระบบ จึงใช้ยืนยันการแก้ regression เท่านั้น ห้ามตีความเป็นผล generalization ของโมเดล

## สรุปเชิงคุณภาพ

- ใกล้เคียง: 7 ข้อ
- แอปชัดกว่า: 4 ข้อ
- แอปชัดกว่า แต่มีข้อสังเกต: 1 ข้อ

## ผลประโยคเต็ม

| ข้อ / ภาพ Google | ต้นฉบับ | Google | แอปหลังปรับ | ความเห็น |
|---|---|---|---|---|
| [01-routine](01-routine.png) | พรุ่งนี้ร้านเปิดกี่โมงครับ | What time does the shop open tomorrow? | What time does the shop open tomorrow? | ใกล้เคียง — ร้าน ไม่ถูกสมมติเป็น restaurant แล้ว ทั้งคู่ใช้ shop |
| [02-indirect-request](02-indirect-request.png) | ถ้าสะดวก รบกวนส่งใบเสร็จให้หน่อยนะครับ | If convenient, please send me the receipt. | If it's convenient, could you please send the receipt? | ใกล้เคียง — คำขอสุภาพและเงื่อนไขเมื่อสะดวกใกล้เคียงกัน |
| [03-idiom](03-idiom.png) | งานนี้เขาทำแบบผักชีโรยหน้า | This time, he made it with coriander sprinkled on top. | He did this work just for show. | แอปชัดกว่า — แอปถ่ายทอดสำนวนเป็นการทำงานให้ดูดี Google ยังเป็นผักชีจริง ข้อนี้ใช้ปรับหมายเหตุภาษาแล้ว จึงเป็น regression |
| [04-negation](04-negation.png) | อย่าโอนเงินจนกว่าจะได้รับใบแจ้งหนี้ | Do not transfer money until you receive the invoice. | Don't transfer the money until you receive the invoice. | ใกล้เคียง — เงื่อนไขห้ามโอนก่อนรับ invoice ถูกทั้งคู่ |
| [05-numbers-time](05-numbers-time.png) | นัดวันที่ 24 ตุลาคม เวลา 18:45 น. ค่ามัดจำ 1,500 บาท เหลือจ่าย 750 บาท | Appointment on October 24 at 6:45 p.m. Deposit 1,500 baht, remaining payment 750 baht. | Appointment on October 24 at 18:45. Deposit: 1,500 baht. Remaining balance: 750 baht. | ใกล้เคียง — วันที่ เวลา เงินมัดจำ และยอดคงเหลือถูกทั้งคู่ รูปแบบเวลา 18:45 กับ 6:45pm เท่ากัน |
| [06-ambiguous-pronouns](06-ambiguous-pronouns.png) | เขาบอกว่าเขาจะจัดการให้ | He said he would take care of it. | He said he'd take care of it. | ใกล้เคียง — คงคำกล่าวและไม่เติมว่าสิ่งที่จะจัดการคืออะไร |
| [07-informal-metaphor](07-informal-metaphor.png) | วันนี้โดนหัวหน้าสาดงานจนหัวหมุน | Today, my boss threw me at work until my head was spinning. | Today the boss piled work on me until my head was spinning. | แอปชัดกว่า — แอปใช้ piled work on me และ head was spinning เป็นประโยคงานที่สื่อความท่วมท้นได้ ส่วน Google ใช้ threw me at work |
| [08-northern-thai](08-northern-thai.png) | กิ๋นข้าวแล้วกา | Eat rice and check. | Have you eaten rice yet? | แอปชัดกว่า — แอปคงรูปคำถาม Have you eaten rice yet? Google ยังเป็นคำสั่ง Eat rice and check. ข้อนี้ใช้พัฒนาหมายเหตุภาษาแล้ว |
| [09-english-idiom](09-english-idiom.png) | Could you give me a hand with these boxes? | คุณช่วยฉันด้วยกล่องพวกนี้หน่อยได้ไหม? | ช่วยยกกล่องเหล่านี้ให้หน่อยได้ไหม? | แอปชัดกว่า แต่มีข้อสังเกต — แอปเป็นไทยที่ใช้พูดได้ แต่ยังเดาว่าต้องยกกล่อง ต้นฉบับอาจเป็นการช่วยแพ็กหรือจัดกล่องได้ |
| [10-polite-refusal](10-polite-refusal.png) | I'm afraid we won't be able to make it tonight. | ฉันกลัวว่าคืนนี้เราจะไปไม่ได้ | เกรงว่าเราจะไม่สามารถมาคืนนี้ได้ | แอปชัดกว่า — แอปใช้ เกรงว่า โดยไม่ใส่ ผม/ดิฉัน แต่การตรวจเพิ่มเติมรอบนี้ unavailable จึงไม่อ้างว่าได้ยืนยันคำแปล |
| [11-frequency](11-frequency.png) | Water the plants every other day, not twice a day. | รดน้ำต้นไม้วันเว้นวัน ไม่ใช่วันละสองครั้ง | รดน้ำต้นไม้วันเว้นวัน ไม่ใช่วันละสองครั้ง。 | ใกล้เคียง — ทั้งคู่ใช้ วันเว้นวัน ถูกแล้ว แอปยังมีเครื่องหมาย 。 ท้ายข้อความ ซึ่งควรปรับรูปแบบต่อ |
| [12-deadline](12-deadline.png) | The deadline has been moved up from Friday to Wednesday. | กำหนดเวลาถูกเลื่อนจากวันศุกร์เป็นวันพุธ | กำหนดส่งถูกย้ายจากวันศุกร์เป็นวันพุธ. | ใกล้เคียง — ทั้งคู่คงการเปลี่ยนจากศุกร์เป็นพุธได้ |

## ตัวอย่างก่อน–หลัง

| ต้นฉบับ | แอปก่อนปรับ | แอปหลังปรับ |
|---|---|---|
| งานนี้เขาทำแบบผักชีโรยหน้า | They made it with cilantro sprinkled on top. | He did this work just for show. |
| กิ๋นข้าวแล้วกา | I've already eaten. | Have you eaten rice yet? |
| I'm afraid we won't be able to make it tonight. | ผม/ดิฉันกลัวว่าเราจะไม่สามารถมาคืนนี้ได้. | เกรงว่าเราจะไม่สามารถมาคืนนี้ได้ |
| Water the plants every other day, not twice a day. | รดน้ำต้นไม้ทุกวันสลับวัน ไม่ใช่วันละสองครั้ง. | รดน้ำต้นไม้วันเว้นวัน ไม่ใช่วันละสองครั้ง。 |

## หลักฐานและข้อจำกัด

- `results.json` เก็บผลดิบ สถานะตรวจทาน เวลา และ code fingerprint; `cases.json` เก็บโจทย์/เกณฑ์; `assessment.json` เก็บความเห็น ไม่ได้ให้โมเดลของแอปตัดสินว่าใครชนะ
- รูป PNG เป็นภาพจริงจาก Google และ `source_fields` ในผลดิบตรวจว่าข้อความบนหน้า Google ตรงกับคำขอ
- ไม่เอาเวลาเว็บ Google ที่โหลดหน้าใหม่มาเทียบเป็นอันดับความเร็วกับ API ของแอป
- ยังไม่เทียบเสียง OCR รูปภาพ เอกสารยาว หรือภาษาอื่น และไม่ได้ใช้ข้อเหล่านี้วัดความแม่นยำเป็นเปอร์เซ็นต์
- มี HTTP 429 สองครั้งแรกในข้อ 11/12 และเว้นช่วงเรียกใหม่จนได้ผลครบ ประวัติการเรียกเดิมยังอยู่ใน app_attempts; ข้อ 10 ได้คำแปลแต่สถานะตรวจเพิ่มเติม unavailable ผลนั้นไม่ได้ถูกอ้างว่าผ่านการตรวจ

ดู[ภาพรวมผลก่อน–หลัง](../google-comparison-v2/README.md) และ[ผลรอบแรก](../google-comparison/README.md)
