import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  DollarSign, 
  Activity, 
  Cpu, 
  Search, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Sliders,
  Server,
  Database
} from 'lucide-react';
import { INITIAL_ADMIN_DATA } from '../data/mockData';
import { formatCurrency } from '../utils/debtEngine';

export default function AdminDashboard() {
  const [adminData, setAdminData] = useState(INITIAL_ADMIN_DATA);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredOcrLogs = adminData.ocrLogs.filter(log => {
    const matchesSearch = log.user.toLowerCase().includes(searchFilter.toLowerCase()) || 
                          log.fileName.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          log.extractedItems.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = selectedStatus === 'ALL' || log.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleRefreshMetrics = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setAdminData(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          totalUsers: prev.metrics.totalUsers + Math.floor(Math.random() * 5),
          totalManagedDebt: prev.metrics.totalManagedDebt + Math.floor(Math.random() * 150000),
          aiLatency: `${110 + Math.floor(Math.random() * 30)} ms`
        }
      }));
      setIsRefreshing(false);
    }, 800);
  };

  const exportOcrLogs = () => {
    const logData = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminData.ocrLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", logData);
    downloadAnchor.setAttribute("download", `ocr_admin_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Admin Top Header Banner */}
      <div className="bg-white p-6 rounded-2xl relative overflow-hidden border border-purple-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                ADMIN BACKEND SYSTEM MANAGEMENT
              </span>
              <span className="badge-green">System Healthy</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              แผงควบคุมผู้ดูแลระบบหลังบ้าน (Backend Admin Portal)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">
              ตรวจสอบการทำงานหลังบ้าน ดูประวัติการประมวลผล OCR สแกนใบแจ้งหนี้ สถิติผู้ใช้งาน และสถานะเซิร์ฟเวอร์แบบเรียลไทม์
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshMetrics}
              disabled={isRefreshing}
              className="btn-secondary text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              รีเฟรชสถิติ
            </button>

            <button
              onClick={exportOcrLogs}
              className="btn-gold text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลด OCR Audit Log
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between text-xs text-slate-500 font-bold mb-1">
            <span>ผู้ใช้งานทั้งหมด</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {adminData.metrics.totalUsers.toLocaleString()} คน
          </div>
          <div className="text-[11px] text-emerald-600 font-bold">↑ +12.4% เดือนนี้</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between text-xs text-slate-500 font-bold mb-1">
            <span>ยอดหนี้รวมที่ดูแลในระบบ</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {formatCurrency(adminData.metrics.totalManagedDebt)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">เฉลี่ย 33,780 ฿ / รายการ</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between text-xs text-slate-500 font-bold mb-1">
            <span>ความแม่นยำ OCR Engine</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {adminData.metrics.ocrAccuracy}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">ผ่านการสแกนแล้ว 45,210 รูป</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between text-xs text-slate-500 font-bold mb-1">
            <span>AI Latency & Processing</span>
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {adminData.metrics.aiLatency}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Node Cluster: Normal</div>
        </div>

      </div>

      {/* OCR EXTRACTION LOGS AUDIT TABLE */}
      <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              ประวัติการสแกน OCR หลังบ้าน (OCR Extraction Audit Logs)
            </h3>
            <p className="text-xs text-slate-500 font-medium">ตรวจสอบความถูกต้องและผลการดึงข้อมูลจากรูปภาพของผู้ใช้</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="ค้นหาชื่อไฟล์ หรือ User ID..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="input-dark pl-9 text-xs py-2"
              />
            </div>

            {/* Filter Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input-dark text-xs py-2 w-full sm:w-36 bg-white font-medium"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PENDING">PENDING</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider bg-slate-50">
                <th className="py-3 px-4">Log ID & เวลา</th>
                <th className="py-3 px-4">ผู้ใช้งาน (User ID)</th>
                <th className="py-3 px-4">ชื่อไฟล์รูปภาพ</th>
                <th className="py-3 px-4 text-center">สถานะ OCR</th>
                <th className="py-3 px-4 text-center">Accuracy (%)</th>
                <th className="py-3 px-4">ข้อมูลที่สกัดได้ (Extracted Summary)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredOcrLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500">
                    <div className="text-indigo-600 font-bold">{log.id}</div>
                    <div className="text-[10px] text-slate-400">{log.timestamp}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {log.user}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {log.fileName}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="badge-green">
                      <CheckCircle2 className="w-3 h-3" />
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-extrabold text-indigo-600">
                    {log.confidence}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {log.extractedItems}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SYSTEM LOGS & SERVER NODES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* System Activity Console */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-600" />
            System Live Activity Console
          </h3>

          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2 h-48 overflow-y-auto">
            {adminData.systemLogs.map((sLog) => (
              <div key={sLog.id} className="flex items-start gap-2">
                <span className="text-slate-400">[{sLog.time}]</span>
                <span className={sLog.level === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-indigo-400 font-bold'}>
                  [{sLog.level}]
                </span>
                <span className="text-slate-300">{sLog.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Backend System Controls */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            การตั้งค่าและควบคุมระบบหลังบ้าน
          </h3>

          <div className="space-y-3 text-xs font-semibold">
            <button 
              onClick={() => alert('ล้างแคชระบบ OCR สำเร็จ!')}
              className="btn-secondary w-full justify-between"
            >
              <span>ล้างแคช OCR Simulation</span>
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button 
              onClick={() => alert('ส่งคำสั่ง Re-train AI Engine Parameters เรียบร้อยแล้ว')}
              className="btn-secondary w-full justify-between"
            >
              <span>Re-tune AI Payoff Algorithm</span>
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            </button>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-medium">
              <strong>Admin Note:</strong> ระบบเปิดรับ Multi-Image Batch OCR และ AI Hybrid Payoff Simulation เป็นปกติทุก Node
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
