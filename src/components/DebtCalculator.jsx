import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingDown, 
  Zap, 
  Snowflake, 
  Bot, 
  Plus, 
  Trash2, 
  Edit3, 
  PiggyBank, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  Sliders,
  Search,
  Filter,
  CreditCard,
  Download,
  Upload,
  Bookmark,
  RotateCcw,
  Clock,
  Check
} from 'lucide-react';
import { calculateDebtPayoff, formatCurrency, STRATEGIES_INFO } from '../utils/debtEngine';
import { exportDebtsToExcel } from '../utils/excelExport';

export default function DebtCalculator({ 
  debts, 
  setDebts, 
  extraBudget, 
  setExtraBudget,
  savedPlans = [],
  setSavedPlans,
  onSavePlanSnapshot,
  onResetData,
  onNavigateToCompare,
  onNavigateToAddDebt,
  onNavigateToEditDebt,
  onNavigateToPayment,
  manualStrategy
}) {
  const [budgetString, setBudgetString] = useState(extraBudget ? String(extraBudget) : '');
  const [showSavedPlansList, setShowSavedPlansList] = useState(false);

  // Table Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [debtFilter, setDebtFilter] = useState('all'); // 'all', 'high_interest', 'scanned'

  // Handle File Import (JSON & CSV)
  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        let imported = [];
        if (file.name.endsWith('.json')) {
          imported = JSON.parse(text);
        } else {
          const lines = text.split('\n').filter(l => l.trim());
          imported = lines.slice(1).map((line, idx) => {
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            return {
              id: `imp-${Date.now()}-${idx}`,
              name: cols[0] || `รายการหนี้ ${idx + 1}`,
              lender: cols[1] || 'ไม่ระบุเจ้าหนี้',
              balance: Number(cols[2]) || 10000,
              interestRate: Number(cols[3]) || 15,
              minPayment: Number(cols[4]) || 1000,
              dueDate: cols[5] || '15 ของทุกเดือน'
            };
          });
        }

        if (Array.isArray(imported) && imported.length > 0) {
          const cleaned = imported.map((d, i) => ({
            id: d.id || `imp-${Date.now()}-${i}`,
            name: d.name || d['ชื่อรายการหนี้'] || `หนี้ ${i + 1}`,
            lender: d.lender || d['เจ้าหนี้'] || 'ไม่ระบุเจ้าหนี้',
            balance: Number(d.balance || d['ยอดหนี้คงเหลือ'] || 0),
            interestRate: Number(d.interestRate || d['อัตราดอกเบี้ย'] || 0),
            minPayment: Number(d.minPayment || d['ค่างวดขั้นต่ำ'] || 0),
            dueDate: d.dueDate || d['วันครบกำหนดชำระ'] || '15 ของทุกเดือน',
            isScanned: false
          }));

          setDebts(prev => [...prev, ...cleaned]);
          alert(`🎉 นำเข้าข้อมูลรายการหนี้สำเร็จจำนวน ${cleaned.length} รายการ`);
        } else {
          alert('ไม่พบข้อมูลรายการหนี้ในไฟล์');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ กรุณาตรวจสอบรูปแบบไฟล์ JSON หรือ CSV');
      }
    };
    reader.readAsText(file);
  };


  // Sync budgetString when extraBudget changes externally
  useEffect(() => {
    setBudgetString(extraBudget === 0 ? '' : String(extraBudget));
  }, [extraBudget]);

  const handleBudgetInputChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setBudgetString('');
      setExtraBudget(0);
    } else {
      const cleaned = raw.replace(/^0+(?=\d)/, '');
      const parsed = parseInt(cleaned, 10);
      if (isNaN(parsed)) {
        setBudgetString('');
        setExtraBudget(0);
      } else {
        setBudgetString(cleaned);
        setExtraBudget(parsed);
      }
    }
  };

  // Calculate Payoff Results
  const result = calculateDebtPayoff(debts, extraBudget, manualStrategy);

  const totalBalance = debts.reduce((sum, d) => sum + Number(d.balance), 0);
  const totalMinPayment = debts.reduce((sum, d) => sum + Number(d.minPayment), 0);
  const totalMonthlyCommitment = totalMinPayment + Number(extraBudget || 0);

  // Filtered Debts List
  const displayDebts = debts.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (d.lender && d.lender.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (debtFilter === 'high_interest') return d.interestRate >= 20;
    if (debtFilter === 'scanned') return d.isScanned;
    return true;
  });

  const handleDeleteDebt = (id) => {
    if (confirm('คุณต้องการลบรายการหนี้นี้ใช่หรือไม่?')) {
      setDebts(debts.filter(d => d.id !== id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 border-t-4 border-t-indigo-500 shadow-xs hover:shadow-md transition-all relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold mb-2">
            <span>ยอดหนี้รวมทั้งหมด</span>
            <DollarSign className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1 tracking-tight">
            {formatCurrency(totalBalance)}
          </div>
          <div className="text-xs text-slate-500">
            จำนวนหนี้ทั้งหมด <span className="text-indigo-600 font-bold">{debts.length}</span> รายการ
          </div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 border-t-4 border-t-blue-500 shadow-xs hover:shadow-md transition-all relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold mb-2">
            <span>ส่งจ่ายต่อเดือนทั้งหมด</span>
            <PiggyBank className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1 tracking-tight">
            {formatCurrency(totalMonthlyCommitment)}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between font-medium">
            <span>ขั้นต่ำ: {formatCurrency(totalMinPayment)}</span>
            <span className="text-indigo-600 font-bold">+ โปะเพิ่ม: {formatCurrency(extraBudget)}</span>
          </div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-500 shadow-xs hover:shadow-md transition-all relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold mb-2">
            <span>จะปิดหนี้ได้ในอีก</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600 mb-1">
            {result.totalMonths} เดือน
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {result.monthsSaved > 0 ? (
              <span className="text-emerald-600 font-bold">⚡ เร็วขึ้น {result.monthsSaved} เดือน จากการโปะเพิ่ม</span>
            ) : (
              'จ่ายขั้นต่ำตามรอบปกติ'
            )}
          </div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl border border-indigo-200 border-t-4 border-t-indigo-600 shadow-xs hover:shadow-md transition-all relative overflow-hidden">
          <div className="flex items-center justify-between text-indigo-900 text-sm font-semibold mb-2">
            <span>ดอกเบี้ยที่ประหยัดได้</span>
            <TrendingDown className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600 mb-1 tracking-tight">
            {formatCurrency(result.totalInterestSaved)}
          </div>
          <div className="text-xs text-indigo-700/80 font-medium">
            คำนวณจากแผน AI Auto-Selected
          </div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

      </div>

      {/* 2. Extra Payment Input & Direct Navigation to Payment History */}
      <div className="bg-white p-6 rounded-2xl space-y-4 shadow-sm border border-slate-200">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1 flex-1">
            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-indigo-600" />
              ใส่จำนวนเงินที่จะโปะเดือนนี้ (บาท):
            </label>
            <p className="text-xs text-slate-500">
              กรอกจำนวนเงินที่คุณต้องการโปะเพิ่มเดือนนี้ แล้วกดเพื่อไปยังหน้าบันทึกชำระหนี้ทันที
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="เช่น 5000"
                value={budgetString}
                onChange={handleBudgetInputChange}
                className="input-dark w-44 text-right font-black text-indigo-600 pr-8 text-lg"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">฿</span>
            </div>

            <button
              onClick={() => onNavigateToPayment(extraBudget)}
              className="btn-gold text-xs py-3 px-5 flex items-center gap-2 font-extrabold shadow-md cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-4 h-4" />
              นำเงินโปะไปหน้าบันทึกชำระหนี้
            </button>
          </div>
        </div>

        {/* AI Strategy Info Banner */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">วิธีชำระหนี้ที่กำลังใช้งาน</span>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                  {STRATEGIES_INFO[result.activeStrategyKey]?.outcomeLabel || result.activeStrategyName}
                  {!manualStrategy && (
                    <span className="badge-gold text-[10px]">AI Auto-Selected</span>
                  )}
                </h3>
              </div>
            </div>

            <button
              onClick={onNavigateToCompare}
              className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <Sliders className="w-4 h-4 text-indigo-600" />
              เปลี่ยนวิธีชำระหนี้
            </button>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2.5 text-sm text-indigo-900">
              <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-800 leading-relaxed">
                  {result.aiRecommendation?.reasoning || 'AI ประมวลผลจากข้อมูลหนี้ทั้งหมดและงบโปะเพิ่มเพื่อเลือกทางเลือกที่ดีที่สุด'}
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 3. Debt Table & Search & Action Bar */}
      <div className="bg-white p-6 rounded-2xl space-y-4 shadow-sm border border-slate-200">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              รายการหนี้ทั้งหมด ({displayDebts.length}/{debts.length} รายการ)
            </h2>
            <p className="text-xs text-slate-500 font-medium">เรียงลำดับตามแผนการจ่ายของ {STRATEGIES_INFO[result.activeStrategyKey]?.outcomeLabel || result.activeStrategyName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาชื่อหนี้/เจ้าหนี้..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-dark pl-8 py-1.5 text-xs w-44"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <button
              onClick={() => setDebtFilter(debtFilter === 'high_interest' ? 'all' : 'high_interest')}
              className={`text-xs px-2.5 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
                debtFilter === 'high_interest' 
                  ? 'bg-rose-50 text-rose-600 border-rose-200' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              🔥 ดอกสูง 20%+
            </button>

            {/* File Import Button */}
            <label className="btn-secondary text-xs py-1.5 px-3 font-semibold cursor-pointer flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>นำเข้าไฟล์</span>
              <input 
                type="file" 
                accept=".json,.csv" 
                onChange={handleFileImport} 
                className="hidden" 
              />
            </label>

            {/* Download Excel Button */}
            <button
              onClick={() => exportDebtsToExcel(debts, 'User')}
              className="btn-secondary text-xs py-1.5 px-3 font-semibold cursor-pointer flex items-center gap-1 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
              title="ส่งออกรายการหนี้เป็นไฟล์ Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>ดาวน์โหลด Excel</span>
            </button>

            {/* Saved Plans History Toggle */}
            {savedPlans.length > 0 && (
              <button
                onClick={() => setShowSavedPlansList(!showSavedPlansList)}
                className="btn-secondary text-xs py-1.5 px-3 font-semibold cursor-pointer flex items-center gap-1 text-indigo-700 bg-indigo-50 border-indigo-200"
              >
                <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
                <span>แผนที่บันทึกไว้ ({savedPlans.length})</span>
              </button>
            )}

            {/* Add Debt Button */}
            <button 
              onClick={onNavigateToAddDebt}
              className="btn-gold text-xs py-2 px-3.5 cursor-pointer shadow-sm font-bold"
            >
              <Plus className="w-4 h-4" />
              เพิ่มรายการหนี้ใหม่
            </button>

          </div>
        </div>

        {/* Saved Plans List Drawer */}
        {showSavedPlansList && savedPlans.length > 0 && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-indigo-600" />
                ประวัติแผนที่บันทึกไว้ในระบบ (Saved Payoff Plans)
              </h3>
              <button 
                onClick={() => setShowSavedPlansList(false)}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                ปิด
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedPlans.map(plan => (
                <div key={plan.id} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900">{plan.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{plan.dateStr}</span>
                  </div>
                  <div className="text-slate-600 font-medium space-y-0.5 text-[11px]">
                    <div>• กลยุทธ์: {plan.activeStrategy}</div>
                    <div>• รายการหนี้: {plan.debtCount} รายการ | โปะ: {formatCurrency(plan.extraBudget)}</div>
                    <div>• ปลดหนี้ได้: <strong className="text-emerald-600">{plan.payoffDateStr}</strong></div>
                    <div>• ประหยัดดอกเบี้ย: <strong className="text-indigo-600">{formatCurrency(plan.totalInterestSaved)}</strong></div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => {
                        if (confirm(`กู้คืนรายการหนี้จากแผน "${plan.title}" ใช่หรือไม่?`)) {
                          setDebts(plan.debtsSnapshot);
                          setExtraBudget(plan.extraBudget);
                          alert('กู้คืนข้อมูลจากแผนที่เลือกเรียบร้อยแล้ว');
                        }
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      โหลดแผนนี้
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debt Table */}
        <div className="overflow-x-auto">
          {displayDebts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              ไม่พบรายการหนี้ตรงกับคำค้นหาหรือตัวกรองที่เลือก
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4 text-center">อันดับโปะ</th>
                  <th className="py-3 px-4">ชื่อรายการ / เจ้าหนี้</th>
                  <th className="py-3 px-4 text-right">ยอดหนี้คงเหลือ</th>
                  <th className="py-3 px-4 text-right">ดอกเบี้ย (%)</th>
                  <th className="py-3 px-4 text-right">ขั้นต่ำ/เดือน</th>
                  <th className="py-3 px-4 text-center">จะปิดหนี้ได้ในอีกกี่เดือน</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayDebts.map((debt, index) => {
                  const detail = result.debtPayoffDetails.find(d => d.id === debt.id);
                  return (
                    <tr key={debt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs inline-flex items-center justify-center font-bold border border-indigo-100">
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {debt.name}
                          {debt.isScanned && (
                            <span className="badge-gold text-[10px]">สแกนด้วย OCR</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">{debt.lender} • ครบกำหนด: {debt.dueDate}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-indigo-600">
                        {formatCurrency(debt.balance)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                          debt.interestRate >= 20 ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {debt.interestRate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                        {formatCurrency(debt.minPayment)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="badge-green">
                          {detail?.paidOffMonth ? `อีก ${detail.paidOffMonth} เดือน` : '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center space-x-1">
                        <button 
                          onClick={() => onNavigateToEditDebt(debt)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="แก้ไขรายการหนี้"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteDebt(debt.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
