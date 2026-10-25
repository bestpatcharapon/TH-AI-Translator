# ผลทดสอบรายประโยคหลังปรับ

Coding assistant qualitative review of source and output against prewritten checklists; not blind, native-speaker or independent human ratings.

Separate development iterations. Later targeted reruns must not be presented as a complete rerun of all 112 sentences or as a general accuracy percentage.

อ่านขอบเขต เวลา และข้อจำกัดใน [รายงานสรุป](README.md) สถานะ checked ของโมเดลไม่ใช่คำตัดสินความถูกต้อง

## after

| # | คำ/วลี | ต้นฉบับ | ผลจริง | ประเมินโดยผู้ช่วย | ข้อสังเกต |
|---|---|---|---|---|---|
| 1 | จึ้ง | ชุดที่เธอใส่วันนี้จึ้งมาก | Your outfit today looks amazing. | ความหมายใช้ได้ | — |
| 2 | ปัง | ร้านใหม่ของเขาปังตั้งแต่วันแรก | His new shop has been a hit since day one. | ความหมายใช้ได้ | — |
| 3 | เริ่ด | ไอเดียนี้เริ่ด ลองทำกันเลย | This idea is awesome—let's give it a try. | ความหมายใช้ได้ | — |
| 4 | ทำถึง | คอนเสิร์ตเมื่อคืนทีมงานทำถึงจริง ๆ | The team really delivered at last night’s concert. | ความหมายใช้ได้ | — |
| 5 | เอาอยู่ | งานยากขนาดนี้แต่เธอเอาอยู่ | This job is so tough, but you can handle it. | ความหมายใช้ได้ | — |
| 6 | เอาเรื่อง | ร้านเล็ก ๆ แต่ฝีมือเชฟเอาเรื่องนะ | A small place, but the chef’s skill is impressive. | ความหมายใช้ได้ | — |
| 7 | ตัวตึง | พี่เขาเป็นตัวตึงเรื่องแก้บั๊กของทีม | He's the team's go‑to bug‑fixer. | ความหมายใช้ได้ | — |
| 8 | ตัวแม่ | เรื่องแต่งหน้าเธอคือตัวแม่ของกลุ่ม | When it comes to makeup, she is the absolute queen of the group. | ความหมายใช้ได้ | — |
| 9 | ตัวพ่อ | เขาเป็นตัวพ่อเรื่องต่อรองราคา | He's the master of price negotiations. | ความหมายใช้ได้ | — |
| 10 | ตัวท็อป | บริษัทนี้รับแต่ตัวท็อปเข้าทีม | This company only brings top talent onto the team. | ความหมายใช้ได้ | — |
| 11 | ของจริง | ตอนแรกนึกว่าคุยโว พอเห็นฝีมือถึงรู้ว่าของจริง | At first I thought they were just bragging, but when I saw the skill, I realized it’s the real deal. | ความหมายใช้ได้ | — |
| 12 | ของแทร่ | ช่วยแก้ปัญหาได้ทุกครั้ง คนนี้ของแทร่ | They can solve any problem every time. This person is the real deal. | ควรปรับรายละเอียด/ภาษา | ของแทร่ถูกแล้ว แต่ any problem ขยายความว่าสามารถแก้ได้ทุกปัญหาเกินข้อความต้นทาง |
| 13 | อย่างเอา | โซโล่กีตาร์เมื่อกี้อย่างเอา | That guitar solo just now was fire. | ความหมายใช้ได้ | — |
| 14 | อย่างเทพ | เขาเล่นเกมนี้เก่งอย่างเทพ | He's godlike at this game. | ความหมายใช้ได้ | — |
| 15 | เมพ | ด่านยากขนาดนี้ยังผ่านได้ เมพจริง | A level this hard and you still cleared it—you're seriously godlike. | ความหมายใช้ได้ | — |
| 16 | สับ | วันนี้เธอเดินขึ้นเวทีแบบสับมาก | You walked onto the stage today and totally owned it. | ความหมายใช้ได้ | — |
| 17 | กินขาด | เรื่องแบตเตอรี่มือถือรุ่นนี้กินขาด | This phone model's battery is unbeatable. | ความหมายใช้ได้ | — |
| 18 | ยืนหนึ่ง | ร้านนี้ยืนหนึ่งเรื่องขนมในใจฉัน | This shop is my number one when it comes to sweets. | ความหมายใช้ได้ | — |
| 19 | มงลง | ตอบคำถามดีขนาดนี้ มงลงแน่นอน | With answers this good, you're definitely going to win the crown. | ความหมายใช้ได้ | — |
| 20 | ออร่าจับ | วันนี้แต่งตัวแล้วออร่าจับมาก | I dressed up today and I look so radiant. | ความหมายใช้ได้ | — |
| 21 | สาดไปสมาชิก | สาดไปสมาชิก | Go for it, buddy! | ความหมายใช้ได้ | — |
| 22 | จัดไป | อยากกินพิซซ่าใช่ไหม จัดไป เดี๋ยวสั่งให้ | You want pizza, right? Sure thing—I'll order it for you. | ความหมายใช้ได้ | — |
| 23 | จัดมา | มีข้อเสนออะไรจัดมาได้เลย เดี๋ยวช่วยดู | Just send any proposals you have, and I’ll take a look. | ความหมายใช้ได้ | — |
| 24 | ลุยเลย | เตรียมทุกอย่างพร้อมแล้ว ลุยเลย | Everything's ready. Let's go. | ความหมายใช้ได้ | — |
| 25 | เอาเลย | ถ้าชอบแบบนี้ก็เอาเลย ฉันไม่ติด | If you like it like that, go for it. I don't mind. | ความหมายใช้ได้ | — |
| 26 | เต็มที่เลย | พรุ่งนี้แข่งแล้ว เล่นให้เต็มที่เลยนะ | The match is tomorrow—give it your all! | ความหมายใช้ได้ | — |
| 27 | ใส่ให้สุด | รอบสุดท้ายแล้ว ใส่ให้สุด | This is the final round—give it your all. | ความหมายใช้ได้ | — |
| 28 | ไปให้สุด | เลือกทางนี้แล้วก็ไปให้สุด | Take this path and go all the way. | ความหมายใช้ได้ | — |
| 29 | ลุยให้ยับ | งานนี้เตรียมตัวมาดีแล้ว ลุยให้ยับ | I'm all set for this job—let's crush it. | ความหมายใช้ได้ | — |
| 30 | เดี๋ยวจัดให้ | อยากได้ไฟล์ต้นฉบับใช่ไหม เดี๋ยวจัดให้ | You want the original file, right? I’ll get it for you. | ความหมายใช้ได้ | — |
| 31 | ได้อยู่ | รูปนี้ได้อยู่ แต่เพิ่มแสงอีกหน่อยจะดี | The picture is fine, but a little more light would improve it. | ความหมายใช้ได้ | — |
| 32 | ได้หมด | จะกินร้านไหนก็ได้ ฉันได้หมด | Any restaurant is fine—I’m good with whatever you pick. | ความหมายใช้ได้ | — |
| 33 | ตามนั้น | ถ้าทุกคนสะดวกวันศุกร์ก็ตามนั้น | If everyone is available on Friday, let's go with that. | ความหมายใช้ได้ | — |
| 34 | ตามสะดวก | ไม่ต้องรีบตอบนะ ตอบตามสะดวกได้เลย | No rush—just reply whenever it's convenient. | ความหมายใช้ได้ | — |
| 35 | แล้วแต่เลย | เรื่องสีเสื้อแล้วแต่เธอเลย ฉันชอบทั้งสองสี | The shirt color is up to you—I like both colors. | ความหมายใช้ได้ | — |
| 36 | ว่ามา | มีอะไรอยากปรึกษาก็ว่ามา ฉันฟังอยู่ | If there's anything you want to talk about, just tell me—I'm listening. | ความหมายใช้ได้ | — |
| 37 | มาเลย | ถ้าพร้อมแข่งแล้วก็มาเลย | If you're ready to race, just come over. | ควรปรับรายละเอียด/ภาษา | race เจาะจงประเภทการแข่งขัน และ just come over ไม่ค่อยเก็บน้ำเสียงรับคำท้า |
| 38 | ไม่ติด | เลื่อนนัดเป็นบ่ายสองได้ ฉันไม่ติด | I can move the appointment to 2 pm. I'm not busy. | ความหมายใช้ได้ | — |
| 39 | ดีล | เธอทำสไลด์ ฉันนำเสนอ ตกลงไหม ดีล | You make the slides, I’ll present. Okay? Deal. | ความหมายใช้ได้ | — |
| 40 | จบที่นี่ | เรื่องที่ทะเลาะกันขอให้จบที่นี่ ไม่ต้องเอาไปพูดต่อ | Let this argument end here—don’t bring it up again. | ควรปรับรายละเอียด/ภาษา | don't bring it up again เน้นห้ามคุยเรื่องนี้อีก มากกว่าไม่เอาไปพูดต่อ ความหมายอาจซ้อนกันตามบริบท |
| 41 | นอย | เขาอ่านแชตแล้วไม่ตอบ ฉันนอยเลย | They read the chat and didn't reply, so I felt down. | ความหมายใช้ได้ | — |
| 42 | เฟล | เตรียมงานมาตั้งนานแต่โดนยกเลิก รู้สึกเฟลมาก | I’d been preparing for the event for a long time, but it got cancelled. I feel so let down. | ความหมายใช้ได้ | — |
| 43 | จอย | เมื่อคืนไปดูคอนเสิร์ตแล้วจอยมาก | I went to a concert last night and had a great time. | ความหมายใช้ได้ | — |
| 44 | ตุย | เดินขึ้นบันไดสิบชั้น เหนื่อยจะตุย | I walked up ten flights of stairs—I'm dead tired. | ความหมายใช้ได้ | — |
| 45 | ขิต | เห็นบิลค่าไฟแล้วแทบขิต | Seeing the electricity bill almost killed me. | ความหมายใช้ได้ | — |
| 46 | ขำจะขิต | คลิปนี้ขำจะขิต ดูวนไปสามรอบแล้ว | This clip is so funny it's killing me—I've watched it three times already. | ความหมายใช้ได้ | — |
| 47 | หัวร้อน | แพ้เกมติดกันสามตาแล้วเริ่มหัวร้อน | I've lost three games in a row and I'm starting to get angry. | ความหมายใช้ได้ | — |
| 48 | หัวจะปวด | ไฟล์หายก่อนส่งงานสิบนาที หัวจะปวด | The file disappeared ten minutes before I had to submit it—what a headache. | ความหมายใช้ได้ | — |
| 49 | ใจฟู | เพื่อนจำวันเกิดได้ แค่นี้ก็ใจฟูแล้ว | A friend remembered my birthday—just that makes me feel so happy. | ความหมายใช้ได้ | — |
| 50 | ใจบาง | เห็นแมวตัวเล็ก ๆ แล้วใจบางทุกที | Every time I see a tiny cat, my heart melts. | ความหมายใช้ได้ | — |
| 51 | ใจเหลว | เขายิ้มให้ทีเดียวฉันก็ใจเหลวแล้ว | He smiled just once, and I melted. | ความหมายใช้ได้ | — |
| 52 | ช็อตฟีล | กำลังเล่าเรื่องสนุกอยู่แต่เขาพูดช็อตฟีลเลย | I was telling a funny story, but he totally killed the vibe. | ความหมายใช้ได้ | — |
| 53 | อ่อม | โปรโมตว่าปังมาก แต่ดูของจริงแล้วอ่อม | It's promoted as amazing, but in reality it's underwhelming. | ความหมายใช้ได้ | — |
| 54 | บ้ง | โฆษณานี้บ้งตรงที่เอาความพิการมาล้อ | This ad is flawed because it makes fun of disability. | ความหมายใช้ได้ | — |
| 55 | บูด | หวังว่าจะสนุก แต่บทหนังบูดมาก | I was hoping it would be fun, but the script is really terrible. | ความหมายใช้ได้ | — |
| 56 | อิหยังวะ | จ่ายเงินแล้วแต่ระบบบอกยังไม่จ่าย อิหยังวะ | I already paid, but the system says it hasn't gone through. What the heck? | ความหมายใช้ได้ | — |
| 57 | ไปพักก่อน | บอกว่าฉันผิดทั้งที่ยังไม่อ่าน ไปพักก่อน | They say I'm wrong even though I haven't even read it. I'm going to take a break first. | ความหมายหลักผิด | สลับผู้ที่ยังไม่อ่าน และเปลี่ยนการบอกอีกฝ่ายให้หยุดเป็นผู้พูดขอพัก ตัวตรวจใช้งานไม่ได้ในรอบนี้ |
| 58 | ไหวไหม | ทำงานมาสิบชั่วโมงแล้ว ไหวไหม พักก่อนได้นะ | I've been working for ten hours already. Are you holding up? You can take a break first. | ความหมายหลักผิด | ผู้ทำงานสิบชั่วโมงกลายเป็น I แล้วถาม you ว่าไหวไหม ทั้งที่ไม่มีการเปลี่ยนประธานในต้นฉบับ |
| 59 | เอาดี ๆ | เอาดี ๆ นะ นัดพรุ่งนี้หรือมะรืนกันแน่ | Seriously, are we meeting tomorrow or the day after? | ความหมายใช้ได้ | — |
| 60 | จะเครซี่ | ประชุมพร้อมกันสามงาน ฉันจะเครซี่ | I have three meetings at the same time—I'm going crazy. | ความหมายใช้ได้ | — |
| 61 | โดนเท | นัดกันไว้แล้วแต่เขายกเลิกก่อนเจอสิบนาที ฉันโดนเทอีกแล้ว | We had plans, but they canceled ten minutes before we were supposed to meet. I got stood up again. | ความหมายใช้ได้ | — |
| 62 | นก | ชอบเขามานานแต่เขามีแฟนแล้ว นกอีกแล้วเรา | I've had a crush on him for so long, but he already has a girlfriend. Struck out again. | ควรปรับรายละเอียด/ภาษา | นกสื่อความผิดหวังถูกแล้ว แต่ girlfriend ระบุเพศของแฟนเกินข้อมูลต้นทาง |
| 63 | แห้ว | กดซื้อบัตรไม่ทัน แห้วเลย | I couldn't buy the ticket in time, so I missed out. | ความหมายใช้ได้ | — |
| 64 | มูฟออน | เลิกกันแล้วแต่ฉันยังมูฟออนไม่ได้ | We broke up, but I still can't move on. | ความหมายใช้ได้ | — |
| 65 | คลั่งรัก | เพื่อนคลั่งรักมาก พูดถึงแฟนทั้งวัน | My friend is totally smitten and talks about their partner all day. | ความหมายใช้ได้ | — |
| 66 | แอบแซ่บ | เขาสองคนแอบแซ่บกันแต่ไม่ยอมบอกใคร | The two of them are secretly getting together, but they won’t tell anyone. | ความหมายใช้ได้ | — |
| 67 | คนคุย | เขายังไม่ใช่แฟน เป็นแค่คนคุย | He's not my boyfriend, just someone I'm talking to. | ความหมายใช้ได้ | — |
| 68 | คุยเผื่อเลือก | ฉันอยากคุยจริงจัง ไม่อยากเป็นคนที่เธอคุยเผื่อเลือก | I want to have a serious conversation. I don’t want to be someone you keep as a backup. | ความหมายหลักผิด | ความตั้งใจคบจริงจังยังเป็น serious conversation แม้มีบริบทเก็บคนไว้เป็นตัวเลือกและสถานะ checked |
| 69 | หยอด | เขาชอบหยอดว่าฉันน่ารักทุกครั้งที่เจอ | He always says I'm cute whenever he sees me. | ความหมายใช้ได้ | — |
| 70 | อ่อย | ฉันแค่ยิ้มตามมารยาท ไม่ได้อ่อย | I was just smiling out of politeness, not trying to flirt. | ความหมายใช้ได้ | — |
| 71 | เต๊าะ | เพื่อนชอบเต๊าะพนักงานร้านกาแฟ | My friend likes to flirt with the coffee shop staff. | ความหมายใช้ได้ | — |
| 72 | จีบติด | จีบมาตั้งนาน ในที่สุดก็จีบติดแล้ว | I've been flirting for ages, and finally it worked. | ความหมายใช้ได้ | — |
| 73 | ติดเฟรนด์โซน | เขาบอกว่าเห็นฉันเป็นเพื่อน ฉันติดเฟรนด์โซนแล้ว | He said he sees me as a friend. I'm stuck in the friend zone. | ความหมายใช้ได้ | — |
| 74 | แพ้ทาง | ฉันแพ้ทางคนพูดเพราะและใจดีกับสัตว์ | I'm a sucker for people who speak gently and are kind to animals. | ความหมายใช้ได้ | — |
| 75 | ธงแดง | เขาขอดูมือถือและห้ามคุยกับเพื่อน แบบนี้ธงแดงนะ | He wants to see my phone and forbids me from talking to my friends— that's a red flag. | ความหมายใช้ได้ | — |
| 76 | ธงเขียว | เขารับฟังและเคารพเวลาส่วนตัวของฉัน ธงเขียวเลย | He listens and respects my personal time. That's a green flag. | ความหมายใช้ได้ | — |
| 77 | แกงเพื่อน | เพื่อนบอกว่าแต่งชุดแฟนซีมา สรุปมีฉันแต่งคนเดียว โดนแกงแล้ว | My friend said to wear fancy dress, but it turns out I was the only one. I got played. | ความหมายใช้ได้ | — |
| 78 | ปั่น | เขารู้อยู่แล้วแต่แกล้งถามเพื่อปั่นคนในกลุ่ม | He already knows, but pretends to ask just to stir up the group. | ความหมายใช้ได้ | — |
| 79 | ปั่นหัว | เขาบอกว่ารักแล้วก็หายไป อย่ามาปั่นหัวฉัน | He said he loved me and then vanished. Don't come trying to mess with my head. | ความหมายใช้ได้ | — |
| 80 | ทัวร์ลง | แบรนด์โพสต์ล้อเลียนลูกค้าจนทัวร์ลง | The brand posted a mocking message about its customers and got slammed online. | ความหมายใช้ได้ | — |
| 81 | ป้ายยา | เพื่อนป้ายยาหูฟังจนฉันกดซื้อเลย | My friend kept hyping the headphones, so I just bought them. | ความหมายใช้ได้ | — |
| 82 | โดนตก | ดูซีรีส์เรื่องเดียวก็โดนนักแสดงคนนี้ตกแล้ว | I watched just one series and already fell for this actor. | ความหมายใช้ได้ | — |
| 83 | ด้อม | คนในด้อมช่วยกันจัดงานวันเกิดให้นักร้อง | The fans in the fandom helped organize a birthday party for the singer. | ความหมายใช้ได้ | — |
| 84 | เมน | วงนี้ฉันชอบทุกคน แต่เมนคือมือกลอง | I like everyone in this band, but my bias is the drummer. | ความหมายใช้ได้ | — |
| 85 | ชิป | ฉันชิปตัวละครคู่นี้ แต่ไม่ได้บอกว่านักแสดงคบกันจริง | I ship this character couple, but I'm not saying the actors are actually dating. | ความหมายใช้ได้ | — |
| 86 | เรือแล่น | ตอนล่าสุดตัวละครคู่นี้จับมือกัน เรือแล่นแล้ว | In the latest episode, the two characters held hands— the ship has set sail. | ความหมายใช้ได้ | — |
| 87 | เรือแตก | บทเฉลยว่าตัวละครที่ฉันชิปเป็นพี่น้องกัน เรือแตกเลย | The answer says the characters I ship are siblings, so the ship is dead. | ควรปรับรายละเอียด/ภาษา | The answer says แข็งและไม่เหมาะเท่า the story reveals แต่ยังเก็บการเฉลยว่าเป็นพี่น้องและความหวังคนเชียร์คู่พังไว้ |
| 88 | ขิง | ซื้อคอมใหม่แล้วขิงเพื่อนใหญ่เลย | I bought a new computer and bragged to all my friends about it. | ควรปรับรายละเอียด/ภาษา | ขิงถูกเป็นอวดแล้ว แต่ all my friends เพิ่มขอบเขตว่าเพื่อนทุกคน |
| 89 | เกลือ | สุ่มตัวละครไปสิบครั้ง ได้แต่ตัวซ้ำ เกลือมาก | I pulled characters ten times and got nothing but duplicates. So unlucky. | ความหมายใช้ได้ | — |
| 90 | แบก | โปรเจกต์นี้เขาแบกคนเดียว ทั้งเขียนโค้ดทั้งนำเสนอ | They carried the whole project all by themselves, doing both the coding and the presentation. | ความหมายใช้ได้ | — |
| 91 | หิวแสง | อย่าเอาเรื่องคนอื่นมาโพสต์หิวแสงเลย | Don't post other people's stuff just to chase clout. | ความหมายใช้ได้ | — |
| 92 | แสงออกเท้า | ถ่ายรูปข้างเพื่อนที่แต่งเต็มแล้วฉันแสงออกเท้าเลย | I took a photo next to my friend who was all dressed up, and I ended up being completely outshone. | ความหมายใช้ได้ | — |
| 93 | งานเข้า | เผลอลบฐานข้อมูลจริง งานเข้าแล้ว | I accidentally deleted the real database. I'm in trouble now. | ความหมายใช้ได้ | — |
| 94 | งานงอก | แก้บั๊กหนึ่งจุดแล้วเจออีกสามจุด งานงอกเลย | I fixed one bug and then ran into three more. The work just keeps piling up. | ความหมายใช้ได้ | — |
| 95 | ไฟลนก้น | พรุ่งนี้ต้องส่งแต่ยังไม่เริ่ม ตอนนี้ไฟลนก้นแล้ว | I have to submit it tomorrow but haven’t started yet. I’m already feeling the deadline pressure. | ความหมายใช้ได้ | — |
| 96 | สมองไหล | อ่านโค้ดมาทั้งวันจนสมองไหลแล้ว ขอพักก่อน | I've been reading code all day and my brain's fried—I'm going to take a break. | ความหมายใช้ได้ | — |
| 97 | สมองตัน | คิดชื่อแอปมาสองชั่วโมงแล้วสมองตัน | I've been trying to come up with an app name for two hours, and my brain is fried. | ความหมายใช้ได้ | — |
| 98 | หมดแพสชัน | ยังชอบงานนี้อยู่ แค่เหนื่อย ไม่ได้หมดแพสชัน | I still like this job; I'm just tired and haven't lost my passion. | ความหมายใช้ได้ | — |
| 99 | แบตหมด | วันนี้คุยกับคนเยอะจนแบตหมด ขออยู่เงียบ ๆ ก่อน | I talked to a lot of people today and my battery's dead, so I need some quiet for now. | ความหมายใช้ได้ | — |
| 100 | หมดโควตาความอดทน | เตือนมาสามครั้งแล้ว ตอนนี้หมดโควตาความอดทน | I've warned you three times already, and now I'm out of patience. | ความหมายใช้ได้ | — |
| 101 | literal-สับ | สับหมูให้ละเอียดก่อนใส่กระทะ | Finely mince the pork before adding it to the pan. | ความหมายใช้ได้ | — |
| 102 | literal-เกลือ | ใส่เกลือ 10 กรัม อย่าใส่ 50 กรัม | Add 10 g of salt; don’t add 50 g. | ความหมายใช้ได้ | — |
| 103 | literal-แกง | เพื่อนทำแกงให้ฉันกิน ไม่ได้แกล้งฉัน | My friend made me curry, they weren't pranking me. | ความหมายใช้ได้ | — |
| 104 | literal-ขิง | ขอชาขิงหนึ่งแก้ว ไม่ใส่น้ำตาล | I'd like a cup of ginger tea, no sugar. | ความหมายใช้ได้ | — |
| 105 | literal-อ่อม | วันนี้แม่ทำแกงอ่อมไก่ให้กิน | Today Mom made chicken gaeng om for me to eat. | ความหมายใช้ได้ | — |
| 106 | literal-แบตหมด | มือถือแบตหมด ช่วยเอาที่ชาร์จมาให้หน่อย | My phone's out of battery—could you bring the charger, please? | ความหมายใช้ได้ | — |
| 107 | literal-เรือแตก | เรือแตกกลางทะเล ทุกคนใส่เสื้อชูชีพแล้ว | The boat broke apart in the middle of the sea, and everyone’s already wearing life jackets. | ความหมายใช้ได้ | — |
| 108 | literal-ธงแดง | ปักธงแดงไว้หน้าทางเข้าที่กำลังก่อสร้าง | Put a red flag in front of the entrance that's under construction. | ความหมายใช้ได้ | — |
| 109 | literal-สมองไหล | รัฐบาลกังวลปัญหาสมองไหลจากการย้ายไปทำงานต่างประเทศ | The government is concerned about the brain drain caused by people moving abroad for work. | ความหมายใช้ได้ | — |
| 110 | literal-สมาชิก | ส่งเอกสารให้สมาชิก 50 คน ไม่ใช่ 5 คน | Send the documents to 50 members, not 5. | ความหมายใช้ได้ | — |
| 111 | literal-สาด | อย่าสาดน้ำใส่สมาชิกที่ถือกล้อง | Don't splash water on members holding a camera. | ความหมายใช้ได้ | — |
| 112 | literal-ป้ายยา | พยาบาลป้ายยาบนแผลแล้วปิดผ้าก๊อซ | The nurse applied the medication to the wound and then covered it with gauze. | ความหมายใช้ได้ | — |

## refinement

| # | คำ/วลี | ต้นฉบับ | ผลจริง | ประเมินโดยผู้ช่วย | ข้อสังเกต |
|---|---|---|---|---|---|
| 1 | ไปพักก่อน | บอกว่าฉันผิดทั้งที่ยังไม่อ่าน ไปพักก่อน | Saying I'm wrong even though you haven't read it. Give it a rest. | ความหมายใช้ได้ | — |
| 2 | ไหวไหม | ทำงานมาสิบชั่วโมงแล้ว ไหวไหม พักก่อนได้นะ | Working for ten hours already. Still holding up? You can take a break first. | ความหมายใช้ได้ | — |
| 3 | คุยเผื่อเลือก | ฉันอยากคุยจริงจัง ไม่อยากเป็นคนที่เธอคุยเผื่อเลือก | I want to be serious about us, not just someone you keep as an option. | ความหมายใช้ได้ | — |
| 4 | นอย | เขาอ่านแชตแล้วไม่ตอบ ฉันนอยเลย | They read the chat and didn’t reply, so I felt hurt. | ความหมายใช้ได้ | — |
| 5 | ใจบาง | เห็นแมวตัวเล็ก ๆ แล้วใจบางทุกที | Every time I see a tiny cat, my heart melts. | ความหมายใช้ได้ | — |
| 6 | literal-ป้ายยา | พยาบาลป้ายยาบนแผลแล้วปิดผ้าก๊อซ | The nurse applied the medication to the wound and then covered it with gauze. | ความหมายใช้ได้ | — |
| 7 | literal-แกง | เพื่อนทำแกงให้ฉันกิน ไม่ได้แกล้งฉัน | My friend cooked for me, they weren't pranking me. | ควรปรับรายละเอียด/ภาษา | ยังเป็นการทำอาหาร ไม่กลายเป็นแกล้ง แต่คำแปล cooked ไม่ระบุว่าเป็นแกง/curry ตามต้นฉบับ |
| 8 | literal-สมาชิก | ส่งเอกสารให้สมาชิก 50 คน ไม่ใช่ 5 คน | Send the documents to 50 members, not 5. | ความหมายใช้ได้ | — |

## new-sentences

| # | คำ/วลี | ต้นฉบับ | ผลจริง | ประเมินโดยผู้ช่วย | ข้อสังเกต |
|---|---|---|---|---|---|
| 1 | new-genuine-negation | คนนี้พูดเก่งอย่างเดียว ยังไม่ใช่ของแทร่ | They're only good at talking; they're not the real deal. | ความหมายใช้ได้ | — |
| 2 | new-mep-context | น้องวาดรูปเมพมาก ทั้งที่เพิ่งเริ่มเรียนเดือนเดียว | My little sibling draws such amazing pictures, even though they've only been learning for a month. | ควรปรับรายละเอียด/ภาษา | น้องอาจเป็นคนอายุน้อยกว่าหรือรุ่นน้อง ไม่จำเป็นต้องเป็น my little sibling |
| 3 | new-slay-negation | วันนี้ไม่ได้เดินแบบสับนะ แค่เดินไปขึ้นรถ | I'm not strutting today—just walking to get into the car. | ความหมายใช้ได้ | — |
| 4 | new-battery-comparison | รุ่นเก่าแบตอึดกว่า รุ่นใหม่นี้ไม่ได้กินขาดนะ | The older model’s battery lasts longer. The new one doesn’t outshine it. | ความหมายใช้ได้ | — |
| 5 | new-fandom-separation | ฉันอยู่สองด้อม แต่ไม่ได้อยู่หอพัก | I'm in two fandoms, but I don't live in a dorm. | ความหมายใช้ได้ | — |
| 6 | new-favorite-switch | เมื่อก่อนเมนมือกลอง ตอนนี้ชอบนักร้องนำมากกว่า | I used to favor the drummer, but now I prefer the lead singer. | ความหมายใช้ได้ | — |
| 7 | new-mood-question | ถ้าพูดเรื่องเงินตอนนี้จะช็อตฟีลไหม | Will talking about money now be a buzzkill? | ความหมายใช้ได้ | — |
| 8 | new-backlash-negation | โพสต์นี้ยังไม่มีทัวร์ลง แค่มีคนถามสองคน | This post hasn't gotten any backlash yet, just two people have asked. | ความหมายใช้ได้ | — |
| 9 | new-prank-denial | เราไม่ได้แกงเธอ ร้านปิดจริง ๆ | I didn't prank you; the shop is really closed. | ความหมายใช้ได้ | — |
| 10 | new-cooking-prank | วันนี้แกงเพื่อนไม่สำเร็จ เลยไปทำแกงกินแทน | The prank on my friends didn’t work out today, so I just made some curry to eat instead. | ความหมายใช้ได้ | — |
| 11 | new-flex-question | ซื้อคอมมาใช้หรือซื้อมาเพื่อขิงเพื่อน | Buy a computer to use, or just to show off to friends? | ความหมายใช้ได้ | — |
| 12 | new-salt-shopping | สุ่มมาสามรอบเกลือตลอด เลยเลิกเติมเงินแล้ว | I've done three pulls and they've all been unlucky, so I stopped topping up. | ความหมายใช้ได้ | — |
| 13 | new-medication-negation | แผลยังไม่ได้ป้ายยา อย่าเพิ่งปิดผ้าก๊อซ | The wound hasn't been medicated yet—don't cover it with gauze yet. | ความหมายใช้ได้ | — |
| 14 | new-shopping-no-purchase | เพื่อนป้ายยากล้อง แต่ฉันยังไม่ได้ซื้อ | My friend keeps recommending the camera, but I haven't bought it yet. | ความหมายใช้ได้ | — |
| 15 | new-real-fire | ไฟลนก้นกระทะจนดำ ต้องลดไฟ | We're under severe deadline pressure and it's getting critical—we need to ease up. | ความหมายหลักผิด | ไฟลนก้นกระทะจริงถูกเปลี่ยนเป็นเส้นตาย ทั้งที่มีคำว่ากระทะและลดไฟ |
| 16 | new-work-orders | วันนี้งานเข้าร้านสิบออร์เดอร์ ไม่ได้มีปัญหาอะไร | Today, ten orders came into the shop, and there were no problems. | ความหมายใช้ได้ | — |
| 17 | new-deadline | เหลืออีกครึ่งชั่วโมงก่อนส่ง ตอนนี้ไฟลนก้นแล้ว | Only half an hour left before the deadline, and I'm already feeling the pressure. | ความหมายใช้ได้ | — |
| 18 | new-dating | อยากคุยจริงจังกับเธอ ไม่ได้คุยเผื่อเลือก | I want to have a serious conversation with you, not just keep you as an option. | ความหมายหลักผิด | ประโยคความสัมพันธ์รูปใหม่ยังเปลี่ยนความตั้งใจจริงจังเป็น serious conversation |
| 19 | new-serious-discussion | หัวหน้าขอคุยจริงจังเรื่องงบประมาณพรุ่งนี้ | My boss wants to have a serious talk about the budget tomorrow. | ความหมายใช้ได้ | — |
| 20 | new-bird | นกสองตัวบินหนีไปแล้ว ฉันเลยถ่ายรูปไม่ทัน | Two birds flew away, so I didn't get a chance to snap a photo. | ความหมายใช้ได้ | — |
| 21 | new-social-energy | วันนี้แบตสังคมหมด แต่มือถือยังเหลือ 80 เปอร์เซ็นต์ | My social battery is dead today, but my phone still has 80 percent left. | ความหมายใช้ได้ | — |
| 22 | new-injury | หมอบอกว่าศีรษะได้รับบาดเจ็บ ไม่ได้แค่หัวร้อนจากเกม | The doctor said my head was injured, not just a case of getting heated from a game. | ควรปรับรายละเอียด/ภาษา | my head ใส่ผู้ได้รับบาดเจ็บเป็นผู้พูดทั้งที่ต้นฉบับไม่ระบุ แม้เก็บเหตุการณ์บาดเจ็บจริงและการปฏิเสธอารมณ์เกมไว้ |
| 23 | new-caring-subject | เธออดนอนมาสองคืนแล้ว ยังไหวไหม ไปพักก่อนได้นะ | You've been up for two nights now—still hanging in there? You can go take a break. | ความหมายใช้ได้ | — |
| 24 | new-neutral-pronoun | เขาแบกงานนี้คนเดียว แต่ไม่ได้เป็นหัวหน้าทีม | They carried this work all by themselves, but they're not the team leader. | ความหมายใช้ได้ | — |
| 25 | new-explicit-first-person | ฉันทำงานมาสิบชั่วโมงแล้ว แต่เธอเพิ่งเริ่มงานใช่ไหม | I've been working for ten hours already, but you just started, right? | ความหมายใช้ได้ | — |
| 26 | new-explicit-listener | เธอบอกว่าฉันผิดทั้งที่เธอยังไม่อ่าน ไปพักก่อน | You say I'm wrong even though you haven't even read it. Take a break first. | ความหมายใช้ได้ | — |
| 27 | new-explicit-self-rest | ฉันบอกผิดเองเพราะฉันยังไม่อ่าน ขอไปพักก่อนนะ | I gave you the wrong info because I haven't read it yet. Give it a rest. | ความหมายหลักผิด | ผู้พูดขอพักเองถูกเปลี่ยนเป็นคำสั่งให้ผู้ฟังหยุด/พัก |
| 28 | new-ordinary-noy-collision | ฉันอยากกินข้าว คนอยากกลับบ้านก็กลับได้เลย | I want to eat. If you want to go home, you can go. | ความหมายใช้ได้ | — |
| 29 | new-likit-name | คุณลิขิตเขียนเรื่องพรหมลิขิต ไม่ได้เขียนเรื่องความตาย | Khun Likit writes about destiny, not about death. | ความหมายใช้ได้ | — |
| 30 | new-eiffel | ปีหน้าจะไปดูหอไอเฟล แต่ยังไม่ได้จองตั๋ว | I'm planning to go see the Eiffel Tower next year, but I haven't booked tickets yet. | ความหมายใช้ได้ | — |

## context-refinement

| # | คำ/วลี | ต้นฉบับ | ผลจริง | ประเมินโดยผู้ช่วย | ข้อสังเกต |
|---|---|---|---|---|---|
| 1 | new-real-fire | ไฟลนก้นกระทะจนดำ ต้องลดไฟ | The bottom of the pan got black—reduce the heat. | ความหมายใช้ได้ | — |
| 2 | new-deadline | เหลืออีกครึ่งชั่วโมงก่อนส่ง ตอนนี้ไฟลนก้นแล้ว | Only half an hour left before the deadline, and I'm already feeling the pressure. | ความหมายใช้ได้ | — |
| 3 | new-dating | อยากคุยจริงจังกับเธอ ไม่ได้คุยเผื่อเลือก | I want to be serious with you, not just keep you as an option. | ความหมายใช้ได้ | — |
| 4 | new-serious-discussion | หัวหน้าขอคุยจริงจังเรื่องงบประมาณพรุ่งนี้ | My boss wants to have a serious talk about the budget tomorrow. | ความหมายใช้ได้ | — |
| 5 | new-caring-subject | เธออดนอนมาสองคืนแล้ว ยังไหวไหม ไปพักก่อนได้นะ | You've been up for two nights now—still hanging in there? You can go take a break. | ความหมายใช้ได้ | — |
| 6 | new-explicit-first-person | ฉันทำงานมาสิบชั่วโมงแล้ว แต่เธอเพิ่งเริ่มงานใช่ไหม | I've been working for ten hours already, but you just started, right? | ความหมายใช้ได้ | — |
| 7 | new-explicit-listener | เธอบอกว่าฉันผิดทั้งที่เธอยังไม่อ่าน ไปพักก่อน | You say I'm wrong even though you haven't even read it. Take a break first. | ความหมายใช้ได้ | — |
| 8 | new-explicit-self-rest | ฉันบอกผิดเองเพราะฉันยังไม่อ่าน ขอไปพักก่อนนะ | I misspoke because I haven’t read it yet. I’m going to take a break first. | ความหมายใช้ได้ | — |
| 9 | new-literal-pot | ไฟลนก้นหม้อจนดำ อย่าเพิ่งจับหม้อ | The fire has blackened the bottom of the pot—don’t touch the pot yet. | ความหมายใช้ได้ | — |
| 10 | new-budget-with-partner | ขอคุยจริงจังเรื่องงบประมาณกับแฟน ไม่ได้พูดถึงการเลือกคนคุย | I want to have a serious talk about the budget with my partner, not about choosing a talking stage. | ควรปรับรายละเอียด/ภาษา | ประเด็นงบประมาณถูกแล้ว แต่ choosing a talking stage แทน choosing someone to date ฟังไม่เป็นธรรมชาติและเปลี่ยนคนเป็นช่วงความสัมพันธ์ |

## final-verification

| # | คำ/วลี | ต้นฉบับ | ผลจริง | ประเมินโดยผู้ช่วย | ข้อสังเกต |
|---|---|---|---|---|---|
| 1 | ไปพักก่อน | บอกว่าฉันผิดทั้งที่ยังไม่อ่าน ไปพักก่อน | Saying I'm wrong even though they haven't read it. Give it a rest. | ควรปรับรายละเอียด/ภาษา | ไม่สลับเป็นผู้พูดยอมรับว่ายังไม่อ่านหรือผู้พูดขอพักแล้ว แต่ they ในประโยคแรกกับคำสั่ง Give it a rest ยังอ้างบุคคลไม่ชัดและเป็น fragment ควรเกลาถ้อยคำ |
| 2 | ไหวไหม | ทำงานมาสิบชั่วโมงแล้ว ไหวไหม พักก่อนได้นะ | Ten hours of work already. Holding up? You can take a break first. | ความหมายใช้ได้ | — |
| 3 | คุยเผื่อเลือก | ฉันอยากคุยจริงจัง ไม่อยากเป็นคนที่เธอคุยเผื่อเลือก | I want us to be serious. I don’t want to be someone you keep as an option. | ความหมายใช้ได้ | — |
| 4 | literal-สมาชิก | ส่งเอกสารให้สมาชิก 50 คน ไม่ใช่ 5 คน | Send the documents to 50 members, not 5. | ความหมายใช้ได้ | — |
| 5 | literal-ป้ายยา | พยาบาลป้ายยาบนแผลแล้วปิดผ้าก๊อซ | The nurse applied the medication to the wound and then covered it with gauze. | ความหมายใช้ได้ | — |
| 6 | new-real-fire | ไฟลนก้นกระทะจนดำ ต้องลดไฟ | The bottom of the pan got black—lower the heat. | ความหมายใช้ได้ | — |
| 7 | new-dating | อยากคุยจริงจังกับเธอ ไม่ได้คุยเผื่อเลือก | I want something serious with you, not just keep you as an option. | ความหมายใช้ได้ | — |
| 8 | new-explicit-self-rest | ฉันบอกผิดเองเพราะฉันยังไม่อ่าน ขอไปพักก่อนนะ | I said it wrong because I haven’t read it yet. I’m going to take a break first. | ความหมายใช้ได้ | — |

## เปรียบเทียบรอบเต็มกับก่อนปรับ

| # | ต้นฉบับ | ก่อน | หลังรอบใหญ่ | ประเมินหลังรอบใหญ่ |
|---|---|---|---|---|
| 1 | ชุดที่เธอใส่วันนี้จึ้งมาก | Your outfit today looks amazing. | Your outfit today looks amazing. | ความหมายใช้ได้ |
| 2 | ร้านใหม่ของเขาปังตั้งแต่วันแรก | His new place has been a hit from day one. | His new shop has been a hit since day one. | ความหมายใช้ได้ |
| 3 | ไอเดียนี้เริ่ด ลองทำกันเลย | This idea is awesome. Let's try it. | This idea is awesome—let's give it a try. | ความหมายใช้ได้ |
| 4 | คอนเสิร์ตเมื่อคืนทีมงานทำถึงจริง ๆ | The concert last night really came together thanks to the crew. | The team really delivered at last night’s concert. | ความหมายใช้ได้ |
| 5 | งานยากขนาดนี้แต่เธอเอาอยู่ | The job’s this hard, yet you’re still taking it on. | This job is so tough, but you can handle it. | ความหมายใช้ได้ |
| 6 | ร้านเล็ก ๆ แต่ฝีมือเชฟเอาเรื่องนะ | It's a small place, but the chef's skill is impressive. | A small place, but the chef’s skill is impressive. | ความหมายใช้ได้ |
| 7 | พี่เขาเป็นตัวตึงเรื่องแก้บั๊กของทีม | He's the go‑to person for fixing bugs on the team. | He's the team's go‑to bug‑fixer. | ความหมายใช้ได้ |
| 8 | เรื่องแต่งหน้าเธอคือตัวแม่ของกลุ่ม | Her makeup is the best in the group. | When it comes to makeup, she is the absolute queen of the group. | ความหมายใช้ได้ |
| 9 | เขาเป็นตัวพ่อเรื่องต่อรองราคา | He's the one who handles price negotiations. | He's the master of price negotiations. | ความหมายใช้ได้ |
| 10 | บริษัทนี้รับแต่ตัวท็อปเข้าทีม | This company only brings in top talent to the team. | This company only brings top talent onto the team. | ความหมายใช้ได้ |
| 11 | ตอนแรกนึกว่าคุยโว พอเห็นฝีมือถึงรู้ว่าของจริง | At first I thought it was just bragging, but after seeing the skill I realized it was the real deal. | At first I thought they were just bragging, but when I saw the skill, I realized it’s the real deal. | ความหมายใช้ได้ |
| 12 | ช่วยแก้ปัญหาได้ทุกครั้ง คนนี้ของแทร่ | Can solve problems every time. This one belongs to Trae. | They can solve any problem every time. This person is the real deal. | ควรปรับรายละเอียด/ภาษา |
| 13 | โซโล่กีตาร์เมื่อกี้อย่างเอา | That guitar solo just now was fire. | That guitar solo just now was fire. | ความหมายใช้ได้ |
| 14 | เขาเล่นเกมนี้เก่งอย่างเทพ | He's godlike at this game. | He's godlike at this game. | ความหมายใช้ได้ |
| 15 | ด่านยากขนาดนี้ยังผ่านได้ เมพจริง | A level this tough can still be beaten—seriously, that's a real map. | A level this hard and you still cleared it—you're seriously godlike. | ความหมายใช้ได้ |
| 16 | วันนี้เธอเดินขึ้นเวทีแบบสับมาก | You walked onto the stage so awkwardly today. | You walked onto the stage today and totally owned it. | ความหมายใช้ได้ |
| 17 | เรื่องแบตเตอรี่มือถือรุ่นนี้กินขาด | The battery on this phone model drains completely. | This phone model's battery is unbeatable. | ความหมายใช้ได้ |
| 18 | ร้านนี้ยืนหนึ่งเรื่องขนมในใจฉัน | This place is my top choice for desserts. | This shop is my number one when it comes to sweets. | ความหมายใช้ได้ |
| 19 | ตอบคำถามดีขนาดนี้ มงลงแน่นอน | Answering the question that well, you’re definitely going to get a crown. | With answers this good, you're definitely going to win the crown. | ความหมายใช้ได้ |
| 20 | วันนี้แต่งตัวแล้วออร่าจับมาก | I got dressed today and my aura is really strong. | I dressed up today and I look so radiant. | ความหมายใช้ได้ |
| 21 | สาดไปสมาชิก | Go for it, buddy! | Go for it, buddy! | ความหมายใช้ได้ |
| 22 | อยากกินพิซซ่าใช่ไหม จัดไป เดี๋ยวสั่งให้ | You want pizza, right? Go ahead—I’ll order it. | You want pizza, right? Sure thing—I'll order it for you. | ความหมายใช้ได้ |
| 23 | มีข้อเสนออะไรจัดมาได้เลย เดี๋ยวช่วยดู | Just send any proposals you have, and I’ll take a look. | Just send any proposals you have, and I’ll take a look. | ความหมายใช้ได้ |
| 24 | เตรียมทุกอย่างพร้อมแล้ว ลุยเลย | Everything's ready—let's go. | Everything's ready. Let's go. | ความหมายใช้ได้ |
| 25 | ถ้าชอบแบบนี้ก็เอาเลย ฉันไม่ติด | If you like it like that, go for it. I don't mind. | If you like it like that, go for it. I don't mind. | ความหมายใช้ได้ |
| 26 | พรุ่งนี้แข่งแล้ว เล่นให้เต็มที่เลยนะ | The match is tomorrow—give it your all. | The match is tomorrow—give it your all! | ความหมายใช้ได้ |
| 27 | รอบสุดท้ายแล้ว ใส่ให้สุด | It's the final round—give it everything you've got. | This is the final round—give it your all. | ความหมายใช้ได้ |
| 28 | เลือกทางนี้แล้วก็ไปให้สุด | Take this route and go all the way. | Take this path and go all the way. | ความหมายใช้ได้ |
| 29 | งานนี้เตรียมตัวมาดีแล้ว ลุยให้ยับ | I'm well prepared for this job—let's crush it. | I'm all set for this job—let's crush it. | ความหมายใช้ได้ |
| 30 | อยากได้ไฟล์ต้นฉบับใช่ไหม เดี๋ยวจัดให้ | You want the original file, right? I’ll get it for you. | You want the original file, right? I’ll get it for you. | ความหมายใช้ได้ |
| 31 | รูปนี้ได้อยู่ แต่เพิ่มแสงอีกหน่อยจะดี | The picture is fine, but a bit more light would improve it. | The picture is fine, but a little more light would improve it. | ความหมายใช้ได้ |
| 32 | จะกินร้านไหนก็ได้ ฉันได้หมด | I’ll eat anywhere; I’m full. | Any restaurant is fine—I’m good with whatever you pick. | ความหมายใช้ได้ |
| 33 | ถ้าทุกคนสะดวกวันศุกร์ก็ตามนั้น | If everyone’s free on Friday, then let’s go ahead. | If everyone is available on Friday, let's go with that. | ความหมายใช้ได้ |
| 34 | ไม่ต้องรีบตอบนะ ตอบตามสะดวกได้เลย | No need to rush—just reply whenever it's convenient. | No rush—just reply whenever it's convenient. | ความหมายใช้ได้ |
| 35 | เรื่องสีเสื้อแล้วแต่เธอเลย ฉันชอบทั้งสองสี | The shirt color is up to you—I like both colors. | The shirt color is up to you—I like both colors. | ความหมายใช้ได้ |
| 36 | มีอะไรอยากปรึกษาก็ว่ามา ฉันฟังอยู่ | If there's anything you want to discuss, just tell me—I'm listening. | If there's anything you want to talk about, just tell me—I'm listening. | ความหมายใช้ได้ |
| 37 | ถ้าพร้อมแข่งแล้วก็มาเลย | If you're ready to race, just come. | If you're ready to race, just come over. | ควรปรับรายละเอียด/ภาษา |
| 38 | เลื่อนนัดเป็นบ่ายสองได้ ฉันไม่ติด | I can move the appointment to 2 p.m.; I'm not busy. | I can move the appointment to 2 pm. I'm not busy. | ความหมายใช้ได้ |
| 39 | เธอทำสไลด์ ฉันนำเสนอ ตกลงไหม ดีล | You make the slides, I’ll present. Is that okay? Deal. | You make the slides, I’ll present. Okay? Deal. | ความหมายใช้ได้ |
| 40 | เรื่องที่ทะเลาะกันขอให้จบที่นี่ ไม่ต้องเอาไปพูดต่อ | Let this argument end here—don't bring it up again. | Let this argument end here—don’t bring it up again. | ควรปรับรายละเอียด/ภาษา |
| 41 | เขาอ่านแชตแล้วไม่ตอบ ฉันนอยเลย | He read the chat and didn't reply, so I'm annoyed. | They read the chat and didn't reply, so I felt down. | ความหมายใช้ได้ |
| 42 | เตรียมงานมาตั้งนานแต่โดนยกเลิก รู้สึกเฟลมาก | I’d been preparing for the event for a long time, but it got cancelled. I feel really messed up. | I’d been preparing for the event for a long time, but it got cancelled. I feel so let down. | ความหมายใช้ได้ |
| 43 | เมื่อคืนไปดูคอนเสิร์ตแล้วจอยมาก | I went to a concert last night and had a great time. | I went to a concert last night and had a great time. | ความหมายใช้ได้ |
| 44 | เดินขึ้นบันไดสิบชั้น เหนื่อยจะตุย | I walked up ten flights of stairs and I'm exhausted. | I walked up ten flights of stairs—I'm dead tired. | ความหมายใช้ได้ |
| 45 | เห็นบิลค่าไฟแล้วแทบขิต | Seeing the electricity bill, I almost threw up. | Seeing the electricity bill almost killed me. | ความหมายใช้ได้ |
| 46 | คลิปนี้ขำจะขิต ดูวนไปสามรอบแล้ว | This video is so funny—I’ve already watched it three times. | This clip is so funny it's killing me—I've watched it three times already. | ความหมายใช้ได้ |
| 47 | แพ้เกมติดกันสามตาแล้วเริ่มหัวร้อน | I've lost three games in a row and I'm starting to get angry. | I've lost three games in a row and I'm starting to get angry. | ความหมายใช้ได้ |
| 48 | ไฟล์หายก่อนส่งงานสิบนาที หัวจะปวด | The file disappeared ten minutes before I was supposed to submit it—my head is pounding. | The file disappeared ten minutes before I had to submit it—what a headache. | ความหมายใช้ได้ |
| 49 | เพื่อนจำวันเกิดได้ แค่นี้ก็ใจฟูแล้ว | A friend remembered my birthday—just that makes me feel so happy. | A friend remembered my birthday—just that makes me feel so happy. | ความหมายใช้ได้ |
| 50 | เห็นแมวตัวเล็ก ๆ แล้วใจบางทุกที | Every time I see a tiny cat, my heart aches. | Every time I see a tiny cat, my heart melts. | ความหมายใช้ได้ |
| 51 | เขายิ้มให้ทีเดียวฉันก็ใจเหลวแล้ว | He smiled just once, and I was already won over. | He smiled just once, and I melted. | ความหมายใช้ได้ |
| 52 | กำลังเล่าเรื่องสนุกอยู่แต่เขาพูดช็อตฟีลเลย | I was telling a funny story, but he started talking about a short film. | I was telling a funny story, but he totally killed the vibe. | ความหมายใช้ได้ |
| 53 | โปรโมตว่าปังมาก แต่ดูของจริงแล้วอ่อม | They hype it up as amazing, but the real thing falls flat. | It's promoted as amazing, but in reality it's underwhelming. | ความหมายใช้ได้ |
| 54 | โฆษณานี้บ้งตรงที่เอาความพิการมาล้อ | This ad is flawed because it makes fun of disability. | This ad is flawed because it makes fun of disability. | ความหมายใช้ได้ |
| 55 | หวังว่าจะสนุก แต่บทหนังบูดมาก | I was hoping it would be fun, but the script is really terrible. | I was hoping it would be fun, but the script is really terrible. | ความหมายใช้ได้ |
| 56 | จ่ายเงินแล้วแต่ระบบบอกยังไม่จ่าย อิหยังวะ | I already paid, but the system says it hasn't gone through. What the heck? | I already paid, but the system says it hasn't gone through. What the heck? | ความหมายใช้ได้ |
| 57 | บอกว่าฉันผิดทั้งที่ยังไม่อ่าน ไปพักก่อน | You said I was wrong even without reading it yet. Take a break. | They say I'm wrong even though I haven't even read it. I'm going to take a break first. | ความหมายหลักผิด |
| 58 | ทำงานมาสิบชั่วโมงแล้ว ไหวไหม พักก่อนได้นะ | I've been working for ten hours now. Can you manage? You can take a break first. | I've been working for ten hours already. Are you holding up? You can take a break first. | ความหมายหลักผิด |
| 59 | เอาดี ๆ นะ นัดพรุ่งนี้หรือมะรืนกันแน่ | Seriously, are we meeting tomorrow or the day after? | Seriously, are we meeting tomorrow or the day after? | ความหมายใช้ได้ |
| 60 | ประชุมพร้อมกันสามงาน ฉันจะเครซี่ | Three meetings at once—I'm going crazy. | I have three meetings at the same time—I'm going crazy. | ความหมายใช้ได้ |
| 61 | นัดกันไว้แล้วแต่เขายกเลิกก่อนเจอสิบนาที ฉันโดนเทอีกแล้ว | We had a plan, but they canceled ten minutes before we were supposed to meet. I got stood up again. | We had plans, but they canceled ten minutes before we were supposed to meet. I got stood up again. | ความหมายใช้ได้ |
| 62 | ชอบเขามานานแต่เขามีแฟนแล้ว นกอีกแล้วเรา | I've liked him for a while, but he's already taken. Guess I'm single again. | I've had a crush on him for so long, but he already has a girlfriend. Struck out again. | ควรปรับรายละเอียด/ภาษา |
| 63 | กดซื้อบัตรไม่ทัน แห้วเลย | I couldn't buy the ticket in time, so I missed out. | I couldn't buy the ticket in time, so I missed out. | ความหมายใช้ได้ |
| 64 | เลิกกันแล้วแต่ฉันยังมูฟออนไม่ได้ | We broke up, but I still can't move on. | We broke up, but I still can't move on. | ความหมายใช้ได้ |
| 65 | เพื่อนคลั่งรักมาก พูดถึงแฟนทั้งวัน | My friend is totally smitten and talks about their partner all day. | My friend is totally smitten and talks about their partner all day. | ความหมายใช้ได้ |
| 66 | เขาสองคนแอบแซ่บกันแต่ไม่ยอมบอกใคร | The two of them are secretly seeing each other, but they won’t tell anyone. | The two of them are secretly getting together, but they won’t tell anyone. | ความหมายใช้ได้ |
| 67 | เขายังไม่ใช่แฟน เป็นแค่คนคุย | He's not my boyfriend—just someone I talk to. | He's not my boyfriend, just someone I'm talking to. | ความหมายใช้ได้ |
| 68 | ฉันอยากคุยจริงจัง ไม่อยากเป็นคนที่เธอคุยเผื่อเลือก | I want to have a serious talk; I don’t want to be someone you keep as a backup. | I want to have a serious conversation. I don’t want to be someone you keep as a backup. | ความหมายหลักผิด |
| 69 | เขาชอบหยอดว่าฉันน่ารักทุกครั้งที่เจอ | He always says I'm cute whenever he sees me. | He always says I'm cute whenever he sees me. | ความหมายใช้ได้ |
| 70 | ฉันแค่ยิ้มตามมารยาท ไม่ได้อ่อย | I was just smiling out of courtesy, not trying to flirt. | I was just smiling out of politeness, not trying to flirt. | ความหมายใช้ได้ |
| 71 | เพื่อนชอบเต๊าะพนักงานร้านกาแฟ | My friend likes to tease the coffee shop staff. | My friend likes to flirt with the coffee shop staff. | ความหมายใช้ได้ |
| 72 | จีบมาตั้งนาน ในที่สุดก็จีบติดแล้ว | I've been flirting for a long time, and finally I succeeded. | I've been flirting for ages, and finally it worked. | ความหมายใช้ได้ |
| 73 | เขาบอกว่าเห็นฉันเป็นเพื่อน ฉันติดเฟรนด์โซนแล้ว | He said he sees me as just a friend. I'm stuck in the friend zone. | He said he sees me as a friend. I'm stuck in the friend zone. | ความหมายใช้ได้ |
| 74 | ฉันแพ้ทางคนพูดเพราะและใจดีกับสัตว์ | I'm a sucker for people who speak sweetly and are kind to animals. | I'm a sucker for people who speak gently and are kind to animals. | ความหมายใช้ได้ |
| 75 | เขาขอดูมือถือและห้ามคุยกับเพื่อน แบบนี้ธงแดงนะ | He wants to see my phone and says I can’t talk to my friends—that’s a red flag. | He wants to see my phone and forbids me from talking to my friends— that's a red flag. | ความหมายใช้ได้ |
| 76 | เขารับฟังและเคารพเวลาส่วนตัวของฉัน ธงเขียวเลย | He listens to and respects my personal time. That's a green flag. | He listens and respects my personal time. That's a green flag. | ความหมายใช้ได้ |
| 77 | เพื่อนบอกว่าแต่งชุดแฟนซีมา สรุปมีฉันแต่งคนเดียว โดนแกงแล้ว | My friend said to wear a fancy costume, and it turned out I was the only one who did, so I got scolded. | My friend said to wear fancy dress, but it turns out I was the only one. I got played. | ความหมายใช้ได้ |
| 78 | เขารู้อยู่แล้วแต่แกล้งถามเพื่อปั่นคนในกลุ่ม | They already know but pretend to ask just to stir up the group. | He already knows, but pretends to ask just to stir up the group. | ความหมายใช้ได้ |
| 79 | เขาบอกว่ารักแล้วก็หายไป อย่ามาปั่นหัวฉัน | He said he loved me and then vanished. Don't try to mess with my head. | He said he loved me and then vanished. Don't come trying to mess with my head. | ความหมายใช้ได้ |
| 80 | แบรนด์โพสต์ล้อเลียนลูกค้าจนทัวร์ลง | The brand posted a mocking take on its customers, and the tour was called off. | The brand posted a mocking message about its customers and got slammed online. | ความหมายใช้ได้ |
| 81 | เพื่อนป้ายยาหูฟังจนฉันกดซื้อเลย | My friend kept hyping the headphones, so I bought them right away. | My friend kept hyping the headphones, so I just bought them. | ความหมายใช้ได้ |
| 82 | ดูซีรีส์เรื่องเดียวก็โดนนักแสดงคนนี้ตกแล้ว | I only watched one series and already fell for this actor. | I watched just one series and already fell for this actor. | ความหมายใช้ได้ |
| 83 | คนในด้อมช่วยกันจัดงานวันเกิดให้นักร้อง | The people in the dorm helped organize a birthday party for the singer. | The fans in the fandom helped organize a birthday party for the singer. | ความหมายใช้ได้ |
| 84 | วงนี้ฉันชอบทุกคน แต่เมนคือมือกลอง | I like everyone in this band, but Men is the drummer. | I like everyone in this band, but my bias is the drummer. | ความหมายใช้ได้ |
| 85 | ฉันชิปตัวละครคู่นี้ แต่ไม่ได้บอกว่านักแสดงคบกันจริง | I ship this couple, but I didn't say the actors are actually dating. | I ship this character couple, but I'm not saying the actors are actually dating. | ความหมายใช้ได้ |
| 86 | ตอนล่าสุดตัวละครคู่นี้จับมือกัน เรือแล่นแล้ว | In the latest episode, the two characters held hands, and the ship set sail. | In the latest episode, the two characters held hands— the ship has set sail. | ความหมายใช้ได้ |
| 87 | บทเฉลยว่าตัวละครที่ฉันชิปเป็นพี่น้องกัน เรือแตกเลย | The answer reveals that the characters I was shipping are siblings, so the ship is dead. | The answer says the characters I ship are siblings, so the ship is dead. | ควรปรับรายละเอียด/ภาษา |
| 88 | ซื้อคอมใหม่แล้วขิงเพื่อนใหญ่เลย | I got a new computer and teased my big buddy. | I bought a new computer and bragged to all my friends about it. | ควรปรับรายละเอียด/ภาษา |
| 89 | สุ่มตัวละครไปสิบครั้ง ได้แต่ตัวซ้ำ เกลือมาก | I tried randomizing characters ten times and only got repeats. So salty. | I pulled characters ten times and got nothing but duplicates. So unlucky. | ความหมายใช้ได้ |
| 90 | โปรเจกต์นี้เขาแบกคนเดียว ทั้งเขียนโค้ดทั้งนำเสนอ | He/she handled the entire project alone, doing both the coding and the presentation. | They carried the whole project all by themselves, doing both the coding and the presentation. | ความหมายใช้ได้ |
| 91 | อย่าเอาเรื่องคนอื่นมาโพสต์หิวแสงเลย | Don't use other people's issues just to get attention in your posts. | Don't post other people's stuff just to chase clout. | ความหมายใช้ได้ |
| 92 | ถ่ายรูปข้างเพื่อนที่แต่งเต็มแล้วฉันแสงออกเท้าเลย | I took a picture next to a friend who was all dressed up, and I ended up showing my foot. | I took a photo next to my friend who was all dressed up, and I ended up being completely outshone. | ความหมายใช้ได้ |
| 93 | เผลอลบฐานข้อมูลจริง งานเข้าแล้ว | I accidentally deleted the real database. The job’s already in. | I accidentally deleted the real database. I'm in trouble now. | ความหมายใช้ได้ |
| 94 | แก้บั๊กหนึ่งจุดแล้วเจออีกสามจุด งานงอกเลย | I fixed one bug and then ran into three more—now the work is just piling up. | I fixed one bug and then ran into three more. The work just keeps piling up. | ความหมายใช้ได้ |
| 95 | พรุ่งนี้ต้องส่งแต่ยังไม่เริ่ม ตอนนี้ไฟลนก้นแล้ว | I have to submit it tomorrow, but I haven't started yet. My pants are on fire now. | I have to submit it tomorrow but haven’t started yet. I’m already feeling the deadline pressure. | ความหมายใช้ได้ |
| 96 | อ่านโค้ดมาทั้งวันจนสมองไหลแล้ว ขอพักก่อน | I've been reading code all day and my brain's fried. I need a break. | I've been reading code all day and my brain's fried—I'm going to take a break. | ความหมายใช้ได้ |
| 97 | คิดชื่อแอปมาสองชั่วโมงแล้วสมองตัน | I've been trying to come up with an app name for two hours, and I'm completely stuck. | I've been trying to come up with an app name for two hours, and my brain is fried. | ความหมายใช้ได้ |
| 98 | ยังชอบงานนี้อยู่ แค่เหนื่อย ไม่ได้หมดแพสชัน | I still like this job—I'm just tired, but I haven't lost my passion. | I still like this job; I'm just tired and haven't lost my passion. | ความหมายใช้ได้ |
| 99 | วันนี้คุยกับคนเยอะจนแบตหมด ขออยู่เงียบ ๆ ก่อน | I’ve been talking to a lot of people today and my battery’s dead, so I need to stay quiet for a while. | I talked to a lot of people today and my battery's dead, so I need some quiet for now. | ความหมายใช้ได้ |
| 100 | เตือนมาสามครั้งแล้ว ตอนนี้หมดโควตาความอดทน | I've warned you three times already. I'm out of patience now. | I've warned you three times already, and now I'm out of patience. | ความหมายใช้ได้ |
| 101 | สับหมูให้ละเอียดก่อนใส่กระทะ | Finely mince the pork before adding it to the pan. | Finely mince the pork before adding it to the pan. | ความหมายใช้ได้ |
| 102 | ใส่เกลือ 10 กรัม อย่าใส่ 50 กรัม | Add 10 g of salt, not 50 g. | Add 10 g of salt; don’t add 50 g. | ความหมายใช้ได้ |
| 103 | เพื่อนทำแกงให้ฉันกิน ไม่ได้แกล้งฉัน | My friend made curry for me to eat, not to tease me. | My friend made me curry, they weren't pranking me. | ความหมายใช้ได้ |
| 104 | ขอชาขิงหนึ่งแก้ว ไม่ใส่น้ำตาล | One cup of ginger tea, no sugar, please. | I'd like a cup of ginger tea, no sugar. | ความหมายใช้ได้ |
| 105 | วันนี้แม่ทำแกงอ่อมไก่ให้กิน | Mom made chicken gaeng om today. | Today Mom made chicken gaeng om for me to eat. | ความหมายใช้ได้ |
| 106 | มือถือแบตหมด ช่วยเอาที่ชาร์จมาให้หน่อย | My phone's battery is dead—could you bring the charger, please? | My phone's out of battery—could you bring the charger, please? | ความหมายใช้ได้ |
| 107 | เรือแตกกลางทะเล ทุกคนใส่เสื้อชูชีพแล้ว | The boat broke apart in the middle of the sea, and everyone is already wearing life jackets. | The boat broke apart in the middle of the sea, and everyone’s already wearing life jackets. | ความหมายใช้ได้ |
| 108 | ปักธงแดงไว้หน้าทางเข้าที่กำลังก่อสร้าง | Put a red flag in front of the entrance that's under construction. | Put a red flag in front of the entrance that's under construction. | ความหมายใช้ได้ |
| 109 | รัฐบาลกังวลปัญหาสมองไหลจากการย้ายไปทำงานต่างประเทศ | The government is concerned about brain drain caused by people moving abroad for work. | The government is concerned about the brain drain caused by people moving abroad for work. | ความหมายใช้ได้ |
| 110 | ส่งเอกสารให้สมาชิก 50 คน ไม่ใช่ 5 คน | Send the documents to 50 members, not 5. | Send the documents to 50 members, not 5. | ความหมายใช้ได้ |
| 111 | อย่าสาดน้ำใส่สมาชิกที่ถือกล้อง | Don't splash water on members who are holding a camera. | Don't splash water on members holding a camera. | ความหมายใช้ได้ |
| 112 | พยาบาลป้ายยาบนแผลแล้วปิดผ้าก๊อซ | The nurse placed a medication label on the wound and then covered it with gauze. | The nurse applied the medication to the wound and then covered it with gauze. | ความหมายใช้ได้ |
