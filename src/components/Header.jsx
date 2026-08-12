import React from 'react';
import { 
  Calculator, 
  Scan, 
  Bot, 
  ShieldCheck, 
  TrendingDown, 
  Bell,
  Smartphone,
  UserCheck,
  CreditCard,
  LogOut,
  Lock
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  isAdminMode, 
  setIsAdminMode, 
  debtCount,
  isMobileView,
  setIsMobileView,
  user,
  isAdmin,
  onLogout,
  selectedUserId,
  setSelectedUserId
}) {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-5 lg:px-8 py-3 mb-5 sm:mb-6 shadow-xs">
      <div className="max-w-[1800px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-3 lg:gap-4">
        
        {/* Logo & Tagline */}
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group self-start xl:self-auto" onClick={() => setActiveTab('calculator')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/25 text-white transition-transform group-hover:scale-105">
            <TrendingDown className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                หนี้น้อย <span className="hidden sm:inline-flex text-indigo-600 text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200">AI Debt Planner</span>
              </h1>
            </div>
            <p className="hidden sm:block text-xs text-slate-500 font-medium">ระบบวางแผนและเลือกกลยุทธ์ปลดหนี้ฉลาดที่สุด</p>
          </div>
        </div>

        {/* Main Desktop Tab Navigation with Active Pill Highlights */}
        <nav className="hidden lg:flex items-center bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/70 shadow-inner overflow-x-auto max-w-full">
          
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'calculator' || activeTab === 'compare_strategies' || activeTab === 'add_debt' || activeTab === 'milestones'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calculator className="w-4 h-4" />
            คำนวณและกลยุทธ์
            {debtCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                activeTab === 'calculator' || activeTab === 'compare_strategies' || activeTab === 'add_debt' || activeTab === 'milestones'
                  ? 'bg-white text-indigo-700' 
                  : 'bg-indigo-100 text-indigo-700'
              }`}>
                {debtCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('payment_history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'payment_history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            บันทึกชำระหนี้ & ภาพรวม
          </button>

          <button
            onClick={() => setActiveTab('ocr')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ocr'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Scan className="w-4 h-4" />
            สแกนใบแจ้งหนี้
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            AI Assistant
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Bell className="w-4 h-4" />
            ศูนย์แจ้งเตือน
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              หลังบ้าน Admin
            </button>
          )}

        </nav>

        {/* Quick Viewport & Admin Toggles & User Info */}
        <div className="w-full xl:w-auto flex items-center justify-start xl:justify-end gap-2 flex-wrap sm:flex-nowrap overflow-x-auto pb-1 sm:pb-0">
          
          {/* User Info Display */}
          {user && (
            <div className={`text-xs px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 ${
              isAdmin 
                ? 'bg-purple-50 text-purple-700 border-purple-200' 
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              <Lock className="w-3.5 h-3.5" />
              {isAdmin ? '👤 Admin' : '👤 User'}: {user.name}
            </div>
          )}

          <button
            onClick={() => setIsMobileView(!isMobileView)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              isMobileView 
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold shadow-xs' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="จำลองมุมมอง Mobile App มือถือ"
          >
            <Smartphone className="w-3.5 h-3.5" />
            {isMobileView ? 'โหมด Mobile (Active)' : 'กรอบ Mobile'}
          </button>

          <button 
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              isAdminMode 
                ? 'bg-purple-50 text-purple-700 border-purple-300 font-bold shadow-xs' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            {isAdminMode ? ' Admin Active' : ' Admin'}
          </button>

          {isAdmin && (
            <select
              value={selectedUserId || 'all'}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border bg-white text-slate-700 border-slate-200 hover:border-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
              title="เลือกผู้ใช้ที่ต้องการดูข้อมูล"
            >
              <option value="all">All users</option>
              <option value="user1">User 1</option>
              <option value="user2">User 2</option>
              <option value="user3">User 3</option>
            </select>
          )}

          {/* Logout Button */}
          {user && (
            <button 
              onClick={onLogout}
              className="text-xs px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5" />
              ออกจากระบบ
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
