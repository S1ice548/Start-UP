# 📝 รายการสั่งงานเพิ่มเติม และการปรับแก้ (Change Requests & Additional Tasks)

ไฟล์นี้ใช้สำหรับบันทึกความต้องการเพิ่มเติม รายการแก้ไข หรือข้อเสนอแนะใหม่ๆ เพื่อให้ AI และทีมงานนำไปดำเนินการต่อได้ง่ายขึ้น

---

## 📌 1. ความต้องการเพิ่มเติมใหม่ (New Feature Requests)
*(ระบุฟีเจอร์หรือการทำงานใหม่ๆ ที่ต้องการเพิ่มเข้ามาในระบบ)*

- [x] เพิ่มระบบ Notification แจ้งเตือนเมื่อใกล้ถึงวันชำระหนี้
- [x] เพิ่มวิธีการ Tsunami, Snowflake, Fireball
- [x] เปลี่ยน Popup/Modal ทั้งหมดให้เป็นการย้ายไปยัง Dedicated Page พร้อมแถบแสดงชื่อหน้าชี้แจงสถานะงานด้วย UI Design
- [x] เพิ่มหน้าสำหรับบันทึกการชำระหนี้ (จ่ายตัวไหน เท่าไหร่ เหลือเท่าไหร่) พร้อมส่วนแสดงผลลัพธ์ภาพรวมความสำเร็จและสถานะหนี้แต่ละก้อนตามไฟล์ `gemini-code-1786285081992.txt`
- [x] หน้าแรก: เอางบโปะหนี้เพิ่มออก เปลี่ยนเป็นช่องกรอกจำนวนเงินโปะและปุ่มนำทางไปหน้าบันทึกชำระหนี้โดยตรง
- [x] หน้าบันทึก: ไฮไลท์หนี้เป้าหมายอันดับ 1 (Focus Target) ตามแผน AI พร้อมเลือกลงฟอร์มบันทึกให้อัตโนมัติ
- [x] เพิ่มฟีเจอร์ Export ข้อมูลส่วนตัว (Debt & Payment History) ไปยังไฟล์ Excel


## 🛠️ 2. รายการปรับแก้ / UI & Bug Fixes (Modifications)
*(ระบุจุดที่ต้องการปรับแก้ เช่น หน้าตา UI, ปรับคำแก้ข้อความ, หรือแก้ไข Bug)*


- [x] ไม่ต้องให้ User เลือกวิธีการปลดหนี้เอง ให้ AI เป็นคนเลือกให้ (ด้วยเหตุผลที่สมเหตุสมผล เช่น ถ้าวิธี Snowball ลดดอกเบี้ยได้ดีกว่า หรือ Avalanche ลดดอกเบี้ยได้ดีกว่า ให้เลือกวิธีนั้นๆ และแสดงเหตุผลให้ User ทราบถ้าแต่ละวิธีลดอกเบี้ยต่างกันไม่เกิน 1-2% ให้เลือกวิธีที่ทำงานและเห็นผลลัพธ์เร็วที่สุด)
- [x] ให้ช่องที่กรอก งบประมาณโปะหนี้เพิ่มต่อเดือน ไม่มีเลข 0 สามารถใส่เลขได้เลย
- [x] เอาปุ่มส่งออกรายงานออกเรียบร้อยแล้ว
- [x] ทำ UI ให้น่าใช้กว่าเดิม และตรวจสอบให้ทุกปุ่มกดได้จริง
- [x] นำข้อความย้ายไปหน้าและข้อความบอกตำแหน่งแบบตัวอักษรดิบออก ใช้ดีไซน์ Visual Breadcrumb & Active Tab Glow แทน
- [x] ให้ช่องทีเลือกวิธีแก้หนี้เป็น การที่เลือกว่า ปิดหนี้เร็ว ปิดหนี้เสียดอกต่ำสุด ฯลฯ 
- [x] ทำให้สามารถ save ข้อมูลที่ User กรอกไว้ได้ และเมื่อเปิด browser ใหม่ข้อมูลยังอยู่เหมือนเดิม 
- [x] UI ไม่ค่อยสวย ปรับแก้ให้สวยงาม สะอาดตา และดูสบายตา
- [x] admin dashboard จัดการ User เช่น ลบ แก้ไข ข้อมูลหนี้สิน
- [x] import ข้อมูลมาแล้วแต่ข้อมูลไม่เข้า
- [x] เอากราฟออก
- [x] คาดการณ์ปิดหนี้ เปลี่ยนเป็น จะปิดหนี้ได้ในอีกกี่เดือน
- [x] วิธีชำระหนี้ที่ AI แนะนำเป็น highlight ค้างไว้ ไม่ต้องเป็น text ข้างล่างช่องเลือกวิธีการ
- [x] ช่องรางวัลที่แสดงในหน้าหลักเปลี่ยนเป็นเพิ่ม page รางวัล
- [x] ความคืบหน้าการปลดหนี้รวมทำให้ UI เห็นชัดเจนขึ้น
- [x] ช่อง จ่ายหนี้ไปแล้ว/ยอดหนี้คงเหลือ ไม่ตรงกับ data จริงของ user
- [x] รายการกระแสเงินสด ควรมีช่องให้บันทึกรายรับ-รายจ่ายเ ฯลฯ เผื่อจะได้คำนวนด้วยว่าแต่ละเดือนจะมี Income and Expense ประมาณเท่าไหร่ (Expense ควรใช้กรอกเลขรวมเลยไม่ต้องมากรอกทีละรายการแบบการบันทึกรายจ่ายในแต่ละวัน)
- [x] ในหน้าบันทึกการชำระหนี้ (page ที่ 2) ตัว focus หนี้ที่ต้องจ่ายไม่อัพเดทตาม payment method ที่เลือกไว้ในหน้าแรก (เปลี่ยนจาก avalanche เป็น snowball แต่ยัง focus ตัวเดียวกับวิธี Avalanche) (fix: ส่ง `manualStrategy` จาก `App.jsx` ไปยัง `PaymentHistoryPage.jsx` และใช้ใน `calculateDebtPayoff()` เพื่อให้ Focus Target อัปเดตตามวิธีชำระหนี้ที่ user เลือก)
---

## ⚙️ 3. ข้อกำหนดทางเทคนิค / Backend / AI (Technical & Logic Rules)


- [x] หลังจากที่คำนวณและแสดงตารางหนี้แล้ว ควรจะมีการ save ข้อมูลหนี้นี้ไว้ให้ User สามารถเข้ามาดูตารางหนี้นี้ได้อีกครั้งในวันถัดไป โดยอาจจะให้มีปุ่ม "Save this Plan"
- [x] admin สามารถขอไฟล์การชำระหนี้ เพื่อดาวน์โหลดเก็บไว้ได้ เป็น google sheet เพื่อดูได้ว่าประวัติการชำระหนี้เป็นยังไง ตรงเวลามั้ย
- [x] เอาวิธี fireball ออก เปลี่ยนเป็น Landslide debt method แทน
- [x] เมื่อ login ด้วยรหัส admin เพิ่่มปุ่มหน้าสำหรับ admin ไว้ดู backend page ด้วย
- [x] เมื่อ user เลือกวิธีการชำระหนี้แล้วให้ save วิธีนั้นใน userdata เพื่อจะไม่ต้องให้ user เลือกอีก และนำวิธีการออกจากหน้าหลัก user เลย แต่ user จะเปลี่ยนวิธีได้ตลอดโดยกดปุ่ม "เปลี่ยนวิธีชำระหนี้"
- [x] add page cashflow Implement the Predictive Cash Flow & Risk Early Warning module featuring a deterministic 30–90 day daily liquidity engine, automated Danger Zone risk detection, and an interactive balance visualization chart with AI-driven prescriptive recommendations.
- [x] cashflow page could help what to do when user cashflow in danger (like should stop pay debt in 2 month or pay minimum on some debt)
- [x] progress bar doesn't update realtime in all page

---

## 📋 4. ประวัติการดำเนินการแล้ว (Completed Tasks)
*(ย้ายรายการที่ทำเสร็จแล้วมาไว้ตรงนี้เพื่อบันทึกประวัติ)*

- [x] สร้างไฟล์ `CHANGE_REQUESTS.md` สำหรับบันทึกคำสั่งเพิ่มเติม
- [x] อัปเดต `debtEngine.js` เพิ่มกลยุทธ์ Tsunami, Snowflake, Fireball และระบบ AI Auto-Selected Strategy Evaluation
- [x] สร้างส่วนประกอบ `NotificationCenter.jsx` แจ้งเตือนวันครบกำหนดชำระหนี้ พร้อมตัวกรองสถานะ
- [x] เปลี่ยนส่วนงบโปะหนี้ใน `DebtCalculator.jsx` เป็นช่องกรอกเงินโปะและปุ่มนำทางไปยังหน้าบันทึกชำระหนี้พร้อมส่งผ่านยอดเงิน
- [x] ไฮไลท์หนี้เป้าหมายอันดับ 1 (Focus Target) ใน `PaymentHistoryPage.jsx` ทั้งในการ์ดสถานะหนี้ แบนเนอร์คำแนะนำ AI และเลือกลงตัวเลือกในฟอร์มให้อัตโนมัติ
- [x] เพิ่มฟีเจอร์ Export Excel: สร้าง `excelExport.js` ด้วยฟังก์ชั่น 4 แบบ (exportDebtsToExcel, exportPaymentHistoryToExcel, exportDebtSummaryToExcel, exportAllDataToExcel)
- [x] เพิ่มปุ่ม "ดาวน์โหลด Excel" ใน HeroOverview (สำหรับส่งออกข้อมูลทั้งหมด)
- [x] เพิ่มปุ่ม "ดาวน์โหลด Excel" ใน DebtCalculator (สำหรับส่งออกรายการหนี้)
- [x] เพิ่มปุ่ม "ดาวน์โหลด Excel" ใน PaymentHistoryPage (สำหรับส่งออกประวัติการชำระ)
- [x] สร้าง `calculateDebtProgress()` ใน `debtEngine.js` คำนวณยอดจ่ายจริง/คงเหลือจาก paymentLogs แทนตัวเลขสมมุติ (fix ช่อง จ่ายหนี้ไปแล้ว/ยอดหนี้คงเหลือ + progress bar อัปเดตเรียลไทม์ทุกหน้า)
- [x] สร้าง `cashflowEngine.js` ระบบ Predictive Cash Flow: จำลองยอดเงินสดรายวัน 30-90 วันแบบ deterministic, ตรวจจับ Danger Zone อัตโนมัติ, และจำลองผลกระทบของแต่ละคำแนะนำ AI (หยุดโปะ / จ่ายขั้นต่ำ / ลดรายจ่าย / หารายได้เสริม)
- [x] อัปเดต `CashflowPage.jsx` เพิ่มโมดูล Risk Early Warning: กราฟคาดการณ์ยอดเงินสด (SVG Interactive), ป้ายสถานะความเสี่ยง, สรุปสถิติอันตราย, และ AI Prescriptive Recommendations พร้อมเปรียบเทียบก่อน-หลัง พร้อมแก้ syntax error และเชื่อมต่อหน้าใน `App.jsx`
- [x] เพิ่มช่อง Monthly Budget ใน `CashflowPage.jsx` กรอกยอดรวมรายรับ-รายจ่ายต่อเดือน + วันที่ได้รับเงิน (บันทึกใน localStorage) และอัปเดต `cashflowEngine.js` ให้นำยอดรวมรายเดือนมาคำนวณคาดการณ์สภาพคล่องแทนการบันทึกรายการย่อยทีละวัน (รายจ่ายกระจายเฉลี่ยรายวันอัตโนมัติ)
- [x] แก้ไข Focus Target ไม่ตรงกับวิธีชำระหนี้: `App.jsx` ส่ง prop `manualStrategy` ไปยัง `PaymentHistoryPage.jsx` และหน้าใช้ `calculateDebtPayoff(debts, extraBudget, manualStrategy)` เพื่อให้ 🔥 Focus Target #1, แบนเนอร์ AI และการเลือกรายการในฟอร์มบันทึกชำระเงินอัปเดตตามวิธีที่ user เลือก (Avalanche → Snowball ฯลฯ)
- [x] เพิ่ม Regression Check ตรึง Focus Target ให้ตรงกับวิธีชำระหนี้ที่เลือก: สร้าง `getFocusDebtId()` ใน `debtEngine.js` (หน้า `PaymentHistoryPage.jsx` ใช้ฟังก์ชันนี้แทนโค้ด inline), ติดตั้ง Vitest + สคริปต์ `npm test`, และเขียน `debtEngine.test.js` ครอบทั้ง 5 กลยุทธ์ (Avalanche/Snowball/Tsunami/Snowflake/Landslide) ว่าหนี้เป้าหมายอันดับ 1 ต้องตรงกับวิธีที่ user เลือก พร้อมกรณีปิดหนี้แล้ว/ไม่มีหนี้ (รัน `npm test` ได้ 10/10 ผ่าน)
- [x] เพิ่ม Unit Test ครอบ Heuristic การอ่าน OCR: ย้ายฟังก์ชัน parsing (parseOcrText/extractNumbers/findAmountNear/findInterestRate/findDueDate) ออกจาก `OcrScanner.jsx` ไปยังโมดูลบริสุทธิ์ `src/utils/ocrParser.js` และเขียน `ocrParser.test.js` 19 เทสต์ด้วยข้อความใบแจ้งหนี้จริง (KTC/สินเชื่อส่วนบุคคล) ครอบการดึง ยอดหนี้/ดอกเบี้ย/ขั้นต่ำ/วันครบกำหนด, ข้ามเลขปี พ.ศ. (2569) และเลขเปอร์เซ็นต์, การ fallback หายอด/ขั้นต่ำ 5%, การเลือกรูปแบบวันที่ไทย/ตัวเลข — พร้อมแก้ 2 บั๊กที่เทสต์จับได้: (1) เลขค่าธรรมเนียมที่อยู่ก่อนป้ายชื่อแย่งยอดหนี้จริง ใช้กฎ label-then-value + วัดระยะจากท้ายป้ายชื่อ, (2) สระ/วรรณยุกต์ไทย (combining marks) ทำให้ความยาวป้ายชื่อเพี้ยน ใช้ `visibleLength()` นับเฉพาะพยัญชนะ/สระหลัก (รัน `npm test` ผ่าน 29/29)
- [x] แก้ AI อ่านรูปภาพภาษาอังกฤษไม่ได้: (1) `ocrParser.js` ค้นหาคีย์เวิร์ดแบบ case-insensitive (เดิม "New Balance" หาไม่เจอคีย์เวิร์ด 'balance') + รองรับชื่อเดือนภาษาอังกฤษ ("August 12, 2026" / "12 August 2026"), (2) แก้ `isYearLike` ให้ตรวจจับปีจากบริบทเท่านั้น (เลข 4 หลักที่อยู่หลังเดือน/วันที่) เพื่อไม่ให้ทิ้งยอดหนี้ในช่วง 1950-2699 (เช่น $2,345.67), (3) ลด floor ของยอดขั้นต่ำจาก 100 เป็น 20 เพื่อให้จับขั้นต่ำเล็ก ๆ (เช่น $75), (4) `OcrScanner.jsx` สร้าง worker แบบ resilient — ถ้าโหลดไทย+อังกฤษไม่สำเร็จ (pack ใด pack หนึ่งดาวน์โหลดไม่ได้) จะ retry เป็นภาษาอังกฤษอย่างเดียวเพื่อให้อ่านภาพต่อได้ (เพิ่มเทสต์ภาษาอังกฤษใน `ocrParser.test.js`)
- [x] แก้ Focus Target บนหน้าบันทึกชำระหนี้ไม่เปลี่ยนตามวิธีชำระหนี้ (รากของบั๊ก): เดิม `getFocusDebtId` ใช้ลำดับท้ายสุดของ simulation (`debtPayoffDetails` = หนี้ก้อนสุดท้ายที่ปิด ไม่ได้เปลี่ยนตามวิธีบนข้อมูลจริง) — แก้เป็นใช้ `getPriorityDebtId()` เรียงหนี้ที่ยังมีหนี้คงเหลืออยู่ตาม `strategyComparator()` (กฎเดียวกันกับ simulation) ทำให้ Focus เปลี่ยนตามวิธีที่เลือกจริง (Avalanche→หนี้ดอกสูงสุด, Snowball→ยอดน้อยสุด, Tsunami→ขั้นต่ำสูงสุด, Snowflake→น้ำหนักน้อยสุด, Landslide→ยอดมากสุด) พร้อมเพิ่ม regression test ด้วยข้อมูลผู้ใช้จริง user1
