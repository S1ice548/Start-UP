import React, { useState, useMemo, useEffect } from 'react';
import {
  UserRound,
  Briefcase,
  Banknote,
  Building2,
  Percent,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Home,
  CheckCircle2,
  Camera,
  MessageCircle,
  MapPin,
  CalendarClock,
  Landmark
} from 'lucide-react';
import FormattedNumberInput from './FormattedNumberInput';
import { OCCUPATIONS } from '../utils/refinanceCalculator';
import { THAI_PROVINCES } from '../data/thaiProvinces';
import { getProvinceRateInfo, RATE_TIERS } from '../data/provinceRateModifiers';

const OCCUPATION_OPTIONS = [
  { value: 'salaried', label: '👔 พนักงานเงินเดือน', desc: 'พนักงานบริษัทเอกชน รับเงินเดือนประจำ' },
  { value: 'government', label: '🏛️ ข้าราชการ / รัฐวิสาหกิจ', desc: 'ข้าราชการ พนักงานรัฐวิสาหกิจ รัฐบาล' },
  { value: 'freelance', label: '💻 ฟรีแลนซ์ / อาชีพอิสระ', desc: 'รับจ้างอิสระ ไม่มีเงินเดือนประจำ' },
  { value: 'business', label: '🏢 เจ้าของกิจการ', desc: 'เป็นเจ้าของธุรกิจ มีหนังสือรับรองบริษัท' },
  { value: 'pensioner', label: '👵 ผู้รับบำนาญ / เกษียณ', desc: 'เกษียณอายุ รับบำนาญ' },
  { value: 'other', label: '✍️ อื่นๆ (ระบุเอง)', desc: 'กรุณาระบุประเภทอาชีพเอง' }
];

/**
 * RefinanceWizard — conversational single-question-per-step wizard.
 *
 * Props:
 *   form              — current form state
 *   setForm           — setter to update form
 *   onComplete        — callback when wizard finishes (all questions answered)
 *   ocrData           — optional OCR extracted data for auto-fill
 *   ocrDebts          — full list of OCR debts (for home loan picker)
 */
export default function RefinanceWizard({ form, setForm, onComplete, ocrData = null, ocrDebts = [] }) {
  // Find all HOME_LOAN debts — check multiple fields + keyword fallback
  const homeLoans = useMemo(() => {
    const isHomeLoan = (d) => {
      // 1. Check debtCategory field (from OCR import)
      if (d.debtCategory === 'HOME_LOAN') return true;
      // 2. Check category field (from mockData: 'mortgage')
      if (d.category === 'mortgage') return true;
      // 3. Keyword fallback in name/lender
      const txt = `${d.name || ''} ${d.lender || ''}`.toLowerCase();
      return txt.includes('บ้าน') || txt.includes('home') || txt.includes('สินเชื่อบ้าน') || txt.includes('จำนอง');
    };
    return (ocrDebts || []).filter(isHomeLoan);
  }, [ocrDebts]);

  const hasHomeLoans = homeLoans.length > 0;
  const hasMultipleHomeLoans = homeLoans.length > 1;

  // Auto-select home loan on mount: always use debt data as source of truth
  useEffect(() => {
    if (homeLoans.length === 0) return;
    const loan = homeLoans[0];
    setForm(prev => {
      const loanBalance = Number(loan.totalBalance || loan.balance || 0);
      const loanRate = Number(loan.interestRate || loan.rate || 0);
      return {
        ...prev,
        // Auto-select if exactly 1 home loan
        selectedHomeLoanId: homeLoans.length === 1 ? loan.id : prev.selectedHomeLoanId,
        // Always update balance/rate from debt data
        currentBalance: loanBalance > 0 ? loanBalance : prev.currentBalance,
        currentRate: loanRate > 0 ? loanRate : prev.currentRate
      };
    });
  }, [ocrDebts]);

  // Selected home loan (from picker or auto-selected)
  const selectedHomeLoan = useMemo(() => {
    if (form.selectedHomeLoanId) {
      return (ocrDebts || []).find(d => d.id === form.selectedHomeLoanId) || null;
    }
    // If no explicit selection but there's exactly 1, use it
    if (homeLoans.length === 1) return homeLoans[0];
    return null;
  }, [form.selectedHomeLoanId, ocrDebts, homeLoans]);

  // Sync balance/rate from selected home loan — debt data is source of truth
  useEffect(() => {
    if (!selectedHomeLoan) return;
    const loanBalance = Number(selectedHomeLoan.totalBalance || selectedHomeLoan.balance || 0);
    const loanRate = Number(selectedHomeLoan.interestRate || selectedHomeLoan.rate || 0);
    setForm(prev => {
      const updated = { ...prev };
      if (loanBalance > 0) updated.currentBalance = loanBalance;
      if (loanRate > 0) updated.currentRate = loanRate;
      return updated;
    });
  }, [selectedHomeLoan]);

  // Auto-fill name from OCR
  const autoFillName = useMemo(() => {
    if (ocrData?.name) return ocrData.name;
    return form.name || '';
  }, [ocrData, form.name]);

  // Build dynamic sub-steps: if multiple home loans → show picker
  const STEP_DEFS = useMemo(() => {
    const steps = [];
    if (hasMultipleHomeLoans) {
      steps.push({ key: 'homeLoanPicker', label: 'เลือกหนี้บ้าน' });
    }
    steps.push(
      { key: 'name', label: 'ชื่อ' },
      { key: 'occupation', label: 'อาชีพ' },
      { key: 'income', label: 'รายได้' },
      { key: 'balance', label: 'ยอดหนี้' },
      { key: 'rate', label: 'ดอกเบี้ย' },
      { key: 'province', label: 'จังหวัด' },
      { key: 'remainingMonths', label: 'เหลือผ่อน' },
      { key: 'mrta', label: 'MRTA' },
      { key: 'summary', label: 'ตรวจสอบ' }
    );
    return steps;
  }, [hasMultipleHomeLoans]);

  const totalSteps = STEP_DEFS.length;
  const [subStep, setSubStep] = useState(0);

  // Apply balance/rate from selected home loan into form (when leaving picker)
  const applyHomeLoanDefaults = (loan) => {
    setForm(prev => ({
      ...prev,
      selectedHomeLoanId: loan?.id || prev.selectedHomeLoanId,
      currentBalance: Number(loan?.totalBalance || loan?.balance || 0) || prev.currentBalance,
      currentRate: Number(loan?.interestRate || loan?.rate || 0) || prev.currentRate
    }));
  };

  const currentStepKey = STEP_DEFS[subStep]?.key;

  const canNext = () => {
    switch (currentStepKey) {
      case 'homeLoanPicker': return !!form.selectedHomeLoanId;
      case 'name': return form.name && form.name.trim().length > 0;
      case 'occupation': return form.occupation && OCCUPATIONS.includes(form.occupation);
      case 'income': return Number(form.monthlyIncome) > 0;
      case 'balance': return Number(form.currentBalance) > 0;
      case 'rate': return Number(form.currentRate) >= 0;
      case 'province': return form.province && form.province.trim().length > 0;
      case 'remainingMonths': return Number(form.remainingMonths) > 0;
      case 'mrta': return true;
      case 'summary': return true;
      default: return false;
    }
  };

  const goNext = () => {
    // When leaving homeLoanPicker, apply defaults
    if (currentStepKey === 'homeLoanPicker' && selectedHomeLoan) {
      applyHomeLoanDefaults(selectedHomeLoan);
    }
    if (subStep < totalSteps - 1) {
      setSubStep(subStep + 1);
    } else {
      onComplete();
    }
  };

  const goBack = () => {
    if (subStep > 0) setSubStep(subStep - 1);
  };

  const progress = Math.round(((subStep) / (totalSteps - 1)) * 100);

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500">กำลังกรอกข้อมูลรีไฟแนนซ์</span>
          <span className="text-xs font-bold text-indigo-600">{subStep + 1}/{totalSteps}</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Chat-style question card */}
      <div className="space-y-3 animate-fade-in">

        {/* ===== Sub-step: Home Loan Picker (conditional) ===== */}
        {currentStepKey === 'homeLoanPicker' && (
          <QuestionCard
            icon={<Landmark className="w-5 h-5 text-indigo-600" />}
            botMessage={`🤖 AI ตรวจพบสินเชื่อบ้าน ${homeLoans.length} รายการในระบบค่ะ 🏠\nเลือกหนี้บ้านที่ต้องการรีไฟแนนซ์เลยนะค่ะ`}
          >
            <div className="space-y-2 mt-3">
              {homeLoans.map(loan => {
                const isSelected = form.selectedHomeLoanId === loan.id;
                const balance = Number(loan.totalBalance || loan.balance || 0);
                const rate = Number(loan.interestRate || loan.rate || 0);
                return (
                  <button
                    key={loan.id}
                    onClick={() => setForm({ ...form, selectedHomeLoanId: loan.id })}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 shadow-md ring-1 ring-indigo-400/20'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{loan.name || loan.lender || 'สินเชื่อบ้าน'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">ผู้ให้กู้: {loan.lender || '-'}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-indigo-700 font-bold">฿{balance.toLocaleString()}</span>
                      <span className="text-rose-600 font-bold">{rate}% / ปี</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </QuestionCard>
        )}

        {/* ===== Sub-step: Name ===== */}
        {currentStepKey === 'name' && (
          <QuestionCard
            icon={<UserRound className="w-5 h-5 text-indigo-600" />}
            botMessage="สวัสดีครับ! 🏠 ผมจะช่วยคำนวณเปรียบเทียบรีไฟแนนซ์บ้านให้ เริ่มจากชื่อ-นามสกุล ของผู้ยื่นกู้เลยนะครับ"
            placeholder="เช่น สมชาย ใจดี"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            autoFill={autoFillName}
            showOcrBadge={!!autoFillName}
            inputType="text"
          />
        )}

        {/* ===== Sub-step: Occupation ===== */}
        {currentStepKey === 'occupation' && (
          <QuestionCard
            icon={<Briefcase className="w-5 h-5 text-indigo-600" />}
            botMessage={`สวัสดีครับ คุณ${form.name || ''} 👋\nตอนนี้ทำอาชีพอะไรอยู่ครับ? เลือกประเภทอาชีพของคุณเลย`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {OCCUPATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, occupation: opt.value })}
                  className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${form.occupation === opt.value
                      ? 'border-indigo-500 bg-indigo-50/60 shadow-md ring-1 ring-indigo-400/20'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                    }`}
                >
                  <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                  {form.occupation === opt.value && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 float-right -mt-5" />
                  )}
                </button>
              ))}
            </div>
            {form.occupation === 'other' && (
              <input
                type="text"
                placeholder="กรุณาระบุอาชีพของคุณ..."
                value={form.customOccupation || ''}
                onChange={(e) => setForm({ ...form, customOccupation: e.target.value })}
                className="input-dark mt-3"
              />
            )}
          </QuestionCard>
        )}

        {/* ===== Sub-step: Monthly Income ===== */}
        {currentStepKey === 'income' && (
          <QuestionCard
            icon={<Banknote className="w-5 h-5 text-emerald-600" />}
            botMessage="มีรายได้ต่อเดือนเท่าไหร่ครับ? (รวมเงินเดือน โบนัส เบี้ยเลี้ยง ทุกแหล่ง)"
          >
            <div className="mt-3">
              <FormattedNumberInput
                value={form.monthlyIncome || 0}
                onChange={(v) => setForm({ ...form, monthlyIncome: v })}
                min={0}
                prefix="฿"
                placeholder="เช่น 30,000"
                className="[&_input]:input-dark [&_input]:text-lg [&_input]:font-black [&_input]:text-emerald-600"
              />
            </div>
          </QuestionCard>
        )}

        {/* ===== Sub-step: Current Balance ===== */}
        {currentStepKey === 'balance' && (
          <QuestionCard
            icon={<Building2 className="w-5 h-5 text-indigo-600" />}
            botMessage={selectedHomeLoan
              ? `🤖 AI ดึงข้อมูลจากหนี้ "${selectedHomeLoan.name || selectedHomeLoan.lender || 'สินเชื่อบ้าน'}" แล้วค่ะ\nยอดหนี้บ้านคงเหลือ ฿${Number(selectedHomeLoan.totalBalance || selectedHomeLoan.balance || 0).toLocaleString()}\nตรวจสอบให้ถูกต้องแล้วกดถัดไปเลยนะค่ะ 💡`
              : 'ยอดหนี้บ้านคงเหลือตอนนี้เท่าไหร่ครับ? 💡 (ดูในสัญญาเงินกู้ หรือถามธนาคารได้ครับ)'}
          >
            <div className="mt-3 relative">
              {selectedHomeLoan && (
                <div className="absolute -top-1 left-0 flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  AI ตรวจพบอัตโนมัติ
                </div>
              )}
              <FormattedNumberInput
                value={form.currentBalance || 0}
                onChange={(v) => setForm({ ...form, currentBalance: v })}
                min={0}
                prefix="฿"
                placeholder="เช่น 1,000,000"
                className="[&_input]:input-dark [&_input]:text-lg [&_input]:font-black [&_input]:text-indigo-600"
              />
            </div>
          </QuestionCard>
        )}

        {/* ===== Sub-step: Interest Rate ===== */}
        {currentStepKey === 'rate' && (
          <QuestionCard
            icon={<Percent className="w-5 h-5 text-rose-600" />}
            botMessage={selectedHomeLoan
              ? `🤖 AI ดึงข้อมูลจากหนี้ "${selectedHomeLoan.name || selectedHomeLoan.lender || 'สินเชื่อบ้าน'}" แล้วค่ะ\nอัตราดอกเบี้ยปัจจุบัน ${selectedHomeLoan.interestRate || selectedHomeLoan.rate || '-'}% / ปี\nตรวจสอบให้ถูกต้องแล้วกดถัดไปเลยนะค่ะ 📊`
              : 'อัตราดอกเบี้ยปัจจุบันเท่าไหร่ครับ? 📊 (ดูในใบแจ้งหนี้ธนาคาร หรือ app ธนาคารได้เลย)'}
          >
            <div className="mt-3 relative">
              {selectedHomeLoan && (
                <div className="absolute -top-1 left-0 flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  AI ตรวจพบอัตโนมัติ
                </div>
              )}
              <FormattedNumberInput
                value={form.currentRate || 0}
                onChange={(v) => setForm({ ...form, currentRate: v })}
                min={0}
                max={100}
                step={0.01}
                suffix="%"
                placeholder="เช่น 6.0"
                className="[&_input]:input-dark [&_input]:text-lg [&_input]:font-black [&_input]:text-rose-600"
              />
            </div>
          </QuestionCard>
        )}

        {/* ===== Sub-step: Province ===== */}
        {currentStepKey === 'province' && (
          <QuestionCard
            icon={<MapPin className="w-5 h-5 text-emerald-600" />}
            botMessage="บ้านที่ต้องการรีไฟแนนซ์ตั้งอยู่จังหวัดอะไรครับ? 📍"
          >
            <div className="mt-3">
              <select
                value={form.province || ''}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="input-dark cursor-pointer text-sm"
              >
                <option value="">— เลือกจังหวัด —</option>
                {THAI_PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {(() => {
                const rateInfo = getProvinceRateInfo(form.province);
                if (!rateInfo) return null;
                const tierData = RATE_TIERS.find(t => t.tier === rateInfo.tier);
                const colorMap = { emerald: 'emerald', blue: 'blue', amber: 'amber', orange: 'orange' };
                const c = colorMap[tierData?.color || 'amber'];
                return (
                  <div className={`mt-3 p-3 rounded-xl border bg-${c}-50/60 border-${c}-200 space-y-1.5`}>
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-3.5 h-3.5 text-${c}-600`} />
                      <span className={`text-xs font-bold text-${c}-700`}>{tierData?.emoji} {form.province} — {rateInfo.label}</span>
                      {rateInfo.modifier > 0 && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-${c}-200 text-${c}-800`}>+{rateInfo.modifier}%</span>
                      )}
                      {rateInfo.modifier === 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">อัตราต่ำสุด</span>
                      )}
                    </div>
                    <p className={`text-[11px] text-${c}-600 leading-relaxed`}>{tierData?.desc}</p>
                  </div>
                );
              })()}
            </div>
          </QuestionCard>
        )}

        {/* ===== Sub-step: Remaining Months ===== */}
        {currentStepKey === 'remainingMonths' && (
          <QuestionCard
            icon={<CalendarClock className="w-5 h-5 text-amber-600" />}
            botMessage="เหลือเวลาผ่อนอีกกี่เดือนครับ? ⏳ (นับจากวันนี้จนครบสัญญาเงินกู้)"
          >
            <div className="mt-3">
              <FormattedNumberInput
                value={form.remainingMonths || 0}
                onChange={(v) => setForm({ ...form, remainingMonths: v })}
                min={1}
                max={600}
                suffix="เดือน"
                placeholder="เช่น 180"
                className="[&_input]:input-dark [&_input]:text-lg [&_input]:font-black [&_input]:text-amber-600"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">ระบุจำนวนเดือนที่เหลืออยู่ในสัญญาเดิม</p>
            </div>
          </QuestionCard>
        )}

        {/* ===== Sub-step: MRTA ===== */}
        {currentStepKey === 'mrta' && (
          <QuestionCard
            icon={<ShieldCheck className="w-5 h-5 text-indigo-600" />}
            botMessage="ต้องการซื้อประกัน MRTA (ประกันชีวิตคุ้มครองสินเชื่อบ้าน) ด้วยไหมครับ? 🛡️"
          >
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setForm({ ...form, wantMRTA: true })}
                className={`flex-1 p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${form.wantMRTA
                    ? 'border-emerald-500 bg-emerald-50/60 shadow-md'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                  }`}
              >
                <ShieldCheck className={`w-8 h-8 mx-auto mb-2 ${form.wantMRTA ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div className="text-sm font-bold text-slate-900">✅ ต้องการ MRTA</div>
                <div className="text-[11px] text-slate-500 mt-1">เปิดสิทธิ์ฟรีค่าจดจำนอง/ค่าประเมิน</div>
              </button>
              <button
                onClick={() => setForm({ ...form, wantMRTA: false })}
                className={`flex-1 p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${!form.wantMRTA
                    ? 'border-slate-400 bg-slate-50/60 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
              >
                <ShieldCheck className={`w-8 h-8 mx-auto mb-2 ${!form.wantMRTA ? 'text-slate-600' : 'text-slate-400'}`} />
                <div className="text-sm font-bold text-slate-900">❌ ไม่ต้องการ</div>
                <div className="text-[11px] text-slate-500 mt-1">ไม่ทำประกัน MRTA</div>
              </button>
            </div>
          </QuestionCard>
        )}

        {/* ===== Sub-step: Summary ===== */}
        {currentStepKey === 'summary' && (
          <QuestionCard
            icon={<Sparkles className="w-5 h-5 text-indigo-600" />}
            botMessage={`ตรวจสอบข้อมูลให้หน่อยนะครับ คุณ${form.name || ''} 📋\nถ้าถูกต้องกดคำนวณเลย!`}
          >
            <div className="space-y-2 mt-3">
              {selectedHomeLoan && (
                <SummaryRow label="หนี้บ้านที่เลือก" value={selectedHomeLoan.name || selectedHomeLoan.lender || '-'} color="text-indigo-600" />
              )}
              <SummaryRow label="ชื่อผู้ยื่นกู้" value={form.name || '-'} />
              <SummaryRow label="ประเภทอาชีพ" value={OCCUPATION_OPTIONS.find(o => o.value === form.occupation)?.label || form.occupation} />
              <SummaryRow label="รายได้ต่อเดือน" value={`฿${Number(form.monthlyIncome || 0).toLocaleString()}`} color="text-emerald-600" />
              <SummaryRow label="ยอดหนี้บ้านคงเหลือ" value={`฿${Number(form.currentBalance || 0).toLocaleString()}`} color="text-indigo-600" />
              <SummaryRow label="อัตราดอกเบี้ยปัจจุบัน" value={`${form.currentRate}% / ปี`} color="text-rose-600" />
              <SummaryRow label="จังหวัดที่ตั้งบ้าน" value={form.province || '-'} color="text-emerald-600" />
              <SummaryRow label="เหลือเวลาผ่อน" value={form.remainingMonths ? `${form.remainingMonths} เดือน` : '-'} color="text-amber-600" />
              <SummaryRow label="ประกัน MRTA" value={form.wantMRTA ? '✅ ต้องการ' : '❌ ไม่ต้องการ'} />
            </div>
          </QuestionCard>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={subStep === 0}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${subStep === 0
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer border border-slate-200 hover:border-indigo-300'
            }`}
        >
          <ArrowLeft className="w-4 h-4" />
          ย้อนกลับ
        </button>

        <button
          onClick={goNext}
          disabled={!canNext()}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold transition-all shadow-lg ${canNext()
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:shadow-indigo-500/50 active:scale-[0.98] cursor-pointer'
              : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
            }`}
        >
          {currentStepKey === 'summary' ? (
            <>
              <Sparkles className="w-4 h-4" />
              คำนวณและเปรียบเทียบ!
            </>
          ) : (
            <>
              ถัดไป
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ===== Helper Components ===== */

function QuestionCard({ icon, botMessage, children, value, onChange, autoFill, showOcrBadge, inputType = 'text', placeholder }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Bot message bubble */}
      <div className="bg-indigo-50/60 px-5 py-4 border-b border-indigo-100/60">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">NeeNoi AI</div>
            <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-line">{botMessage}</p>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="p-5">
        {children ? children : (
          <div className="relative">
            {showOcrBadge && (
              <div className="absolute -top-1 left-0 flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                <Camera className="w-3 h-3" />
                ดึงจาก OCR อัตโนมัติ
              </div>
            )}
            <input
              type={inputType}
              placeholder={placeholder}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="input-dark text-lg font-bold mt-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-xl border border-slate-100">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}
