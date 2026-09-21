import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Users, 
  DollarSign, 
  Activity, 
  Cpu, 
  Search, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  Sliders,
  Server,
  Database,
  Sparkles,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Building,
  Link as LinkIcon,
  UserCheck,
  FileSpreadsheet,
  Clipboard,
  Layers,
  CheckCheck
} from 'lucide-react';
import { INITIAL_ADMIN_DATA, MOCK_USERS, loadUserDataFromStorage, saveUserDataToStorage } from '../data/mockData';
import { formatCurrency } from '../utils/debtEngine';
import { exportAdminAllUsersPaymentLogsToExcel } from '../utils/excelExport';
import { extractRefinancePromoFromImage, batchExtractRefinancePromos } from '../services/geminiService';
import { getPromotions, savePromotion, deletePromotion } from '../services/refinancePromotionService';

const THAI_BANKS = [
  'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารกสิกรไทย',
  'ธนาคารไทยพาณิชย์',
  'ธนาคารอาคารสงเคราะห์',
  'ธนาคารออมสิน',
  'ธนาคารทหารไทยธนชาต',
  'ธนาคารซีไอเอ็มบี ไทย',
  'ธนาคารกรุงเทพ',
  'ธนาคารกรุงไทย',
  'ธนาคารยูโอบี'
];

const INITIAL_FORM_STATE = {
  id: '',
  bank_name: 'ธนาคารกรุงศรีอยุธยา',
  product_name: '',
  min_income: 15000,
  avg_3yr_rate: 2.99,
  year_1_rate: '',
  year_2_3_rate: '',
  after_year_3_rate: '',
  is_mrta: false,
  is_free_mortgage_fee: false,
  promo_image_url: '',
  bank_ref_link: ''
};

export default function AdminDashboard({ onRefreshView, showToast: globalShowToast }) {
  const adminData = INITIAL_ADMIN_DATA;
  const [activeTab, setActiveTab] = useState('refinance_promos'); // 'refinance_promos' | 'user_mgmt' | 'ocr_logs'
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Promotions State
  const [promotions, setPromotions] = useState([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [promoForm, setPromoForm] = useState(INITIAL_FORM_STATE);
  
  // Multi-Image & Clipboard Queue State
  const [bannerQueue, setBannerQueue] = useState([]); // Array of { id, file, preview, bank_ref_link, status, extractedData }
  const [activeQueueIndex, setActiveQueueIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [notification, setNotification] = useState(null);

  // User Debt Management State
  const [managedUserId, setManagedUserId] = useState('user1');
  const [managedUserData, setManagedUserData] = useState(() => loadUserDataFromStorage('user1'));
  const [editingDebtItem, setEditingDebtItem] = useState(null);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLender, setFormLender] = useState('');
  const [formBalance, setFormBalance] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formMin, setFormMin] = useState('');

  // Load promotions on mount
  useEffect(() => {
    loadPromotionsList();
  }, []);

  // Reload managed user data when managedUserId changes
  useEffect(() => {
    setManagedUserData(loadUserDataFromStorage(managedUserId));
  }, [managedUserId]);

  const loadPromotionsList = async () => {
    setLoadingPromos(true);
    try {
      const data = await getPromotions();
      setPromotions(data);
    } catch (err) {
      console.error('Failed to load promotions:', err);
    } finally {
      setLoadingPromos(false);
    }
  };

  // Refresh metrics function
  const handleRefreshMetrics = async () => {
    setIsRefreshing(true);
    showNotification('🔄 กำลังรีเฟรชข้อมูลหลังบ้าน...');

    try {
      // Refresh promotions list
      await loadPromotionsList();

      // Simulate refresh delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      showNotification('✅ ข้อมูลหลังบ้านได้รับการรีเฟรชเรียบร้อยแล้ว!');
    } catch (err) {
      console.error('Failed to refresh metrics:', err);
      showNotification('❌ เกิดข้อผิดพลาดในการรีเฟรชข้อมูล', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    if (globalShowToast) globalShowToast(message);
    setTimeout(() => setNotification(null), 4000);
  }, [globalShowToast]);

  // Helper to append new files into bannerQueue
  const addFilesToQueue = useCallback((files) => {
    if (!files || files.length === 0) return;

    const newItems = [];
    let processedCount = 0;

    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const item = {
          id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${idx}`,
          file,
          preview: reader.result,
          name: file.name || `Snippet Image ${idx + 1}`,
          bank_ref_link: '',
          status: 'PENDING', // 'PENDING' | 'EXTRACTED' | 'ERROR'
          extractedData: null
        };
        newItems.push(item);
        processedCount++;

        if (processedCount === files.length) {
          setBannerQueue(prev => {
            const updated = [...prev, ...newItems];
            // If first item added, update promoForm preview
            if (prev.length === 0 && newItems.length > 0) {
              setPromoForm(f => ({ ...f, promo_image_url: newItems[0].preview }));
              setActiveQueueIndex(0);
            }
            return updated;
          });
          showNotification(`📸 เพิ่มรูปภาพแบนเนอร์เข้าคิวสำเร็จ (${files.length} รูป)!`);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [showNotification]);

  // Clipboard Paste Handler (Ctrl+V / Snipping Tool Screenshot)
  useEffect(() => {
    if (activeTab !== 'refinance_promos') return;

    const handlePaste = (e) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const pastedFiles = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '');
            const renamedFile = new File([file], `snipping_tool_${timeStr}_${i + 1}.png`, { type: file.type });
            pastedFiles.push(renamedFile);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        addFilesToQueue(pastedFiles);
        showNotification(`📋 นำเข้ารูปภาพจาก Clipboard / Snipping Tool (Ctrl+V) สำเร็จ! (${pastedFiles.length} รูป)`);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab, addFilesToQueue, showNotification]);

  // Multi-file Input Selection Handler
  const handleMultiImageFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFilesToQueue(files);
    }
  };

  // Remove Item from Queue
  const handleRemoveFromQueue = (indexToRemove) => {
    setBannerQueue(prev => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (updated.length === 0) {
        setPromoForm(INITIAL_FORM_STATE);
        setActiveQueueIndex(0);
      } else {
        const newIndex = Math.min(activeQueueIndex, updated.length - 1);
        setActiveQueueIndex(newIndex);
        if (updated[newIndex]?.extractedData) {
          applyExtractedToForm(updated[newIndex].extractedData, updated[newIndex].preview, updated[newIndex].bank_ref_link);
        } else {
          setPromoForm(f => ({ ...f, promo_image_url: updated[newIndex]?.preview || '' }));
        }
      }
      return updated;
    });
  };

  // Select item from Queue to focus
  const handleSelectQueueItem = (index) => {
    setActiveQueueIndex(index);
    const item = bannerQueue[index];
    if (item) {
      if (item.extractedData) {
        applyExtractedToForm(item.extractedData, item.preview, item.bank_ref_link);
      } else {
        setPromoForm(prev => ({
          ...prev,
          promo_image_url: item.preview,
          bank_ref_link: item.bank_ref_link || prev.bank_ref_link
        }));
      }
    }
  };

  // Apply Extracted Data to Form
  const applyExtractedToForm = (extracted, previewUrl, refLink) => {
    setPromoForm(prev => ({
      ...prev,
      bank_name: extracted.bank_name || prev.bank_name,
      product_name: extracted.product_name || prev.product_name,
      min_income: extracted.min_income || prev.min_income,
      avg_3yr_rate: extracted.avg_3yr_rate || prev.avg_3yr_rate,
      year_1_rate: extracted.year_1_rate || prev.year_1_rate,
      year_2_3_rate: extracted.year_2_3_rate || prev.year_2_3_rate,
      after_year_3_rate: extracted.after_year_3_rate || prev.after_year_3_rate,
      is_mrta: extracted.is_mrta !== undefined ? extracted.is_mrta : prev.is_mrta,
      is_free_mortgage_fee: extracted.is_free_mortgage_fee !== undefined ? extracted.is_free_mortgage_fee : prev.is_free_mortgage_fee,
      promo_image_url: previewUrl || prev.promo_image_url,
      bank_ref_link: refLink || extracted.bank_ref_link || prev.bank_ref_link
    }));
  };

  // Single Active Image AI Extraction
  const handleExtractActiveImage = async () => {
    const activeItem = bannerQueue[activeQueueIndex];
    if (!activeItem) {
      return showNotification('⚠️ กรุณาอัปโหลดหรือวางรูปภาพแบนเนอร์ก่อนทำการวิเคราะห์', 'error');
    }

    setIsAnalyzing(true);
    setAiStatusMessage('กำลังส่งรูปภาพแบนเนอร์ให้ Gemini Vision...');

    try {
      const fileToProcess = activeItem.file || activeItem.preview;
      const extracted = await extractRefinancePromoFromImage(fileToProcess, {
        onProgress: (p) => setAiStatusMessage(p.status)
      });

      // Update queue item status
      setBannerQueue(prev => prev.map((item, idx) => {
        if (idx === activeQueueIndex) {
          return { ...item, status: 'EXTRACTED', extractedData: extracted };
        }
        return item;
      }));

      applyExtractedToForm(extracted, activeItem.preview, activeItem.bank_ref_link);
      showNotification('✨ Gemini Vision สกัดข้อมูลแบนเนอร์สำเร็จ!');
    } catch (err) {
      console.error('Extraction error:', err);
      showNotification(`❌ เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
      setAiStatusMessage('');
    }
  };

  // Batch Extract ALL Images in Queue
  const handleBatchExtractAll = async () => {
    if (bannerQueue.length === 0) {
      return showNotification('⚠️ ไม่มีรูปภาพในคิว กรุณาอัปโหลดหรือวางรูปภาพก่อน', 'error');
    }

    setIsAnalyzing(true);
    showNotification(`🤖 เริ่มวิเคราะห์คิวรูปภาพทั้งหมด ${bannerQueue.length} รูป...`);

    const updatedQueue = [...bannerQueue];
    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      setAiStatusMessage(`[${i + 1}/${updatedQueue.length}] Gemini Vision กำลังวิเคราะห์รูป ${item.name}...`);
      try {
        const fileToProcess = item.file || item.preview;
        const extracted = await extractRefinancePromoFromImage(fileToProcess, {
          onProgress: (p) => setAiStatusMessage(`[${i + 1}/${updatedQueue.length}] ${p.status}`)
        });
        updatedQueue[i] = { ...item, status: 'EXTRACTED', extractedData: extracted };
      } catch (err) {
        console.error(`Item ${i} extraction failed:`, err);
        updatedQueue[i] = { ...item, status: 'ERROR' };
      }
    }

    setBannerQueue(updatedQueue);
    setIsAnalyzing(false);
    setAiStatusMessage('');

    // Apply first extracted item to form
    const firstSuccess = updatedQueue.find(q => q.extractedData);
    if (firstSuccess) {
      const idx = updatedQueue.indexOf(firstSuccess);
      setActiveQueueIndex(idx);
      applyExtractedToForm(firstSuccess.extractedData, firstSuccess.preview, firstSuccess.bank_ref_link);
    }

    showNotification(`✅ วิเคราะห์รูปภาพครบทั้ง ${updatedQueue.length} รูปเรียบร้อยแล้ว!`);
  };

  // Batch Save ALL Extracted Promotions in Queue to DB
  const handleBatchSaveAllToDb = async () => {
    const itemsToSave = bannerQueue.filter(q => q.extractedData);
    if (itemsToSave.length === 0) {
      return showNotification('⚠️ ยังไม่มีรายการที่ผ่านการวิเคราะห์ด้วย AI กรุณากดวิเคราะห์รูปภาพก่อน', 'error');
    }

    try {
      for (const item of itemsToSave) {
        const promoToSave = {
          ...item.extractedData,
          promo_image_url: item.preview,
          bank_ref_link: item.bank_ref_link || item.extractedData.bank_ref_link || ''
        };
        await savePromotion(promoToSave);
      }
      showNotification(`🎉 บันทึกโปรโมชันทั้ง ${itemsToSave.length} รายการลง Database เรียบร้อยแล้ว!`);
      setBannerQueue([]);
      setPromoForm(INITIAL_FORM_STATE);
      loadPromotionsList();
    } catch (err) {
      showNotification(`❌ ไม่สามารถบันทึกข้อมูลแบบกลุ่มได้: ${err.message}`, 'error');
    }
  };

  // Single Save Promotion Handler
  const handleSavePromo = async (e) => {
    e.preventDefault();
    if (!promoForm.bank_name.trim()) return showNotification('⚠️ กรุณาระบุชื่อธนาคาร', 'error');
    if (!promoForm.product_name.trim()) return showNotification('⚠️ กรุณาระบุชื่อแพ็กเกจ/โปรโมชัน', 'error');

    try {
      await savePromotion(promoForm);
      showNotification('✅ บันทึกโปรโมชันดอกเบี้ยลง Database เรียบร้อยแล้ว!');
      setPromoForm(INITIAL_FORM_STATE);
      loadPromotionsList();
    } catch (err) {
      showNotification(`❌ ไม่สามารถบันทึกข้อมูลได้: ${err.message}`, 'error');
    }
  };

  const handleEditPromo = (promo) => {
    setPromoForm(promo);
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  const handleDeletePromo = async (id) => {
    if (window.confirm('คุณต้องการลบโปรโมชันนี้ออกจาก Database หรือไม่?')) {
      try {
        await deletePromotion(id);
        showNotification('🗑️ ลบโปรโมชันเรียบร้อยแล้ว');
        loadPromotionsList();
      } catch (err) {
        showNotification(`❌ ไม่สามารถลบข้อมูลได้: ${err.message}`, 'error');
      }
    }
  };

  // User Debt Management Handlers
  const handleSaveManagedUserData = (updated) => {
    setManagedUserData(updated);
    saveUserDataToStorage(managedUserId, updated);
    if (onRefreshView) onRefreshView();
  };

  const handleOpenAddForm = () => {
    setEditingDebtItem(null);
    setFormName('');
    setFormLender('');
    setFormBalance('');
    setFormRate('');
    setFormMin('');
    setShowDebtForm(true);
  };

  const handleOpenEditForm = (debt) => {
    setEditingDebtItem(debt);
    setFormName(debt.name);
    setFormLender(debt.lender || '');
    setFormBalance(String(debt.balance));
    setFormRate(String(debt.interestRate));
    setFormMin(String(debt.minPayment));
    setShowDebtForm(true);
  };

  const handleDeleteUserDebt = (debtId) => {
    if (confirm('Admin: คุณต้องการลบรายการหนี้นี้ของผู้ใช้ใช่หรือไม่?')) {
      const updatedDebts = managedUserData.debts.filter(d => d.id !== debtId);
      const updated = { ...managedUserData, debts: updatedDebts };
      handleSaveManagedUserData(updated);
      showNotification('Admin: ลบรายการหนี้สำเร็จ');
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formName || !formBalance) return;

    const newDebtObj = {
      id: editingDebtItem ? editingDebtItem.id : `debt-${Date.now()}`,
      name: formName,
      lender: formLender || 'ไม่ระบุเจ้าหนี้',
      balance: Number(formBalance),
      interestRate: Number(formRate || 15),
      minPayment: Number(formMin || (Number(formBalance) * 0.05)),
      dueDate: editingDebtItem?.dueDate || '15 ของทุกเดือน',
      isScanned: false
    };

    let updatedDebts = [];
    if (editingDebtItem) {
      updatedDebts = managedUserData.debts.map(d => d.id === editingDebtItem.id ? newDebtObj : d);
    } else {
      updatedDebts = [...managedUserData.debts, newDebtObj];
    }

    const updated = { ...managedUserData, debts: updatedDebts };
    handleSaveManagedUserData(updated);
    setShowDebtForm(false);
    showNotification(`Admin: บันทึกข้อมูลหนี้ ${formName} สำหรับ ${MOCK_USERS[managedUserId]?.name || managedUserId} สำเร็จ`);
  };

  const handleExportAllUsersPaymentHistory = () => {
    const allUsersDataMap = {
      user1: { name: MOCK_USERS.user1.name, ...loadUserDataFromStorage('user1') },
      user2: { name: MOCK_USERS.user2.name, ...loadUserDataFromStorage('user2') },
      user3: { name: MOCK_USERS.user3.name, ...loadUserDataFromStorage('user3') }
    };
    exportAdminAllUsersPaymentLogsToExcel(allUsersDataMap);
  };

  const filteredOcrLogs = adminData.ocrLogs.filter(log => {
    const matchesSearch = log.user.toLowerCase().includes(searchFilter.toLowerCase()) || 
                          log.fileName.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          log.extractedItems.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = selectedStatus === 'ALL' || log.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const activeQueueItem = bannerQueue[activeQueueIndex];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl font-bold text-xs flex items-center gap-2 border animate-bounce ${
          notification.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {notification.type === 'error' ? <X className="w-4 h-4 text-rose-600" /> : <Check className="w-4 h-4 text-emerald-600" />}
          {notification.message}
        </div>
      )}

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
              จัดการโปรโมชันดอกเบี้ยรีไฟแนนซ์ ( Gemini Vision AI แบบกลุ่ม & Snipping Tool Clipboard Paste)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportAllUsersPaymentHistory}
              className="btn-gold text-xs font-bold py-2.5 px-3.5 cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ดาวน์โหลดประวัติผู้ใช้ (Excel)</span>
            </button>

            <button
              onClick={handleRefreshMetrics}
              disabled={isRefreshing}
              className="btn-secondary text-xs font-semibold cursor-pointer py-2.5 px-3"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>รีเฟรชสถิติ</span>
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
            <span>โปรโมชันรีไฟแนนซ์ใน DB</span>
            <Building className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {promotions.length} แพ็กเกจ
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">พร้อมอัปเดตแบบเรียลไทม์</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex justify-between text-xs text-slate-500 font-bold mb-1">
            <span>AI Multi-Image & Clipboard</span>
            <Clipboard className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">
            Ctrl+V Ready
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Batch Extraction Enabled</div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('refinance_promos')}
          className={`pb-3 px-4 text-sm font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'refinance_promos'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          จัดการโปรโมชันดอกเบี้ยรีไฟแนนซ์ (Refinance Rates Manager)
        </button>

        <button
          onClick={() => setActiveTab('user_mgmt')}
          className={`pb-3 px-4 text-sm font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'user_mgmt'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          จัดการผู้ใช้และหนี้สิน (User & Debt Management)
        </button>

        <button
          onClick={() => setActiveTab('ocr_logs')}
          className={`pb-3 px-4 text-sm font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ocr_logs'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database className="w-4 h-4" />
          ประวัติการสแกน OCR หลังบ้าน (OCR Audit Logs)
        </button>
      </div>

      {/* ==================== TAB 1: REFINANCE PROMOTIONS MANAGER ==================== */}
      {activeTab === 'refinance_promos' && (
        <div className="space-y-6">

          {/* ADMIN PROMOTION FORM & MULTI-IMAGE / CLIPBOARD GEMINI VISION EXTRACTION */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="badge-gold">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Multi-Image & Clipboard Snipping Tool Enabled
                  </span>
                  <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Clipboard className="w-3 h-3" /> กด Ctrl+V หรือ วางรูปได้เลย
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 pt-1.5">
                  {promoForm.id ? '✏️ แก้ไขโปรโมชันดอกเบี้ย' : '➕ เพิ่ม/วิเคราะห์รูปภาพแบนเนอร์โปรโมชัน (Batch Upload & Extract)'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  สามารถอัปโหลดพร้อมกันหลายรูป หรือใช้ Snipping Tool แคปรูปแล้วกด Ctrl+V วางในหน้านี้ได้ทันที
                </p>
              </div>
              {promoForm.id && (
                <button
                  onClick={() => {
                    setPromoForm(INITIAL_FORM_STATE);
                    setBannerQueue([]);
                  }}
                  className="btn-secondary text-xs cursor-pointer"
                >
                  ยกเลิกการแก้ไข
                </button>
              )}
            </div>

            {/* Banner Upload Dropzone + Clipboard Paste Support */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              
              {/* File Upload Box with Multiple & Paste */}
              <div className="md:col-span-1 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    อัปโหลด / วางรูปภาพ (Ctrl+V)
                  </label>
                  {bannerQueue.length > 0 && (
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                      ในคิว {bannerQueue.length} รูป
                    </span>
                  )}
                </div>
                
                <div className="border-2 border-dashed border-indigo-300 hover:border-indigo-600 rounded-xl p-4 text-center bg-white transition-all relative flex flex-col items-center justify-center min-h-36 cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMultiImageFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="เลือกรูปภาพทีละหลายรูป"
                  />
                  {activeQueueItem ? (
                    <div className="space-y-2 w-full">
                      <img src={activeQueueItem.preview} alt="Promo Banner Preview" className="h-28 object-contain mx-auto rounded-lg border shadow-xs" />
                      <div className="text-[10px] text-indigo-600 font-bold flex items-center justify-center gap-1">
                        <Upload className="w-3 h-3" /> เพิ่มรูปเพิ่ม (เลือกหลายไฟล์ได้) หรือกด Ctrl+V
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 p-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto text-indigo-600 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-black text-indigo-700 block">คลิก/ลากวางรูปภาพ (เลือกหลายไฟล์ได้)</span>
                      <span className="text-[10px] text-slate-500 font-bold block bg-amber-50 text-amber-800 border border-amber-200 py-1 px-2 rounded-lg">
                        📋 หรือใช้ Snipping Tool แคปรูปแล้วกด Ctrl+V ได้เลย!
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Gemini Vision AI Batch & URL Controls */}
              <div className="md:col-span-2 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <LinkIcon className="w-4 h-4 text-indigo-600" />
                    ลิงก์ URL อ้างอิงเว็บไซต์ธนาคารจริง (Bank Ref Link)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://www.krungsri.com/th/personal/loans/home-loans/refinance"
                      value={promoForm.bank_ref_link}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPromoForm(f => ({ ...f, bank_ref_link: val }));
                        if (bannerQueue[activeQueueIndex]) {
                          setBannerQueue(q => q.map((item, idx) => idx === activeQueueIndex ? { ...item, bank_ref_link: val } : item));
                        }
                      }}
                      className="input-dark text-xs py-2 flex-1"
                    />
                    {promoForm.bank_ref_link && (
                      <a
                        href={promoForm.bank_ref_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs px-3 font-semibold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> ทดสอบลิงก์
                      </a>
                    )}
                  </div>
                </div>

                {/* AI Actions */}
                <div className="bg-indigo-50/80 p-4 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        Extract with Gemini Vision AI
                      </h4>
                      <p className="text-[11px] text-indigo-700 mt-0.5 font-medium">
                        เลือกวิเคราะห์เฉพาะรูปที่เลือก หรือวิเคราะห์รูปภาพทั้งหมดในคิวทีเดียว
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleExtractActiveImage}
                        disabled={isAnalyzing || bannerQueue.length === 0}
                        className="btn-secondary text-xs font-bold py-2 px-3 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        วิเคราะห์รูปปัจจุบัน
                      </button>

                      <button
                        type="button"
                        onClick={handleBatchExtractAll}
                        disabled={isAnalyzing || bannerQueue.length === 0}
                        className="btn-gold text-xs font-black py-2.5 px-4 flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                      >
                        <Layers className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                        {isAnalyzing ? 'กำลังวิเคราะห์คิว...' : `วิเคราะห์คิวทั้งหมด (${bannerQueue.length} รูป)`}
                      </button>
                    </div>
                  </div>

                  {aiStatusMessage && (
                    <div className="text-xs text-indigo-700 font-bold flex items-center gap-1.5 bg-white p-2 rounded-lg border border-indigo-200">
                      <Clock className="w-4 h-4 animate-spin text-indigo-600" /> {aiStatusMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* QUEUED BANNERS THUMBNAIL CAROUSEL */}
            {bannerQueue.length > 0 && (
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    คิวรูปภาพแบนเนอร์ที่อัปโหลด/วางเข้ามา ({bannerQueue.length} รูป):
                  </span>
                  
                  {bannerQueue.some(q => q.extractedData) && (
                    <button
                      type="button"
                      onClick={handleBatchSaveAllToDb}
                      className="btn-gold text-xs font-extrabold py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4 text-emerald-700" />
                      บันทึกรูปภาพที่วิเคราะห์แล้วทั้งหมดลง DB
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {bannerQueue.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectQueueItem(idx)}
                      className={`relative flex-shrink-0 w-28 h-24 rounded-xl border-2 p-1.5 bg-white cursor-pointer transition-all ${
                        activeQueueIndex === idx
                          ? 'border-indigo-600 ring-2 ring-indigo-300 shadow-md'
                          : 'border-slate-200 hover:border-indigo-300 opacity-80'
                      }`}
                    >
                      <img src={item.preview} alt={`Banner ${idx + 1}`} className="w-full h-16 object-contain rounded-md" />
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromQueue(idx);
                        }}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-0.5 hover:bg-rose-700 shadow-md"
                        title="ลบออกจากคิว"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="mt-1 flex items-center justify-between text-[9px] font-bold">
                        <span className="truncate text-slate-600 max-w-[50px]">{idx + 1}. {item.name}</span>
                        {item.status === 'EXTRACTED' && (
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-black">AI ✓</span>
                        )}
                        {item.status === 'PENDING' && (
                          <span className="bg-slate-100 text-slate-500 px-1 py-0.2 rounded">รอวิเคราะห์</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FORM INPUT FIELDS VERIFICATION */}
            <form onSubmit={handleSavePromo} className="space-y-4 pt-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center justify-between">
                <span>รายละเอียดโปรโมชันและเงื่อนไข (Verification & Edit Form)</span>
                {bannerQueue[activeQueueIndex]?.status === 'EXTRACTED' && (
                  <span className="badge-green">✨ เติมข้อมูลอัตโนมัติจาก Gemini Vision</span>
                )}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Bank Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อธนาคาร (bank_name) *
                  </label>
                  <select
                    value={promoForm.bank_name}
                    onChange={(e) => setPromoForm({ ...promoForm, bank_name: e.target.value })}
                    className="input-dark text-xs py-2 w-full bg-white font-medium"
                    required
                  >
                    {THAI_BANKS.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>

                {/* Product Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อแพ็กเกจ / โปรโมชัน (product_name) *
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น สินเชื่อบ้านกรุงศรีรีไฟแนนซ์ ทางเลือก 1"
                    value={promoForm.product_name}
                    onChange={(e) => setPromoForm({ ...promoForm, product_name: e.target.value })}
                    className="input-dark text-xs py-2 w-full"
                    required
                  />
                </div>

                {/* Min Income */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รายได้ขั้นต่ำที่สมัครได้ (min_income) (บาท/เดือน)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    placeholder="15000"
                    value={promoForm.min_income}
                    onChange={(e) => setPromoForm({ ...promoForm, min_income: Number(e.target.value) })}
                    className="input-dark text-xs py-2 w-full"
                  />
                </div>

                {/* Avg 3Yr Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 text-rose-600">
                    อัตราดอกเบี้ยเฉลี่ย 3 ปีแรก (%) (avg_3yr_rate) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="2.55"
                    value={promoForm.avg_3yr_rate}
                    onChange={(e) => setPromoForm({ ...promoForm, avg_3yr_rate: Number(e.target.value) })}
                    className="input-dark text-xs py-2 w-full font-bold text-rose-600"
                    required
                  />
                </div>

                {/* Year 1 Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ดอกเบี้ยปีที่ 1 (year_1_rate)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 1.49% หรือ คงที่ 2.20%"
                    value={promoForm.year_1_rate}
                    onChange={(e) => setPromoForm({ ...promoForm, year_1_rate: e.target.value })}
                    className="input-dark text-xs py-2 w-full"
                  />
                </div>

                {/* Year 2-3 Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ดอกเบี้ยปีที่ 2-3 (year_2_3_rate)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 2.20% หรือ MRR-2.15%"
                    value={promoForm.year_2_3_rate}
                    onChange={(e) => setPromoForm({ ...promoForm, year_2_3_rate: e.target.value })}
                    className="input-dark text-xs py-2 w-full"
                  />
                </div>

                {/* After Year 3 Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ดอกเบี้ยหลังปีที่ 3 (after_year_3_rate)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น MRR-1.50%"
                    value={promoForm.after_year_3_rate}
                    onChange={(e) => setPromoForm({ ...promoForm, after_year_3_rate: e.target.value })}
                    className="input-dark text-xs py-2 w-full"
                  />
                </div>

                {/* Image URL fallback text */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL รูปภาพแบนเนอร์ (promo_image_url)
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/banner.jpg"
                    value={promoForm.promo_image_url}
                    onChange={(e) => setPromoForm({ ...promoForm, promo_image_url: e.target.value })}
                    className="input-dark text-xs py-2 w-full"
                  />
                </div>
              </div>

              {/* Switches for MRTA & Free Mortgage Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 border rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={promoForm.is_mrta}
                    onChange={(e) => setPromoForm({ ...promoForm, is_mrta: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">เงื่อนไขทำประกัน MRTA / MLTA (is_mrta)</span>
                    <span className="text-[10px] text-slate-500 block">ต้องสมัครประกันคุ้มครองวงเงินกู้เพื่อรับอัตราดอกเบี้ยนี้</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 border rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={promoForm.is_free_mortgage_fee}
                    onChange={(e) => setPromoForm({ ...promoForm, is_free_mortgage_fee: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">ฟรีค่าจดจำนอง 1% (is_free_mortgage_fee)</span>
                    <span className="text-[10px] text-slate-500 block">ธนาคารออกค่าจดจำนองให้ 1% ของวงเงินกู้</span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPromoForm(INITIAL_FORM_STATE);
                  }}
                  className="btn-secondary text-xs px-5 py-2.5 font-bold cursor-pointer"
                >
                  ล้างฟอร์ม
                </button>

                <button
                  type="submit"
                  className="btn-gold text-xs font-black py-2.5 px-6 flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {promoForm.id ? 'อัปเดตข้อมูลใน Database' : 'บันทึกโปรโมชันลง Database'}
                </button>
              </div>
            </form>
          </div>

          {/* REFINANCE PROMOTIONS TABLE */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-600" />
                  รายการโปรโมชันดอกเบี้ยใน Database ({promotions.length} รายการ)
                </h3>
                <p className="text-xs text-slate-500 font-medium">ตารางแสดงอัตราดอกเบี้ยและลิงก์อ้างอิงของแต่ละธนาคาร</p>
              </div>
            </div>

            {loadingPromos ? (
              <div className="py-12 text-center text-xs text-slate-400 font-bold space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                <span>กำลังโหลดข้อมูลโปรโมชัน...</span>
              </div>
            ) : promotions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 font-medium space-y-2">
                <Building className="w-10 h-10 text-slate-300 mx-auto" />
                <span>ยังไม่มีข้อมูลโปรโมชันในระบบ กรุณาเพิ่มข้อมูลใหม่ด้านบน</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider bg-slate-50">
                      <th className="py-3 px-4">ธนาคาร & แพ็กเกจ</th>
                      <th className="py-3 px-4 text-center">ดอกเบี้ยเฉลี่ย 3 ปี</th>
                      <th className="py-3 px-4">รายได้ขั้นต่ำ</th>
                      <th className="py-3 px-4">เงื่อนไขสิทธิพิเศษ</th>
                      <th className="py-3 px-4">ลิงก์อ้างอิงธนาคาร</th>
                      <th className="py-3 px-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {promotions.map((promo) => (
                      <tr key={promo.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900">{promo.bank_name}</div>
                          <div className="text-[11px] text-indigo-600 font-medium">{promo.product_name}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-base font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 inline-block">
                            {promo.avg_3yr_rate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {promo.min_income > 0 ? `${promo.min_income.toLocaleString()} ฿` : 'ไม่กำหนดขั้นต่ำ'}
                        </td>
                        <td className="py-3 px-4 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {promo.is_mrta && (
                              <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200">
                                MRTA Required
                              </span>
                            )}
                            {promo.is_free_mortgage_fee && (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                                ฟรีค่าจดจำนอง 1%
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {promo.year_1_rate && `ปีแรก: ${promo.year_1_rate}`}
                            {promo.after_year_3_rate && ` | หลังจากนั้น: ${promo.after_year_3_rate}`}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {promo.bank_ref_link ? (
                            <a
                              href={promo.bank_ref_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1 text-[11px]"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> เว็บไซต์ธนาคาร
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleEditPromo(promo)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="แก้ไขโปรโมชัน"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePromo(promo.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="ลบโปรโมชัน"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 2: USER DEBT MANAGEMENT ==================== */}
      {activeTab === 'user_mgmt' && (
        <div className="bg-white border border-indigo-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="badge-gold text-xs">
                <UserCheck className="w-3.5 h-3.5" />
                USER DEBT MANAGEMENT SYSTEM
              </span>
              <h2 className="text-lg font-black text-slate-900 pt-1">
                จัดการผู้ใช้และแก้ไขข้อมูลหนี้สิน (Admin Direct Access)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                เลือกผู้ใช้งานเพื่อแก้ไข/เพิ่ม/ลบรายการหนี้ หรือปรับงบโปะเพิ่มโดยตรง
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">เลือกผู้ใช้:</span>
                <select
                  value={managedUserId}
                  onChange={(e) => setManagedUserId(e.target.value)}
                  className="input-dark font-bold text-xs py-2 px-3 bg-indigo-50 border-indigo-200 text-indigo-900 cursor-pointer"
                >
                  <option value="user1">User 1 ({MOCK_USERS.user1.name})</option>
                  <option value="user2">User 2 ({MOCK_USERS.user2.name})</option>
                  <option value="user3">User 3 ({MOCK_USERS.user3.name})</option>
                </select>
              </div>

              <button
                onClick={handleOpenAddForm}
                className="btn-gold text-xs py-2 px-3 font-bold cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                เพิ่มหนี้ใหม่ให้ User
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">รายการหนี้</th>
                  <th className="py-2.5 px-3">เจ้าหนี้</th>
                  <th className="py-2.5 px-3 text-right">ยอดคงเหลือ (บาท)</th>
                  <th className="py-2.5 px-3 text-right">ดอกเบี้ย (%)</th>
                  <th className="py-2.5 px-3 text-right">ขั้นต่ำ (บาท)</th>
                  <th className="py-2.5 px-3 text-center">จัดการ Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(managedUserData.debts || []).length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-slate-400">
                      ผู้ใช้รายนี้ไม่มีรายการหนี้ในระบบ
                    </td>
                  </tr>
                ) : (
                  managedUserData.debts.map((debt) => (
                    <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{debt.name}</td>
                      <td className="py-3 px-3 text-slate-600">{debt.lender}</td>
                      <td className="py-3 px-3 text-right font-extrabold text-indigo-600">{formatCurrency(debt.balance)}</td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600">{debt.interestRate}%</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">{formatCurrency(debt.minPayment)}</td>
                      <td className="py-3 px-3 text-center space-x-1">
                        <button
                          onClick={() => handleOpenEditForm(debt)}
                          className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-50 font-bold cursor-pointer"
                          title="แก้ไขข้อมูลหนี้"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUserDebt(debt.id)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold cursor-pointer"
                          title="ลบรายการหนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {showDebtForm && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in border border-slate-200">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center justify-between border-b pb-3">
                  <span>{editingDebtItem ? '✏️ Admin แก้ไขหนี้ผู้ใช้' : '➕ Admin เพิ่มหนี้ให้ผู้ใช้'} ({MOCK_USERS[managedUserId]?.name})</span>
                  <button onClick={() => setShowDebtForm(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
                </h3>

                <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">ชื่อรายการหนี้ *</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="input-dark font-medium"
                      placeholder="เช่น บัตรเครดิต KTC"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">เจ้าหนี้ / สถาบันการเงิน</label>
                    <input
                      type="text"
                      value={formLender}
                      onChange={(e) => setFormLender(e.target.value)}
                      className="input-dark font-medium"
                      placeholder="เช่น ธนาคารกรุงไทย"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">ยอดหนี้คงเหลือ (บาท) *</label>
                      <input
                        type="number"
                        value={formBalance}
                        onChange={(e) => setFormBalance(e.target.value)}
                        className="input-dark font-bold text-indigo-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">ดอกเบี้ย (% ต่อปี)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formRate}
                        onChange={(e) => setFormRate(e.target.value)}
                        className="input-dark font-bold text-rose-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">ค่างวดขั้นต่ำต่อเดือน (บาท)</label>
                    <input
                      type="number"
                      value={formMin}
                      onChange={(e) => setFormMin(e.target.value)}
                      className="input-dark font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowDebtForm(false)}
                      className="btn-secondary text-xs py-2 px-4"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="btn-gold text-xs py-2 px-4 font-bold"
                    >
                      บันทึกข้อมูล
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: OCR AUDIT LOGS ==================== */}
      {activeTab === 'ocr_logs' && (
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
      )}

      {/* SYSTEM LOGS & SERVER NODES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            การตั้งค่าและควบคุมระบบหลังบ้าน
          </h3>

          <div className="space-y-3 text-xs font-semibold">
            <button 
              onClick={() => alert('ล้างแคชระบบ OCR สำเร็จ!')}
              className="btn-secondary w-full justify-between cursor-pointer"
            >
              <span>ล้างแคช OCR Simulation</span>
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button 
              onClick={() => alert('ส่งคำสั่ง Re-train AI Engine Parameters เรียบร้อยแล้ว')}
              className="btn-secondary w-full justify-between cursor-pointer"
            >
              <span>Re-tune AI Payoff Algorithm</span>
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            </button>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-medium">
              <strong>Admin Note:</strong> ระบบ Gemini Vision API และ Database Refinance Promotion Active ทุก Node
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
