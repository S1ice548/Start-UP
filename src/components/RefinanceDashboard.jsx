import React, { useState, useMemo, useEffect } from 'react';
import {
  Home,
  ChevronRight,
  Landmark,
  Wallet,
  Percent,
  Building2,
  FileDown,
  RefreshCw,
  Sparkles,
  Info,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Banknote,
  CalendarClock,
  BadgePercent,
  FileText,
  ShieldCheck,
  UserRound,
  Square,
  CheckSquare
} from 'lucide-react';
import { calculateRefinanceSavings, formatBaht, OCCUPATIONS } from '../utils/refinanceCalculator';
import { getRequiredDocChecklist, OCCUPATION_LABELS } from '../utils/documentChecklist';
import { buildRefinancePdf } from '../utils/pdfPackager';
import BankLogo from './BankLogo';
import { useBankOffers } from '../hooks/useBankOffers';
import { getProvinceRateInfo, RATE_TIERS } from '../data/provinceRateModifiers';
import FormattedNumberInput from './FormattedNumberInput';
import StepBackButton from './StepBackButton';
import RefinanceWizard from './RefinanceWizard';

/** Occupations shown in the form dropdown (Thai labels). */
const OCCUPATION_OPTIONS = [
  { value: 'salaried', label: '👔 พนักงานเงินเดือน (Salaried)' },
  { value: 'government', label: '🏛️ ข้าราชการ / พนักงานรัฐวิสาหกิจ (Government)' },
  { value: 'freelance', label: '💻 ฟรีแลนซ์ / อาชีพอิสระ (Freelance)' },
  { value: 'business', label: '🏢 เจ้าของกิจการ / ธุรกิจ (Business Owner)' },
  { value: 'pensioner', label: '👵 ผู้รับบำนาญ / เกษียณอายุ (Pensioner)' },
  { value: 'other', label: '✍️ อื่นๆ (ระบุอาชีพเอง)' }
];

export default function RefinanceDashboard({ userName = 'User', onBack, onNavigateToConsolidation, ocrDebts = [] }) {
  const { lastUpdatedBadge, lowestRate } = useBankOffers();
  // ---------- Persistent form state ----------
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(`nee_noi_refinance_form_${userName}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore malformed */ }
    }
    return {
      name: userName || '',
      monthlyIncome: 30000,
      occupation: 'salaried',
      customOccupation: '',
      currentBalance: 1000000,
      currentRate: 6.0,
      wantMRTA: true,
      selectedHomeLoanId: '',
      province: '',
      remainingYears: 15
    };
  });

  // ---------- Wizard step: 1 = input (wizard), 2 = comparison, 3 = action ----------
  const [step, setStep] = useState(1);
  const [selectedPkgId, setSelectedPkgId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  // ---------- Interactive checklist state (persisted) ----------
  const [checklist, setChecklist] = useState(() => {
    const saved = localStorage.getItem(`nee_noi_refinance_checklist_${userName}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Persist form + checklist
  useEffect(() => {
    localStorage.setItem(`nee_noi_refinance_form_${userName}`, JSON.stringify(form));
  }, [form, userName]);
  useEffect(() => {
    localStorage.setItem(`nee_noi_refinance_checklist_${userName}`, JSON.stringify(checklist));
  }, [checklist, userName]);

  // ---------- Calculation (pure engine, memoized) ----------
  const calculation = useMemo(() => {
    const income = Number(form.monthlyIncome) || 0;
    const balance = Number(form.currentBalance) || 0;
    const rate = Number(form.currentRate) || 0;
    if (income <= 0 || balance <= 0) return null;
    return calculateRefinanceSavings({
      currentBalance: balance,
      currentRate: rate,
      monthlyIncome: income,
      occupation: form.occupation,
      wantMRTA: form.wantMRTA,
      termYears: 3
    });
  }, [form.monthlyIncome, form.currentBalance, form.currentRate, form.occupation, form.wantMRTA]);

  // Default-select the best package when results appear
  useEffect(() => {
    if (calculation?.best) {
      setSelectedPkgId(prev => prev || calculation.best.package.id);
    }
  }, [calculation]);

  const selected = calculation?.results.find(r => r.package.id === selectedPkgId) || calculation?.best || null;
  // ---------- Auto-fill from debts list (AI detection) ----------
  const homeLoans = useMemo(() => {
    const isHomeLoan = (d) => {
      if (d.debtCategory === 'HOME_LOAN') return true;
      if (d.category === 'mortgage') return true;
      const txt = `${d.name || ''} ${d.lender || ''}`.toLowerCase();
      return txt.includes('บ้าน') || txt.includes('home') || txt.includes('สินเชื่อบ้าน') || txt.includes('จำนอง');
    };
    return (ocrDebts || []).filter(isHomeLoan);
  }, [ocrDebts]);

  const autoFillData = useMemo(() => {
    const loan = homeLoans[0];
    if (!loan) return null;
    return {
      name: loan.name || loan.lender || '',
      balance: Number(loan.totalBalance || loan.balance || 0),
      interestRate: Number(loan.interestRate || loan.rate || 0)
    };
  }, [homeLoans]);

  // Auto-fill form from detected home loan — debt data is source of truth
  useEffect(() => {
    if (!autoFillData) return;
    setForm(prev => {
      const updated = { ...prev };
      if (!prev.name && userName) updated.name = userName;
      else if (!prev.name && autoFillData.name) updated.name = autoFillData.name;
      // Always update balance/rate from debt data
      if (autoFillData.balance > 0) updated.currentBalance = autoFillData.balance;
      if (autoFillData.interestRate > 0) updated.currentRate = autoFillData.interestRate;
      return updated;
    });
  }, [autoFillData, userName]);

  const requiredDocs = useMemo(() => getRequiredDocChecklist(form.occupation), [form.occupation]);
  const checkedCount = requiredDocs.filter(doc => checklist[doc.id]).length;

  // ---------- Step 1: validate and go to comparison ----------
  const goToComparison = () => {
    if (!(Number(form.monthlyIncome) > 0)) return setError('⚠️ กรุณากรอกรายได้ต่อเดือน (บาท)');
    if (!(Number(form.currentBalance) > 0)) return setError('⚠️ กรุณากรอกยอดหนี้บ้านคงเหลือ (บาท)');
    if (!(Number(form.currentRate) >= 0)) return setError('⚠️ กรุณากรอกอัตราดอกเบี้ยปัจจุบัน (%)');
    if (!form.occupation || !OCCUPATIONS.includes(form.occupation)) return setError('⚠️ กรุณาเลือกประเภทอาชีพ');
    if (form.occupation === 'other' && (!form.customOccupation || !form.customOccupation.trim())) {
      return setError('⚠️ กรุณาระบุประเภทอาชีพของคุณในช่องกรอกข้อความ');
    }
    if (!form.province || !form.province.trim()) return setError('⚠️ กรุณาเลือกจังหวัดที่ตั้งบ้าน');
    if (!(Number(form.remainingYears) > 0)) return setError('⚠️ กรุณาระบุจำนวนปีที่เหลือเวลาผ่อน');
    setError('');
    setMessage('');
    setStep(2);
  };

  // ---------- Step 3: generate & download the PDF pack ----------
  const handleDownload = async () => {
    if (!selected || !calculation) return;
    setGenerating(true);
    setMessage('');
    try {
      const bytes = await buildRefinancePdf({
        applicantName: form.name || userName,
        occupationLabel: form.occupation === 'other' ? (form.customOccupation || 'อื่นๆ (ระบุ)') : (OCCUPATION_LABELS[form.occupation] || form.occupation),
        monthlyIncome: Number(form.monthlyIncome) || 0,
        wantMRTA: !!form.wantMRTA,
        calculation,
        selected,
        checklist: requiredDocs
      });
      // Trigger browser download of the generated bytes
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Walkin-Refinance-${selected.bankShort}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(`✅ ดาวน์โหลด Walk-in PDF Pack (${selected.bankShort}) เรียบร้อย พร้อมพิมพ์ไปยื่นที่สาขา!`);
    } catch (err) {
      setMessage(`❌ สร้าง PDF ไม่สำเร็จ: ${err.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setGenerating(false);
    }
  };

  // ---------- Toggle a checklist item ----------
  const toggleDoc = (id) => {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="ref-page space-y-6 animate-fade-in pb-16">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <button onClick={onBack} className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer">
          <Home className="w-3.5 h-3.5" />
          <span>หน้าหลัก</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-indigo-600 font-bold flex items-center gap-1.5 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
          <Landmark className="w-3.5 h-3.5" />
          เครื่องคำนวณรีไฟแนนซ์ & ชุดเอกสารยื่นสาขา
        </span>
      </div>

      {/* Header hero */}
      <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-md relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="badge-gold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Refinance Calculator & Walk-in Document Packager
            </span>
            <h1 className="text-2xl font-black text-slate-900 pt-2 tracking-tight">
              รีไฟแนนซ์บ้าน ลดดอกเบี้ย ลดค่างวด
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1 max-w-xl leading-relaxed">
              เปรียบเทียบโปรโมชันรีไฟแนนซ์จากธนาคารชั้นนำจากข้อมูลในแอป (ไม่ใช้ API ธนาคาร)
              คำนวณยอดประหยัดสุทธิ พร้อมดาวน์โหลด PDF ชุดเอกสารไปยื่นที่สาขาเองได้เลย
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-[11px] bg-indigo-50/70 border border-indigo-100 rounded-xl px-3 py-2 text-indigo-700 font-bold">
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              <Sparkles className="w-3.5 h-3.5" />
              {lastUpdatedBadge}
            </span>
            <span className="text-slate-400">|</span>
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              อัตราดอกเบี้ยเริ่มต้น {lowestRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-bold">
        {[
          { n: 1, label: 'กรอกข้อมูล' },
          { n: 2, label: 'เปรียบเทียบแพ็กเกจ' },
          { n: 3, label: 'ดาวน์โหลดชุดเอกสาร' }
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && <span className="h-px flex-1 bg-slate-300 max-w-10" />}
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
              step === s.n
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25'
                : step > s.n
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white text-slate-500 border-slate-200'
            }`}>
              <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black ${
                step === s.n ? 'bg-white text-indigo-700' : step > s.n ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {step > s.n ? '✓' : s.n}
              </span>
              {s.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* ============ STEP 1: WIZARD INPUT ============ */}
      {step === 1 && (
        <RefinanceWizard
          form={form}
          setForm={setForm}
          ocrData={autoFillData}
          ocrDebts={ocrDebts}
          onComplete={() => {
            setError('');
            setMessage('');
            setStep(2);
          }}
        />
      )}

      {/* Floating back button */}
      <StepBackButton
        currentStep={step}
        totalSteps={3}
        onClick={() => setStep(step - 1)}
        label={step === 2 ? 'แก้ไขข้อมูล' : 'เปลี่ยนแพ็กเกจ'}
        visible={step >= 2}
      />

      {/* ============ STEP 2: COMPARISON ============ */}
      {step === 2 && calculation && (
        <div className="space-y-5">
          {/* Current situation summary */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-xs text-slate-500 font-medium">ยอดหนี้ปัจจุบัน</div>
              <div className="text-lg font-black text-indigo-600">{formatBaht(calculation.current.balance)}</div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-xs text-slate-500 font-medium">ดอกเบี้ยปัจจุบัน</div>
              <div className="text-lg font-black text-rose-600">{calculation.current.rate}% / ปี</div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-xs text-slate-500 font-medium">ค่างวดปัจจุบัน</div>
              <div className="text-lg font-black text-slate-900">{formatBaht(calculation.current.monthly)}/เดือน</div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-xs text-slate-500 font-medium">ดอกเบี้ยรวม 3 ปี (ปัจจุบัน)</div>
              <div className="text-lg font-black text-slate-900">{formatBaht(calculation.current.totalInterest)}</div>
            </div>
          </div>

          {/* Province rate info */}
          {form.province && (() => {
            const rateInfo = getProvinceRateInfo(form.province);
            if (!rateInfo) return null;
            const tierData = RATE_TIERS.find(t => t.tier === rateInfo.tier);
            const c = tierData?.color || 'amber';
            return (
              <div className={`p-3.5 rounded-xl border bg-${c}-50/60 border-${c}-200 flex items-start gap-3`}>                
                <span className="text-lg flex-shrink-0 mt-0.5">{tierData?.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold text-${c}-700`}>{form.province}</span>
                    <span className={`text-[10px] font-semibold text-${c}-600`}>{rateInfo.label}</span>
                    {rateInfo.modifier > 0 ? (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-${c}-200 text-${c}-800`}>+{rateInfo.modifier}% จาก base</span>
                    ) : (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">อัตราต่ำสุด</span>
                    )}
                  </div>
                  <p className={`text-[11px] text-${c}-600 leading-relaxed`}>{tierData?.desc}</p>
                </div>
              </div>
            );
          })()}

          {/* Eligible note */}
          <div className="text-xs text-slate-500 font-medium bg-indigo-50/60 border border-indigo-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
            <BadgePercent className="w-4 h-4 text-indigo-600" />
            พบแพ็กเกจที่คุณผ่านเกณฑ์ (รายได้ + อาชีพ) ทั้งหมด <strong className="text-indigo-700">{calculation.results.length} แพ็กเกจ</strong> — เรียงจากดอกเบี้ยที่ประหยัดได้มากที่สุดลงมา
          </div>

          {/* Candidate bank cards */}
          {calculation.results.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700">ไม่พบแพ็กเกจที่ผ่านเกณฑ์</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                จากข้อมูลรายได้และอาชีพที่กรอก ยังไม่มีโปรโมชันใดผ่านเกณฑ์ขั้นต่ำ
                ลองปรับรายได้หรือลองธนาคารอื่นในอนาคตได้
              </p>
              <button onClick={() => setStep(1)} className="btn-secondary text-xs cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> กลับไปแก้ไขข้อมูล
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {calculation.results.map((r, idx) => {
                const isSelected = r.package.id === selectedPkgId;
                const isBest = idx === 0 && r.netSavings > 0;
                return (
                  <button
                    key={r.package.id}
                    onClick={() => setSelectedPkgId(r.package.id)}
                    className={`text-left p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-md'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                    }`}
                  >
                    {isBest && (
                      <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black px-2.5 py-1 rounded-bl-xl rounded-tr-2xl uppercase tracking-wider">
                        ⭐ คุ้มสุด
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <BankLogo bankShort={r.bankShort} logoUrl={r.package.logoUrl} size={34} />
                          <span className="text-sm font-black text-slate-900">{r.bank}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{r.packageTitle}</p>
                      </div>
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                        isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ค่างวดต่อเดือน</div>
                        <div className="text-base font-black text-indigo-600">{formatBaht(r.newMonthly)}</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ดอกเบี้ยเฉลี่ย 3 ปี</div>
                        <div className="text-base font-black text-rose-600">{r.rate3YAvg}%</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ดอกเบี้ยทั้งหมด 3 ปี</div>
                        <div className="text-base font-black text-rose-600">{formatBaht(r.newInterest)}</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ดอกเบี้ยที่ประหยัดได้</div>
                        <div className={`text-base font-black ${r.grossSavings > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatBaht(r.grossSavings)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[11px] text-slate-500 font-medium space-y-1">
                      <div>ค่าธรรมเนียมรวม: <strong className={r.fees.total > 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatBaht(r.fees.total)}</strong></div>
                      {r.fees.breakdown.filter(f => f.waived).length > 0 && (
                        <div className="text-emerald-700 font-bold">
                          🎁 {r.fees.breakdown.filter(f => f.waived).map(f => f.label.replace(' (1%)', '')).join(' + ')} ฟรี!
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="btn-secondary text-xs cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> แก้ไขข้อมูล
            </button>
            <button
              onClick={() => selected && setStep(3)}
              disabled={!selected}
              className="btn-gold text-xs py-3 px-6 font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              เลือกแพ็กเกจนี้ → สร้างชุดเอกสาร
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============ STEP 3: ACTION (download + checklist) ============ */}
      {step === 3 && selected && (
        <div className="space-y-5">
          {/* Selected package recap */}
          <div className="ref-recap text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <BankLogo bankShort={selected.bankShort} logoUrl={selected.package.logoUrl} size={48} />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-200">แพ็กเกจที่เลือก</span>
                  <h2 className="text-xl font-black pt-0.5">{selected.bank} — {selected.packageTitle}</h2>
                  <p className="text-xs text-indigo-100 font-medium mt-1">
                    ดอกเบี้ยเฉลี่ย 3 ปี {selected.rate3YAvg}% • ค่างวดใหม่ {formatBaht(selected.newMonthly)}/เดือน • ประหยัดดอกเบี้ย {formatBaht(selected.grossSavings)}
                  </p>
                </div>
              </div>
              <button onClick={() => setStep(2)} className="text-xs px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 font-bold flex items-center gap-1.5 cursor-pointer transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> เปลี่ยนแพ็กเกจ
              </button>
            </div>
          </div>

          {/* Download button */}
          <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Walk-in Application PDF Package</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    2 หน้า: หน้าปกสรุปการยื่นรีไฟแนนซ์ + รายการเอกสารสำหรับยื่นที่สาขา (พิมพ์ได้ทันที)
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownload}
                disabled={generating}
                className="btn-gold text-xs py-3.5 px-6 font-extrabold cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" />
                {generating ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด Walk-in PDF Pack'}
              </button>
            </div>
            {message && (
              <div className={`mt-4 text-xs font-bold rounded-xl px-3.5 py-2.5 ${
                message.startsWith('✅')
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {message}
              </div>
            )}
          </div>

          {/* Interactive document checklist */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="badge-gold">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Walk-in Submission Checklist
                </span>
                <h3 className="text-lg font-bold text-slate-900 pt-1.5">รายการเอกสารสำหรับยื่นที่สาขา</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  ตามอาชีพ: {OCCUPATION_LABELS[form.occupation]} — กาเครื่องหมายเมื่อเตรียมเอกสารครบ
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-indigo-600">{checkedCount}/{requiredDocs.length}</span>
                <span className="block text-[10px] text-slate-500 font-bold">เตรียมเอกสารแล้ว</span>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {requiredDocs.map(doc => {
                const checked = !!checklist[doc.id];
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                      checked
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : 'bg-slate-50/60 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {checked
                      ? <CheckSquare className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      : <Square className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />}
                    <span>
                      <span className={`text-sm font-bold flex items-center gap-2 ${checked ? 'text-emerald-800 line-through' : 'text-slate-900'}`}>
                        {doc.label}
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                          doc.required ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {doc.required ? 'จำเป็น' : 'ถ้ามี'}
                        </span>
                      </span>
                      <span className="block text-[11px] text-slate-500 font-medium mt-0.5">{doc.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-[11px] text-slate-400 font-medium bg-white/60 border border-slate-200 rounded-xl px-4 py-3 leading-relaxed">
        ⚠️ {calculation?.meta.disclaimer || 'อัตราดอกเบี้ยและโปรโมชันเป็นข้อมูลอ้างอิงในแอป ควรยืนยันกับธนาคารก่อนยื่นกู้'}
      </div>
    </div>
  );
}
