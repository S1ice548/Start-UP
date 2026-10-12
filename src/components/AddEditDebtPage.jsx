import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  PlusCircle, 
  Edit3, 
  Save, 
  Home, 
  ChevronRight, 
  AlertCircle,
  FileEdit,
  Sparkles,
  Building2,
  CreditCard,
  Coins,
  Percent,
  Calendar,
  Copy,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { 
  MAJOR_THAI_BANKS, 
  DEBT_TYPES, 
  parseDebtTextWithGemini 
} from '../services/geminiService';
import { formatCurrency } from '../utils/debtEngine';

export default function AddEditDebtPage({ editingDebt, onSave, onCancel }) {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'parser'

  const [bankName, setBankName] = useState('ธนาคารกสิกรไทย (KBank)');
  const [customBankName, setCustomBankName] = useState('');
  const [debtName, setDebtName] = useState('');
  const [debtType, setDebtType] = useState('บัตรเครดิต');
  const [currentBalance, setCurrentBalance] = useState('');
  const [interestRatePercent, setInterestRatePercent] = useState('');
  const [minMonthlyPayment, setMinMonthlyPayment] = useState('');
  const [dueDay, setDueDay] = useState('15');

  // Parser tab state
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parserSuccessMsg, setParserSuccessMsg] = useState('');

  // Validation
  const [validationError, setValidationError] = useState('');
  const [wasParsedFromText, setWasParsedFromText] = useState(false);

  useEffect(() => {
    if (editingDebt) {
      const bank = editingDebt.bank_name || editingDebt.lender || 'ธนาคารกสิกรไทย (KBank)';
      const isKnownBank = MAJOR_THAI_BANKS.includes(bank);
      if (isKnownBank) {
        setBankName(bank);
        setCustomBankName('');
      } else {
        setBankName('อื่นๆ');
        setCustomBankName(bank);
      }

      setDebtName(editingDebt.debt_name || editingDebt.name || '');
      setDebtType(editingDebt.debt_type || editingDebt.category || 'บัตรเครดิต');
      setCurrentBalance(editingDebt.current_balance ?? editingDebt.balance ?? '');
      setInterestRatePercent(editingDebt.interest_rate_percent ?? editingDebt.interestRate ?? '');
      setMinMonthlyPayment(editingDebt.min_monthly_payment ?? editingDebt.minPayment ?? '');

      let dayVal = '15';
      if (editingDebt.due_day) {
        dayVal = String(editingDebt.due_day);
      } else if (editingDebt.dueDate) {
        const match = String(editingDebt.dueDate).match(/\d+/);
        if (match) dayVal = match[0];
      }
      setDueDay(dayVal);
    }
  }, [editingDebt]);

  const handleBalanceChange = (e) => {
    const val = e.target.value;
    setCurrentBalance(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && !minMonthlyPayment) {
      setMinMonthlyPayment(String(Math.round(num * 0.05)));
    }
  };

  const handleParseText = async () => {
    if (!rawText || !rawText.trim()) {
      setValidationError('กรุณาวางข้อความ e-Statement ก่อนสกัดข้อมูล');
      return;
    }

    setIsParsing(true);
    setValidationError('');
    setParserSuccessMsg('');

    try {
      const parsed = await parseDebtTextWithGemini(rawText);

      if (parsed.bank_name) {
        const matchedBank = MAJOR_THAI_BANKS.find(b => b.toLowerCase().includes(parsed.bank_name.toLowerCase()) || parsed.bank_name.toLowerCase().includes(b.toLowerCase()));
        if (matchedBank) {
          setBankName(matchedBank);
          setCustomBankName('');
        } else {
          setBankName('อื่นๆ');
          setCustomBankName(parsed.bank_name);
        }
      }

      if (parsed.debt_name) setDebtName(parsed.debt_name);
      if (parsed.debt_type && DEBT_TYPES.includes(parsed.debt_type)) setDebtType(parsed.debt_type);
      if (parsed.current_balance) setCurrentBalance(String(parsed.current_balance));
      if (parsed.interest_rate_percent !== undefined) setInterestRatePercent(String(parsed.interest_rate_percent));
      if (parsed.min_monthly_payment) setMinMonthlyPayment(String(parsed.min_monthly_payment));
      if (parsed.due_day) setDueDay(String(parsed.due_day));

      setWasParsedFromText(true);
      setParserSuccessMsg('✨ AI สกัดข้อมูลจากข้อความสำเร็จแล้ว! ระบบสลับไปหน้าฟอร์มเพื่อให้คุณตรวจสอบเรียบร้อยแล้ว');
      setActiveTab('manual');
    } catch (err) {
      console.error('Failed to parse text:', err);
      setValidationError(`เกิดข้อผิดพลาดในการสกัดข้อมูล: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    const effectiveBankName = bankName === 'อื่นๆ' ? (customBankName.trim() || 'อื่นๆ') : bankName;
    const effectiveDebtName = debtName.trim() || `${debtType} ${effectiveBankName.split(' ')[0]}`;
    const balanceNum = parseFloat(currentBalance);
    const rateNum = parseFloat(interestRatePercent);
    const minPayNum = parseFloat(minMonthlyPayment);

    if (!effectiveBankName) {
      setValidationError('กรุณาระบุสถาบันการเงิน / เจ้าหนี้');
      return;
    }

    if (!effectiveDebtName) {
      setValidationError('กรุณาระบุชื่อรายการหนี้');
      return;
    }

    if (isNaN(balanceNum) || balanceNum <= 0) {
      setValidationError('ยอดหนี้คงเหลือปัจจุบันต้องมากกว่า 0 บาท');
      return;
    }

    if (isNaN(rateNum) || rateNum < 0) {
      setValidationError('อัตราดอกเบี้ยต้องไม่ติดลบ (0% ขึ้นไป)');
      return;
    }

    if (isNaN(minPayNum) || minPayNum <= 0) {
      setValidationError('ยอดชำระขั้นต่ำต่อเดือนต้องมากกว่า 0 บาท');
      return;
    }

    const debtPayload = {
      id: editingDebt?.id || `debt-${Date.now()}`,
      bank_name: effectiveBankName,
      creditor: effectiveBankName,
      lender: effectiveBankName,
      debt_name: effectiveDebtName,
      name: effectiveDebtName,
      debt_type: debtType,
      category: debtType === 'บัตรเครดิต' ? 'credit_card' :
                debtType === 'สินเชื่อส่วนบุคคล' ? 'personal_loan' :
                debtType === 'สินเชื่อบ้าน' ? 'mortgage' :
                debtType === 'สินเชื่อรถยนต์' ? 'auto_loan' : 'other',
      current_balance: balanceNum,
      balance: balanceNum,
      interest_rate_percent: rateNum,
      interestRate: rateNum,
      min_monthly_payment: minPayNum,
      minPayment: minPayNum,
      due_day: parseInt(dueDay, 10) || 15,
      dueDate: `${dueDay || 15} ของทุกเดือน`,
      entry_method: editingDebt ? (editingDebt.entry_method || 'manual') : (wasParsedFromText ? 'copy_paste' : 'manual'),
      isScanned: editingDebt?.isScanned || false
    };

    onSave(debtPayload);
  };

  // Interest preview uses daily formula to match engine: (balance × annualRate / 365) × 30 days
  const estimatedMonthlyInterest = currentBalance && interestRatePercent
    ? Math.round((parseFloat(currentBalance) * (parseFloat(interestRatePercent) / 100) / 365) * 30)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      
      {/* 1. Breadcrumb Trail */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <button 
          onClick={onCancel}
          className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <Home className="w-3.5 h-3.5" />
          <span>หน้าหลัก</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-indigo-600 font-bold flex items-center gap-1.5 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
          <FileEdit className="w-3.5 h-3.5" />
          {editingDebt ? 'แก้ไขข้อมูลหนี้' : 'เพิ่มรายการหนี้ใหม่'}
        </span>
      </div>

      {/* 2. Visual Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="badge-gold text-xs font-bold">
            ✍️ Quick Manual Debt Form (e-Statement Standard)
          </span>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 pt-1 tracking-tight">
            {editingDebt ? <Edit3 className="w-6 h-6 text-indigo-600" /> : <PlusCircle className="w-6 h-6 text-indigo-600" />}
            {editingDebt ? `แก้ไขข้อมูลหนี้: ${editingDebt.name}` : '+ เพิ่มรายการหนี้ใหม่ (Add Debt)'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            กรอกข้อมูลตามสเปก e-Statement หรือใช้ AI คัดลอกข้อความวางเพื่อสกัดข้อมูลเข้าฟอร์ม
          </p>
        </div>

        <button
          onClick={onCancel}
          className="btn-secondary text-xs py-2 px-4 flex items-center gap-2 cursor-pointer font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          ยกเลิก
        </button>
      </div>

      {/* 3. Form & Parser Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Tab Selection Bar */}
        <div className="flex border-b border-slate-200 bg-slate-100/50 p-1.5 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>กรอกข้อมูลเอง (Quick Manual Form)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parser')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'parser'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-200/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>คัดลอกข้อความวาง (Text Parser)</span>
          </button>
        </div>

        {/* Alerts */}
        {parserSuccessMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 px-5 flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{parserSuccessMsg}</span>
          </div>
        )}

        {validationError && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 px-5 flex items-center gap-2.5 text-xs text-rose-800 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="p-6">
          {activeTab === 'manual' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Row 1: Bank Name & Debt Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    สถาบันการเงิน / เจ้าหนี้
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="input-dark text-slate-900 font-semibold text-xs"
                    required
                  >
                    {MAJOR_THAI_BANKS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>

                  {bankName === 'อื่นๆ' && (
                    <input
                      type="text"
                      placeholder="ระบุชื่อสถาบันการเงิน..."
                      value={customBankName}
                      onChange={(e) => setCustomBankName(e.target.value)}
                      className="input-dark text-slate-900 font-medium text-xs mt-2"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                    ประเภทหนี้สิน
                  </label>
                  <select
                    value={debtType}
                    onChange={(e) => setDebtType(e.target.value)}
                    className="input-dark text-slate-900 font-semibold text-xs"
                    required
                  >
                    {DEBT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Debt Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <FileEdit className="w-3.5 h-3.5 text-indigo-600" />
                    ชื่อรายการหนี้
                  </span>
                  <span className="text-[11px] text-slate-400">เช่น 'บัตรเครดิต K-Bank', 'สินเชื่อบ้านกสิกร'</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น บัตรเครดิต K-Bank"
                  value={debtName}
                  onChange={(e) => setDebtName(e.target.value)}
                  className="input-dark text-slate-900 font-semibold text-sm"
                  required
                />
              </div>

              {/* Row 2: Current Balance & Interest Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Coins className="w-3.5 h-3.5 text-indigo-600" />
                    ยอดหนี้คงเหลือรวม
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="เช่น 45000"
                      value={currentBalance}
                      onChange={handleBalanceChange}
                      className="input-dark text-indigo-600 font-black text-base pr-10"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">บาท</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Percent className="w-3.5 h-3.5 text-rose-600" />
                    อัตราดอกเบี้ยต่อปี
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="เช่น 16.0"
                      value={interestRatePercent}
                      onChange={(e) => setInterestRatePercent(e.target.value)}
                      className="input-dark text-rose-600 font-black text-base pr-10"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Row 3: Minimum Payment & Due Day */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Coins className="w-3.5 h-3.5 text-blue-600" />
                    ค่างวดขั้นต่ำต่อเดือน
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="เช่น 2200"
                      value={minMonthlyPayment}
                      onChange={(e) => setMinMonthlyPayment(e.target.value)}
                      className="input-dark font-extrabold text-slate-900 text-sm pr-10"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">บาท</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    วันครบกำหนดชำระของทุกเดือน
                  </label>
                  <select
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="input-dark text-slate-900 font-semibold text-xs"
                    required
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>วันที่ {day} ของทุกเดือน</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interest Estimate */}
              {currentBalance && interestRatePercent && estimatedMonthlyInterest > 0 && (
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-indigo-800 font-semibold">
                    <AlertCircle className="w-4 h-4 text-indigo-600" />
                    <span>ประมาณการดอกเบี้ยรายเดือนที่เกิดขึ้น:</span>
                  </div>
                  <span className="font-black text-rose-600 text-sm">
                    ~ {formatCurrency(estimatedMonthlyInterest)} / เดือน
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn-secondary text-xs px-5 py-2.5 cursor-pointer font-semibold"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  className="btn-gold text-xs px-6 py-2.5 flex items-center gap-2 cursor-pointer shadow-md font-extrabold"
                >
                  <Save className="w-4 h-4" />
                  {editingDebt ? 'บันทึกการแก้ไข' : 'บันทึกหนี้ใหม่'}
                </button>
              </div>

            </form>
          )}

          {activeTab === 'parser' && (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-900 space-y-1">
                <h4 className="font-extrabold flex items-center gap-1.5 text-indigo-950">
                  <Copy className="w-4 h-4 text-indigo-600" />
                  คัดลอกข้อความแจ้งยอด e-Statement มาวางได้ทันที:
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  วางข้อความแจ้งยอดหนี้ SMS หรืออีเมล e-Statement แล้วกดปุ่มให้ Gemini AI สกัดข้อมูลเข้าฟอร์มให้อัตโนมัติ
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  ข้อความดิบ e-Statement
                </label>
                <textarea
                  rows={7}
                  placeholder="วางข้อความ e-Statement ที่นี่..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="input-dark text-xs font-mono p-3 leading-relaxed w-full"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn-secondary text-xs px-4 py-2 font-semibold"
                >
                  ยกเลิก
                </button>

                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={isParsing || !rawText.trim()}
                  className="btn-gold text-xs py-2.5 px-5 flex items-center gap-2 font-extrabold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gemini AI กำลังสกัดข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-950" />
                      <span>⚡ สกัดข้อมูลด้วย Gemini AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
