import React, { useState } from 'react';
import { 
  ArrowLeft, 
  PlusCircle, 
  Edit3, 
  Save, 
  Home, 
  ChevronRight, 
  AlertCircle,
  FileEdit
} from 'lucide-react';
import { formatCurrency } from '../utils/debtEngine';

export default function AddEditDebtPage({ editingDebt, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: editingDebt?.name || '',
    lender: editingDebt?.lender || '',
    balance: editingDebt?.balance || '',
    interestRate: editingDebt?.interestRate || '',
    minPayment: editingDebt?.minPayment || '',
    dueDate: editingDebt?.dueDate || '15 ของทุกเดือน'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.balance || !formData.interestRate) return;

    onSave({
      id: editingDebt?.id || `debt-${Date.now()}`,
      name: formData.name,
      lender: formData.lender || 'อื่นๆ',
      balance: Number(formData.balance),
      interestRate: Number(formData.interestRate),
      minPayment: Number(formData.minPayment || Math.round(Number(formData.balance) * 0.05)),
      dueDate: formData.dueDate || '15 ของทุกเดือน',
      isScanned: editingDebt?.isScanned || false
    });
  };

  // Preview estimated monthly interest
  const estimatedMonthlyInterest = formData.balance && formData.interestRate 
    ? Math.round((Number(formData.balance) * (Number(formData.interestRate) / 100)) / 12)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      
      {/* 1. Visual Breadcrumb Trail */}
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

      {/* 2. Visual Page Hero Header */}
      <div className="bg-white p-6 rounded-2xl relative overflow-hidden border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="badge-gold text-xs font-bold">
                ✍️ กรอกและบันทึกข้อมูลหนี้สิน
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 pt-1 tracking-tight">
              {editingDebt ? <Edit3 className="w-6 h-6 text-indigo-600" /> : <PlusCircle className="w-6 h-6 text-indigo-600" />}
              {editingDebt ? `แก้ไขข้อมูลหนี้: ${editingDebt.name}` : 'เพิ่มรายการหนี้ใหม่เข้าสู่ระบบ'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              ระบุรายละเอียดภาระหนี้สินของคุณเพื่อให้ AI คำนวณแผนการโปะลดดอกเบี้ยได้อย่างแม่นยำที่สุด
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
      </div>

      {/* 3. Main Debt Form Container */}
      <div className="bg-white p-6 rounded-2xl space-y-6 shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                ชื่อรายการหนี้ *
              </label>
              <input
                type="text"
                placeholder="เช่น บัตรเครดิต KBank / สินเชื่อส่วนบุคคล SCB"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-dark text-slate-900 font-semibold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                สถาบันการเงิน / เจ้าหนี้
              </label>
              <input
                type="text"
                placeholder="เช่น กสิกรไทย, KTC, SCB, UOB"
                value={formData.lender}
                onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
                className="input-dark text-slate-900 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                ยอดหนี้คงเหลือปัจจุบัน (บาท) *
              </label>
              <input
                type="number"
                placeholder="เช่น 50000"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                className="input-dark text-indigo-600 font-black text-base"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                อัตราดอกเบี้ยต่อปี (%) *
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="เช่น 16.0 หรือ 24.5"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                className="input-dark text-rose-600 font-black text-base"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                ยอดชำระขั้นต่ำต่อเดือน (บาท)
              </label>
              <input
                type="number"
                placeholder="หากเว้นว่าง ระบบจะคำนวณที่ 5%"
                value={formData.minPayment}
                onChange={(e) => setFormData({ ...formData, minPayment: e.target.value })}
                className="input-dark font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                วันครบกำหนดชำระของทุกเดือน
              </label>
              <input
                type="text"
                placeholder="เช่น 15 ของทุกเดือน หรือ 05 ของทุกเดือน"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="input-dark font-medium"
              />
            </div>
          </div>

          {/* Real-time Monthly Interest Preview */}
          {formData.balance && formData.interestRate && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-700 font-bold">
                <AlertCircle className="w-4 h-4 text-indigo-600" />
                <span>ประมาณการดอกเบี้ยที่เกิดขึ้นต่อเดือน:</span>
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
      </div>

    </div>
  );
}
