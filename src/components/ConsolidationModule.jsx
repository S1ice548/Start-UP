import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  CheckSquare,
  Square,
  TrendingDown,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileDown,
  Building2,
  Percent,
  Wallet,
  Home,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Banknote,
  DollarSign,
  ArrowLeft,
  MapPin,
  CalendarClock,
  Landmark
} from 'lucide-react';
import { calculateConsolidation, formatCurrency } from '../utils/consolidationEngine';
import { buildRefinancePdf } from '../utils/pdfPackager';
import { useBankOffers } from '../hooks/useBankOffers';
import BankLogo from './BankLogo';
import FormattedNumberInput from './FormattedNumberInput';
import StepBackButton from './StepBackButton';
import { THAI_PROVINCES } from '../data/thaiProvinces';
import { getProvinceRateInfo, RATE_TIERS } from '../data/provinceRateModifiers';

export default function ConsolidationModule({
  debts = [],
  userName = 'ผู้ใช้งาน',
  onNavigateToCalculator
}) {
  const { offers, lowestRate, lastUpdatedBadge, bestOffer } = useBankOffers();

  // ---------- State ----------
  const [selectedBankId, setSelectedBankId] = useState(bestOffer?.bankId || 'CIMBT');
  // Default all high-interest credit cards / personal loans / BNPL as selected
  const [selectedDebtIds, setSelectedDebtIds] = useState(() => {
    return (debts || [])
      .filter(d => {
        const isHome = d.debtCategory === 'HOME_LOAN' || d.category === 'mortgage' ||
          (d.name || '').includes('บ้าน') || (d.name || '').toLowerCase().includes('home');
        return (d.interestRate ?? d.rate ?? 0) >= 10 || (!isHome);
      })
      .map(d => d.id);
  });

  // Home loan configuration state
  const [homeLoanBalance, setHomeLoanBalance] = useState(1500000);
  const [homeLoanPayment, setHomeLoanPayment] = useState(9500);
  const [targetRate, setTargetRate] = useState(lowestRate || 3.49);
  const [termYears, setTermYears] = useState(20);
  const [province, setProvince] = useState('');
  const [remainingYears, setRemainingYears] = useState(15);
  const [selectedHomeLoanId, setSelectedHomeLoanId] = useState('');
  const [step, setStep] = useState(1); // 1=เลือกหนี้, 2=กรอกข้อมูลบ้าน+ธนาคาร, 3=เปรียบเทียบ+ดาวน์โหลด
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  // Find all HOME_LOAN debts in the system — check multiple fields + keyword fallback
  const homeLoans = useMemo(() => {
    const isHomeLoan = (d) => {
      if (d.debtCategory === 'HOME_LOAN') return true;
      if (d.category === 'mortgage') return true;
      const txt = `${d.name || ''} ${d.lender || ''}`.toLowerCase();
      return txt.includes('บ้าน') || txt.includes('home') || txt.includes('สินเชื่อบ้าน') || txt.includes('จำนอง');
    };
    return (debts || []).filter(isHomeLoan);
  }, [debts]);

  // Auto-select single HOME_LOAN on mount
  useEffect(() => {
    if (homeLoans.length === 1 && !selectedHomeLoanId) {
      setSelectedHomeLoanId(homeLoans[0].id);
    }
  }, [homeLoans]);

  // Selected home loan data
  const selectedHomeLoan = useMemo(() => {
    if (selectedHomeLoanId) {
      return (debts || []).find(d => d.id === selectedHomeLoanId) || null;
    }
    if (homeLoans.length === 1) return homeLoans[0];
    return null;
  }, [selectedHomeLoanId, debts, homeLoans]);

  // Auto-fill balance/payment from selected home loan
  useEffect(() => {
    if (selectedHomeLoan) {
      const bal = Number(selectedHomeLoan.totalBalance || selectedHomeLoan.balance || 0);
      const pmt = Number(selectedHomeLoan.minimumPayment || selectedHomeLoan.minPayment || 0);
      if (bal > 0) setHomeLoanBalance(bal);
      if (pmt > 0) setHomeLoanPayment(pmt);
    }
  }, [selectedHomeLoan]);

  // Auto-adjust target rate when province changes
  const provinceRateInfo = useMemo(() => getProvinceRateInfo(province), [province]);
  useEffect(() => {
    if (provinceRateInfo && lowestRate) {
      const adjusted = Math.round((lowestRate + provinceRateInfo.modifier) * 100) / 100;
      setTargetRate(adjusted);
    }
  }, [provinceRateInfo, lowestRate]);

  // Filter out existing home loan from cards list if present
  const consolidatableDebts = useMemo(() => {
    const isHomeLoan = (d) => {
      if (d.debtCategory === 'HOME_LOAN') return true;
      if (d.category === 'mortgage') return true;
      const txt = `${d.name || ''} ${d.lender || ''}`.toLowerCase();
      return txt.includes('บ้าน') || txt.includes('home') || txt.includes('สินเชื่อบ้าน') || txt.includes('จำนอง');
    };
    return (debts || []).filter(d => !isHomeLoan(d));
  }, [debts]);

  // ---------- Toggle Selection ----------
  const toggleSelectDebt = (id) => {
    setSelectedDebtIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return Array.from(next);
    });
  };

  const toggleSelectAll = () => {
    if (selectedDebtIds.length === consolidatableDebts.length) {
      setSelectedDebtIds([]);
    } else {
      setSelectedDebtIds(consolidatableDebts.map(d => d.id));
    }
  };

  // ---------- Math Calculation ----------
  const consolidation = useMemo(() => {
    return calculateConsolidation({
      debts: consolidatableDebts,
      selectedDebtIds,
      currentHomeLoanBalance: homeLoanBalance,
      currentHomeLoanPayment: homeLoanPayment,
      targetInterestRate: targetRate,
      loanTermYears: termYears
    });
  }, [consolidatableDebts, selectedDebtIds, homeLoanBalance, homeLoanPayment, targetRate, termYears]);

  // ---------- Download PDF Application Package ----------
  const handleDownloadPdfPack = async () => {
    try {
      setIsGeneratingPdf(true);
      setPdfSuccess(false);

      const mockPdfData = {
        calculation: {
          currentBalance: consolidation.currentHomeLoanBalance,
          currentRate: 6.0,
          currentMonthly: consolidation.currentHomeLoanPayment,
          newRate: consolidation.targetInterestRate,
          newMonthly: consolidation.newCombinedMonthlyPayment,
          monthlySavings: Math.max(0, consolidation.monthlyCashflowGain),
          threeYearInterestSavings: Math.max(0, consolidation.yearlyCashflowGain * 3),
          netSavings: Math.max(0, consolidation.yearlyCashflowGain * 3),
          fees: { mortgageRegFee: 0, appraisalFee: 0, dutyStamp: 0, totalFees: 0 }
        },
        selectedPackage: {
          bankName: 'ธนาคารพันธมิตรรวบหนี้',
          packageName: 'โปรโมชั่นรวมหนี้เป็นหนึ่งเดียว (Home Top-Up)',
          refinanceRate: `${consolidation.targetInterestRate}%`,
          allowedOccupations: ['salaried', 'freelance', 'business']
        },
        userForm: {
          name: userName,
          monthlyIncome: 45000,
          occupation: 'salaried',
          currentBalance: consolidation.newCombinedLoan,
          currentRate: consolidation.averageCardRate || 18,
          wantMRTA: true,
          province: province || 'ไม่ระบุ',
          remainingYears: remainingYears || 15
        },
        checklist: {
          idCard: true,
          houseReg: true,
          payslip: true,
          bankStatement: true,
          mortgageStatement: true,
          cardStatements: true
        }
      };

      const pdfBytes = await buildRefinancePdf(mockPdfData);

      // Download blob
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NeeNoi_Debt_Consolidation_Pack_${userName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate PDF pack:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF โปรดลองอีกครั้ง');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="consolidation-module space-y-6 animate-fade-in pb-12">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                Debt Consolidation Module (รวมหนี้)
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                🔥 มัดรวมคุ้มสุด (เริ่มต้น {lowestRate}%)
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-medium border border-indigo-500/30">
                {lastUpdatedBadge}
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              เปลี่ยนหนี้บัตรดอกเบี้ยสูง 18-25% เป็นหนี้บ้านดอกเบี้ยถูกเริ่มต้น {lowestRate}%
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-2xl leading-relaxed">
              เลือกรายการหนี้บัตรเครดิตหรือสินเชื่อส่วนบุคคลที่ต้องการนำมารวมกับสินเชื่อบ้าน
              เพื่อลดค่างวดต่อเดือนทันที เพิ่มสภาพคล่องเงินสดในกระเป๋าของคุณ
            </p>
          </div>

          {consolidation.monthlyCashflowGain > 0 && (
            <div className="bg-emerald-500/20 border border-emerald-400/40 p-4 sm:p-5 rounded-2xl backdrop-blur-md text-center min-w-[200px]">
              <span className="text-xs text-emerald-200 uppercase tracking-wider font-semibold block mb-1">
                เพิ่มสภาพคล่องสุทธิ
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">
                +{formatCurrency(consolidation.monthlyCashflowGain)}
                <span className="text-xs font-normal text-emerald-200 ml-1">/เดือน</span>
              </div>
              <div className="text-xs text-emerald-300/80 mt-1">
                (ประหยัด {formatCurrency(consolidation.yearlyCashflowGain)} / ปี)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating back button */}
      <StepBackButton
        currentStep={step}
        totalSteps={3}
        onClick={() => setStep(step - 1)}
        label={step === 2 ? 'เลือกหนี้' : 'กรอกข้อมูลบ้าน'}
        visible={step >= 2}
      />

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-3">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => { if (s < step) setStep(s); }}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s === step
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-110'
                  : s < step
                    ? 'bg-indigo-100 text-indigo-600 cursor-pointer hover:bg-indigo-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {s}
            </button>
            {s < 3 && (
              <div className={`w-12 h-1 rounded-full transition-colors ${s < step ? 'bg-indigo-400' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-6 text-xs font-medium text-slate-500">
        <span className={step === 1 ? 'text-indigo-600 font-bold' : step > 1 ? 'text-indigo-400' : ''}>เลือกรายการหนี้</span>
        <span className={step === 2 ? 'text-indigo-600 font-bold' : step > 2 ? 'text-indigo-400' : ''}>กรอกข้อมูลบ้าน + ธนาคาร</span>
        <span className={step === 3 ? 'text-indigo-600 font-bold' : ''}>เปรียบเทียบ & ดาวน์โหลด</span>
      </div>

      {/* ============ STEP 1: Debt Selection ============ */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Home Loan Picker (if HOME_LOAN debts exist) */}
          {homeLoans.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3" />
                    AI ตรวจพบอัตโนมัติ
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-600" />
                  เลือกหนี้บ้านที่ต้องการรวบเข้าบ้าน
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI ตรวจพบสินเชื่อบ้าน {homeLoans.length} รายการ — เลือกหลักประกันรวมหนี้
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {homeLoans.map(loan => {
                  const isSelected = selectedHomeLoanId === loan.id;
                  const bal = Number(loan.totalBalance || loan.balance || 0);
                  const rate = Number(loan.interestRate || loan.rate || 0);
                  return (
                    <button
                      key={loan.id}
                      onClick={() => {
                        setSelectedHomeLoanId(loan.id);
                        if (bal > 0) setHomeLoanBalance(bal);
                        const pmt = Number(loan.minimumPayment || loan.minPayment || 0);
                        if (pmt > 0) setHomeLoanPayment(pmt);
                      }}
                      className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/60 shadow-md ring-1 ring-indigo-400/20'
                          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-900 truncate">{loan.name || loan.lender || 'สินเชื่อบ้าน'}</div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs">
                        <span className="text-indigo-700 font-bold">฿{bal.toLocaleString()}</span>
                        <span className="text-rose-600 font-bold">{rate}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                  เลือกรายการหนี้ที่ต้องการรวบเข้าบ้าน
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  เลือกบัตรเครดิต / สินเชื่อส่วนบุคคลเพื่อปิดยอด 0 บาท
                </p>
              </div>
              {consolidatableDebts.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                >
                  {selectedDebtIds.length === consolidatableDebts.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                </button>
              )}
            </div>
            {consolidatableDebts.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 p-6">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">ยังไม่มีรายการหนี้บัตรเครดิตในระบบ</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">สแกนใบแจ้งหนี้หรือเพิ่มรายการหนี้ก่อนทำการรวบหนี้</p>
                <button
                  onClick={onNavigateToCalculator}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow hover:bg-indigo-700 transition-colors"
                >
                  ไปที่หน้าบันทึกหนี้
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {consolidatableDebts.map(debt => {
                  const isSelected = selectedDebtIds.includes(debt.id);
                  const balance = Number(debt.totalBalance ?? debt.balance ?? 0);
                  const minPayment = Number(debt.minimumPayment ?? debt.minPayment ?? (balance * 0.05));
                  const rate = Number(debt.interestRate ?? debt.rate ?? 18);
                  return (
                    <div
                      key={debt.id}
                      onClick={() => toggleSelectDebt(debt.id)}
                      className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden ${isSelected ? 'bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-400/20 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'}`}
                    >
                      {isSelected && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-10 opacity-90 select-none">
                          <div className="transform rotate-[-12deg] border-2 border-emerald-600 text-emerald-700 font-black text-xs sm:text-sm px-3 py-1 rounded-md tracking-wider bg-emerald-100/90 shadow-sm flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            PAID OFF (ปิดยอด 0 บาท)
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'text-emerald-600 bg-emerald-100' : 'text-slate-400 bg-slate-100'}`}>
                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-semibold text-sm truncate ${isSelected ? 'text-emerald-950 line-through decoration-emerald-600/60' : 'text-slate-900'}`}>{debt.name || debt.lender || 'รายการหนี้'}</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">ดอกเบี้ย {rate}%</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                            <span>ยอดคงเหลือ: <b className="text-slate-800">{formatCurrency(balance)}</b></span>
                            <span>ขั้นต่ำ: <b className="text-slate-800">{formatCurrency(minPayment)}/เดือน</b></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="btn-gold text-xs py-3 px-6 font-extrabold cursor-pointer">
              ถัดไป: กรอกข้อมูลบ้าน <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============ STEP 2: Home Loan Config + Bank Selection ============ */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Home className="w-5 h-5 text-indigo-600" />
              ข้อมูลสินเชื่อบ้านเดิมและข้อเสนอใหม่
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ยอดหนี้บ้านเดิมคงเหลือ (บาท)</label>
                <FormattedNumberInput value={homeLoanBalance} onChange={setHomeLoanBalance} min={0} prefix="฿" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ค่างวดบ้านเดิม (บาท/เดือน)</label>
                <FormattedNumberInput value={homeLoanPayment} onChange={setHomeLoanPayment} min={0} prefix="฿" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
                  <span>🏦 เลือกธนาคารที่ต้องการรวมหนี้</span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">{lastUpdatedBadge}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {offers.map(offer => {
                    const isSelected = selectedBankId === offer.bankId;
                    const bankShortMap = { KBANK:'KBank', TTB:'ttb', SCB:'SCB', GHBANK:'GH Bank', GSB:'GSB', KTB:'Krungthai', BBL:'Bangkok Bank', KRUNGSRI:'Krungsri', CIMBT:'CIMB Thai', UOB:'UOB' };
                    return (
                      <button key={offer.bankId} type="button" onClick={() => { setSelectedBankId(offer.bankId); setTargetRate(Number(offer.avg3YearRate)); }} className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition-all text-left cursor-pointer ${isSelected ? 'border-indigo-500 bg-indigo-50/60 shadow-md ring-1 ring-indigo-400/20' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/50'}`}>
                        <BankLogo bankShort={bankShortMap[offer.bankId] || offer.bankId} size={36} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-slate-900 truncate">{offer.bankName.replace('ธนาคาร', '')}</div>
                          <div className={`text-[10px] font-black ${isSelected ? 'text-indigo-600' : 'text-rose-600'}`}>{offer.avg3YearRate}%</div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ดอกเบี้ยกู้เพิ่ม/รวมหนี้ใหม่ (% ต่อปี)</label>
                <FormattedNumberInput value={targetRate} onChange={setTargetRate} min={0} max={100} step={0.01} suffix="%" className="[&_input]:text-indigo-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ระยะเวลาผ่อนใหม่ (ปี)</label>
                <FormattedNumberInput value={termYears} onChange={(v) => { if (v >= 1 && v <= 100) setTermYears(v); }} min={1} max={100} suffix="ปี" />
                <p className="text-[10px] text-slate-400 mt-1">เลือกระยะเวลา 1-100 ปี</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">📍 จังหวัดที่ตั้งบ้าน</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="input-dark cursor-pointer text-sm"
                >
                  <option value="">— เลือกจังหวัด —</option>
                  {THAI_PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {province && provinceRateInfo && (() => {
                  const tierData = RATE_TIERS.find(t => t.tier === provinceRateInfo.tier);
                  const c = tierData?.color || 'amber';
                  return (
                    <div className={`mt-2 p-2.5 rounded-lg border bg-${c}-50/60 border-${c}-200`}>                        
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-${c}-700">{tierData?.emoji} {provinceRateInfo.label}</span>
                        {provinceRateInfo.modifier > 0 ? (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-${c}-200 text-${c}-800">+{provinceRateInfo.modifier}% จาก base</span>
                        ) : (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">อัตราต่ำสุด</span>
                        )}
                      </div>
                      <p className="text-[10px] text-${c}-600 mt-0.5 leading-relaxed">{tierData?.desc}</p>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">⏳ เหลือเวลาผ่อนอีกกี่ปี</label>
                <FormattedNumberInput value={remainingYears} onChange={(v) => { if (v >= 1 && v <= 50) setRemainingYears(v); }} min={1} max={50} suffix="ปี" />
                <p className="text-[10px] text-slate-400 mt-1">นับจากวันนี้จนครบสัญญาเดิม</p>
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary text-xs cursor-pointer"><ArrowLeft className="w-4 h-4" /> ย้อนกลับ</button>
            <button onClick={() => setStep(3)} className="btn-gold text-xs py-3 px-6 font-extrabold cursor-pointer">ถัดไป: ดูผลลัพธ์ <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ============ STEP 3: Comparison + Download ============ */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-6 border border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold flex items-center gap-2"><TrendingDown className="w-5 h-5 text-emerald-400" /> เปรียบเทียบภาระจ่ายรายเดือน</h2>
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">รวม {consolidation.selectedCount} รายการ</span>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> ภาระเดิม (ก่อนรวมหนี้)</span>
                  <span className="text-rose-400">เฉลี่ย ~{consolidation.averageCardRate}%</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-xs text-slate-400">ค่างวดจ่ายรวมเดิม:</div>
                  <div className="text-2xl font-black text-rose-200 line-through decoration-rose-500 decoration-2">{formatCurrency(consolidation.oldTotalMonthlyPayment)}<span className="text-xs font-normal text-rose-400 ml-1">/เดือน</span></div>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-rose-900/40 pt-2 flex justify-between">
                  <span>หนี้บ้านเดิม: {formatCurrency(consolidation.currentHomeLoanPayment)}</span>
                  <span>ขั้นต่ำบัตร: {formatCurrency(consolidation.oldCardsMonthlyPayment)}</span>
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-emerald-950/60 border-2 border-emerald-500/80 shadow-lg shadow-emerald-950/50 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" /> แผนใหม่ (รวมเข้าบ้าน)</span>
                  <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40">ดอกเบี้ย {consolidation.targetInterestRate}%</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-xs text-emerald-200/90 font-medium">ค่างวดรวมใหม่:</div>
                  <div className="text-3xl font-black text-emerald-300 drop-shadow-sm">{formatCurrency(consolidation.newCombinedMonthlyPayment)}<span className="text-xs font-normal text-emerald-200 ml-1">/เดือน</span></div>
                </div>
                <div className="text-[11px] text-emerald-200/70 border-t border-emerald-900/60 pt-2 flex justify-between">
                  <span>วงเงินรวมใหม่: {formatCurrency(consolidation.newCombinedLoan)}</span>
                  <span>ผ่อนนาน: {consolidation.loanTermYears} ปี</span>
                </div>
              </div>
            </div>
            {consolidation.monthlyCashflowGain > 0 ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-center shadow-lg space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-100">🎉 สภาพคล่องเพิ่มขึ้นสุทธิ</div>
                <div className="text-2xl font-black">+{formatCurrency(consolidation.monthlyCashflowGain)} / เดือน</div>
                <div className="text-xs text-emerald-100/90">มีเงินเหลือเก็บหรือโปะบ้านต่อเพิ่มขึ้น {formatCurrency(consolidation.yearlyCashflowGain)} ต่อปี!</div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-800 text-slate-300 text-xs text-center border border-slate-700">เลือกรายการหนี้บัตรเครดิตเพื่อคำนวณส่วนต่างค่างวดรายเดือน</div>
            )}
            <div className="pt-2">
              <button onClick={handleDownloadPdfPack} disabled={isGeneratingPdf || consolidation.selectedCount === 0} className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-200 ${pdfSuccess ? 'bg-emerald-500 text-white' : consolidation.selectedCount === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:shadow-indigo-500/50 active:scale-[0.98]'}`}>
                {isGeneratingPdf ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> กำลังสร้างไฟล์ PDF...</>) : pdfSuccess ? (<><CheckCircle2 className="w-5 h-5" /> ดาวน์โหลดเอกสารยื่นกู้เรียบร้อย!</>) : (<><FileDown className="w-5 h-5" /> ดาวน์โหลดชุดเอกสารยื่นกู้ (PDF Pack)</>)}
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2">* พิมพ์เอกสารนำไปยื่นที่สาขาธนาคารได้ทันที พร้อมใบปกสรุปข้อมูล</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
