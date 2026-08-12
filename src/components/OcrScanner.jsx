import React, { useState } from 'react';
import { 
  Upload, 
  Camera, 
  FileText, 
  CheckCircle, 
  Sparkles, 
  Scan, 
  Trash2, 
  ArrowRight, 
  AlertCircle,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';
import { MOCK_OCR_SAMPLES } from '../data/mockData';
import { formatCurrency } from '../utils/debtEngine';

export default function OcrScanner({ onImportDebts, onNavigateToCalculator }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState([]);
  const [selectedResultIds, setSelectedResultIds] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);

  // Handle Multi-file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = files.map((file, idx) => ({
      id: `uploaded-${Date.now()}-${idx}`,
      file,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      previewUrl: URL.createObjectURL(file)
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  // Load sample multi-image mock data
  const loadMockSamples = () => {
    const mockFiles = MOCK_OCR_SAMPLES.map(sample => ({
      id: sample.id,
      name: sample.fileName,
      size: sample.fileSize,
      previewUrl: sample.previewUrl,
      extracted: sample.extracted
    }));

    setSelectedFiles(mockFiles);
  };

  // Simulate Multi-Image OCR Scan
  const startScanProcess = () => {
    if (selectedFiles.length === 0) return;

    setIsScanning(true);
    setScanProgress(10);
    setScanResults([]);

    let current = 0;
    const interval = setInterval(() => {
      current += 20;
      setScanProgress(Math.min(current, 90));

      if (current >= 100) {
        clearInterval(interval);
        setScanProgress(100);
        setIsScanning(false);

        // Generate extracted data for each selected file
        const results = selectedFiles.map((fileItem, index) => {
          if (fileItem.extracted) {
            return {
              id: fileItem.id,
              fileName: fileItem.name,
              previewUrl: fileItem.previewUrl,
              data: { ...fileItem.extracted }
            };
          }

          // Dynamic mock extraction for user-uploaded custom images
          const mockLenders = ['ธนาคารกรุงเทพ', 'ธนาคารกสิกรไทย', 'ธนาคารกรุงศรี', 'AEON', 'KTC'];
          const mockTypes = ['บัตรเครดิต', 'สินเชื่อส่วนบุคคล', 'บัตรกดเงินสด'];
          const randomLender = mockLenders[index % mockLenders.length];
          const randomType = mockTypes[index % mockTypes.length];
          const randomBalance = Math.floor(Math.random() * 60000) + 15000;
          const randomInterest = [16.0, 18.0, 24.0, 25.0][index % 4];

          return {
            id: fileItem.id,
            fileName: fileItem.name,
            previewUrl: fileItem.previewUrl,
            data: {
              name: `${randomType} ${randomLender}`,
              lender: randomLender,
              balance: randomBalance,
              interestRate: randomInterest,
              minPayment: Math.round(randomBalance * 0.05),
              dueDate: `${10 + (index * 5)} ของทุกเดือน`,
              confidence: 0.95 + (index * 0.01)
            }
          };
        });

        setScanResults(results);
        setSelectedResultIds(results.map(r => r.id));
      }
    }, 400);
  };

  // Toggle selection for import
  const toggleSelectResult = (id) => {
    if (selectedResultIds.includes(id)) {
      setSelectedResultIds(selectedResultIds.filter(i => i !== id));
    } else {
      setSelectedResultIds([...selectedResultIds, id]);
    }
  };

  // Import selected debts to Calculator
  const handleConfirmImport = () => {
    const itemsToImport = scanResults
      .filter(r => selectedResultIds.includes(r.id))
      .map(r => ({
        id: `scanned-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: r.data.name,
        lender: r.data.lender,
        balance: Number(r.data.balance),
        interestRate: Number(r.data.interestRate),
        minPayment: Number(r.data.minPayment),
        dueDate: r.data.dueDate || '15 ของทุกเดือน',
        isScanned: true
      }));

    if (itemsToImport.length > 0) {
      onImportDebts(itemsToImport);
      onNavigateToCalculator();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl relative overflow-hidden border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-gold">
                <Scan className="w-3.5 h-3.5" />
                OCR Multi-Image Scanner Engine
              </span>
              <span className="badge-blue">รองรับหลายไฟล์พร้อมกัน</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              สแกนและนำเข้าใบแจ้งหนี้อัตโนมัติ (Multi-Image Import)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">
              สามารถเลือกหรือลากไฟล์รูปภาพใบแจ้งหนี้ <strong className="text-indigo-600">หลายรูปพร้อมกัน</strong> หรือใช้กล้องถ่ายรูป ระบบ AI OCR จะดึงข้อมูล ยอดหนี้ อัตราดอกเบี้ย ยอดขั้นต่ำ และวันครบกำหนดให้อัตโนมัติ
            </p>
          </div>

          <button 
            onClick={loadMockSamples}
            className="btn-secondary text-xs whitespace-nowrap border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            โหลดตัวอย่างรูปใบแจ้งหนี้ 3 รูป
          </button>
        </div>
      </div>

      {/* Multi-Image File Dropzone & Camera Trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Upload Zone */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              1. เลือกไฟล์รูปภาพใบแจ้งหนี้ ( multi-image )
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              เลือกแล้ว {selectedFiles.length} รูป
            </span>
          </div>

          {/* Drag and Drop Zone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-2xl p-8 text-center bg-slate-50/70 transition-all group relative">
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
              id="multiFileInput"
            />
            <div className="space-y-3 pointer-events-none">
              <div className="w-14 h-14 mx-auto rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform shadow-xs">
                <ImageIcon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  ลากและวางรูปภาพใบแจ้งหนี้ที่นี่ หรือ <span className="text-indigo-600 underline">คลิกเพื่อเลือกไฟล์</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  รองรับไฟล์ PNG, JPG, JPEG (กด Shift หรือ Ctrl เพื่อเลือกทีละหลายๆ รูป)
                </p>
              </div>
            </div>
          </div>

          {/* Camera Capture Simulator Button */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setCameraActive(!cameraActive)}
              className="btn-secondary text-xs gap-2 font-semibold"
            >
              <Camera className="w-4 h-4 text-indigo-600" />
              {cameraActive ? 'ปิดกล้องถ่ายรูป' : 'เปิดกล้องถ่ายใบแจ้งหนี้'}
            </button>

            {selectedFiles.length > 0 && (
              <button 
                onClick={() => setSelectedFiles([])}
                className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ล้างไฟล์ทั้งหมด
              </button>
            )}
          </div>

          {/* Camera Simulator Popup */}
          {cameraActive && (
            <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-3 animate-fade-in text-center shadow-lg">
              <div className="h-48 bg-slate-950 rounded-lg flex flex-col items-center justify-center relative overflow-hidden border border-slate-800">
                <Camera className="w-12 h-12 text-indigo-400 mb-2 animate-bounce" />
                <p className="text-xs text-slate-400 font-medium">จำลองกล้องถ่ายรูป (Camera Simulator Viewfinder)</p>
                <div className="absolute inset-4 border border-indigo-400/40 rounded border-dashed pointer-events-none" />
              </div>
              <button
                onClick={() => {
                  const cameraMock = {
                    id: `cam-${Date.now()}`,
                    name: `camera_snapshot_${Date.now()}.jpg`,
                    size: '2.1 MB',
                    previewUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80'
                  };
                  setSelectedFiles(prev => [...prev, cameraMock]);
                  setCameraActive(false);
                }}
                className="btn-gold text-xs w-full justify-center font-bold"
              >
                <Camera className="w-4 h-4" />
                กดถ่ายรูปใบแจ้งหนี้เพื่อเพิ่มในรายการ
              </button>
            </div>
          )}

          {/* Selected File Previews Grid */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-800">รายการรูปภาพที่เลือกไว้เตรียมสแกน:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="relative group bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center gap-3">
                    <img 
                      src={file.previewUrl} 
                      alt={file.name} 
                      className="w-12 h-12 rounded-lg object-cover bg-slate-200 border border-slate-300 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 truncate">{file.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{file.size}</div>
                    </div>
                    <button
                      onClick={() => setSelectedFiles(selectedFiles.filter(f => f.id !== file.id))}
                      className="text-slate-400 hover:text-rose-600 p-1 font-bold"
                      title="ลบออก"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Start Scan Button */}
              <button
                onClick={startScanProcess}
                disabled={isScanning}
                className="btn-gold text-sm w-full justify-center py-3 mt-4 shadow-md font-bold"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    กำลังประมวลผล OCR ({scanProgress}%)...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    เริ่มสแกนอ่านข้อมูลจากรูปภาพทั้งหมด ({selectedFiles.length} รูป)
                  </>
                )}
              </button>
            </div>
          )}

        </div>

        {/* Right Col: Process & Scan Tips */}
        <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scan className="w-5 h-5 text-indigo-600" />
            ข้อแนะนำการสแกน OCR
          </h3>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-indigo-700 block">📷 รูปถ่ายที่ชัดเจน</span>
              <p className="text-slate-600 font-medium">ควรถ่ายรูปใบแจ้งหนี้ให้เห็นหัวกระดาษ ยอดหนี้รวม และอัตราดอกเบี้ยอย่างชัดเจน</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-indigo-700 block">📁 การเลือกหลายไฟล์ (Multi-Image)</span>
              <p className="text-slate-600 font-medium">หากมีใบแจ้งหนี้หลายฉบับ เช่น บัตร 3 ใบ สามารถลากไฟล์เข้ามาพร้อมกันในครั้งเดียวได้เลย</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-indigo-700 block">🔒 ความปลอดภัยข้อมูล</span>
              <p className="text-slate-600 font-medium">ข้อมูลใบแจ้งหนี้ของคุณจะถูกประมวลผลด้วย AI ภายในเครื่องอย่างปลอดภัย</p>
            </div>
          </div>
        </div>

      </div>

      {/* OCR RESULTS SECTION */}
      {scanResults.length > 0 && (
        <div className="bg-white p-6 rounded-2xl space-y-5 animate-fade-in border border-indigo-200 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                ผลการสกัดข้อมูลจาก OCR ({scanResults.length} รายการ)
              </h3>
              <p className="text-xs text-slate-500 font-medium">ตรวจสอบและเลือกรายการที่ต้องการนำเข้าตารางคำนวณหลัก</p>
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={selectedResultIds.length === 0}
              className="btn-gold text-xs shadow-md font-bold"
            >
              นำเข้า {selectedResultIds.length} รายการสู่ตารางคำนวณ
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scanResults.map((item) => {
              const isSelected = selectedResultIds.includes(item.id);
              return (
                <div 
                  key={item.id}
                  onClick={() => toggleSelectResult(item.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                    isSelected 
                      ? 'bg-indigo-50/70 border-indigo-500 shadow-md' 
                      : 'bg-slate-50/50 border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Card Top */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                      <span className="text-xs font-extrabold text-slate-900 truncate max-w-[150px]">{item.data.name}</span>
                    </div>

                    <span className="badge-gold text-[10px]">
                      {(item.data.confidence * 100).toFixed(0)}% Accuracy
                    </span>
                  </div>

                  {/* Card Details */}
                  <div className="space-y-1.5 text-xs pt-2 border-t border-slate-200/60 font-medium">
                    <div className="flex justify-between">
                      <span className="text-slate-500">สถาบันการเงิน:</span>
                      <span className="font-semibold text-slate-800">{item.data.lender}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ยอดหนี้คงเหลือ:</span>
                      <span className="font-extrabold text-indigo-600">{formatCurrency(item.data.balance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">อัตราดอกเบี้ย:</span>
                      <span className="font-bold text-rose-600">{item.data.interestRate}% ต่อปี</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ชำระขั้นต่ำ:</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(item.data.minPayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">วันครบกำหนด:</span>
                      <span className="text-slate-800">{item.data.dueDate}</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
