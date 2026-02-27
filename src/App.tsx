/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  Users, 
  Calendar,
  Search,
  Filter,
  Download,
  X,
  Settings,
  Wand2,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Sparkles,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DutyRecord, Shift, Evaluation, ClassConfig, DayOfWeek, BusyTime } from './types';
import { suggestDutyTasks } from './services/geminiService';

const STORAGE_KEY = 'school_duty_records';
const CLASSES_KEY = 'school_classes_config';

const EVALUATION_COLORS: Record<Evaluation, string> = {
  'Tốt': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Khá': 'bg-blue-100 text-blue-700 border-blue-200',
  'Trung bình': 'bg-amber-100 text-amber-700 border-amber-200',
  'Chưa đạt': 'bg-rose-100 text-rose-700 border-rose-200',
};

const DAYS: DayOfWeek[] = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const SHIFTS: Shift[] = ['Sáng', 'Chiều'];

const INITIAL_CLASSES = [
  '10TN1', '10TN2', '10TN3', '10TN4', '10TN5', '10TN6', 
  '10XH1', '10XH2', '11TN1', '11TN2', '11TN3', '11TN4', 
  '11TN5', '11TN6', '11TN7', '11XH1', '11XH2', '11XH3'
];

export default function App() {
  const [records, setRecords] = useState<DutyRecord[]>([]);
  const [classes, setClasses] = useState<ClassConfig[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DutyRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState<Shift | 'Tất cả'>('Tất cả');

  // Auto-schedule state
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Form state
  const [formData, setFormData] = useState<Omit<DutyRecord, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    shift: 'Sáng',
    className: '',
    mainTask: '',
    supervisor: '',
    evaluation: 'Tốt',
    notes: ''
  });

  // Load data
  useEffect(() => {
    const savedRecords = localStorage.getItem(STORAGE_KEY);
    if (savedRecords) setRecords(JSON.parse(savedRecords));

    const savedClasses = localStorage.getItem(CLASSES_KEY);
    if (savedClasses) {
      setClasses(JSON.parse(savedClasses));
    } else {
      const initial = INITIAL_CLASSES.map(name => ({
        id: crypto.randomUUID(),
        name,
        busyTimes: []
      }));
      setClasses(initial);
      localStorage.setItem(CLASSES_KEY, JSON.stringify(initial));
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
  }, [classes]);

  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiSuggest = async () => {
    if (!formData.className) {
      alert("Vui lòng chọn lớp trước khi yêu cầu gợi ý.");
      return;
    }
    setIsAiLoading(true);
    try {
      const suggestion = await suggestDutyTasks(formData.className, formData.shift);
      setFormData(prev => ({ ...prev, mainTask: suggestion }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      setRecords(records.map(r => r.id === editingRecord.id ? { ...formData, id: r.id } : r));
      setEditingRecord(null);
    } else {
      const newRecord: DutyRecord = {
        ...formData,
        id: crypto.randomUUID()
      };
      setRecords([newRecord, ...records]);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      shift: 'Sáng',
      className: '',
      mainTask: '',
      supervisor: '',
      evaluation: 'Tốt',
      notes: ''
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) {
      setRecords(records.filter(r => r.id !== id));
    }
  };

  const handleEdit = (record: DutyRecord) => {
    setEditingRecord(record);
    setFormData({
      date: record.date,
      shift: record.shift,
      className: record.className,
      mainTask: record.mainTask,
      supervisor: record.supervisor,
      evaluation: record.evaluation,
      notes: record.notes || ''
    });
    setIsModalOpen(true);
  };

  const toggleBusyTime = (classId: string, day: DayOfWeek, shift: Shift) => {
    setClasses(classes.map(c => {
      if (c.id !== classId) return c;
      const isBusy = c.busyTimes.some(bt => bt.day === day && bt.shift === shift);
      if (isBusy) {
        return { ...c, busyTimes: c.busyTimes.filter(bt => !(bt.day === day && bt.shift === shift)) };
      } else {
        return { ...c, busyTimes: [...c.busyTimes, { day, shift }] };
      }
    }));
  };

  const generateSchedule = () => {
    const start = new Date(startDate);
    // Find the next Monday if start is not Monday
    const dayOffset = (8 - start.getDay()) % 7;
    const monday = new Date(start);
    monday.setDate(start.getDate() + (start.getDay() === 1 ? 0 : dayOffset));

    const newRecords: DutyRecord[] = [];
    let classPool = [...classes].sort(() => Math.random() - 0.5);
    let classIndex = 0;

    // We'll try to fill 6 days (Mon-Sat)
    for (let d = 0; d < 6; d++) {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + d);
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayName = DAYS[d];

      for (const shift of SHIFTS) {
        // Find a class that is not busy at this time
        let foundClass = null;
        let attempts = 0;
        
        while (attempts < classPool.length) {
          const candidate = classPool[classIndex % classPool.length];
          const isBusy = candidate.busyTimes.some(bt => bt.day === dayName && bt.shift === shift);
          
          if (!isBusy) {
            foundClass = candidate;
            classIndex++;
            break;
          }
          classIndex++;
          attempts++;
        }

        if (foundClass) {
          newRecords.push({
            id: crypto.randomUUID(),
            date: dateStr,
            shift: shift,
            className: foundClass.name,
            mainTask: shift === 'Sáng' ? 'Trực cổng & Vệ sinh sân trường' : 'Trực hành lang & Kiểm tra lớp',
            supervisor: 'Giáo viên trực tuần',
            evaluation: 'Tốt'
          });
        }
      }
    }

    setRecords([...newRecords, ...records]);
    setIsAutoScheduleOpen(false);
    alert(`Đã tự động xếp ${newRecords.length} lịch trực cho tuần từ ${monday.toLocaleDateString('vi-VN')}`);
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.mainTask.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.supervisor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesShift = filterShift === 'Tất cả' || r.shift === filterShift;
    return matchesSearch && matchesShift;
  });

  const exportToCSV = () => {
    const headers = ['Ngày', 'Buổi', 'Lớp', 'Nhiệm vụ', 'Giám sát', 'Đánh giá'];
    const rows = records.map(r => [r.date, r.shift, r.className, r.mainTask, r.supervisor, r.evaluation]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lich_truc_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white">
                <CheckCircle2 size={28} />
              </div>
              Quản lý Trực Cờ Đỏ & Vệ Sinh
            </h1>
            <p className="text-slate-500 mt-1">Hệ thống theo dõi và đánh giá nề nếp trường học</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Settings size={18} />
              <span>Cấu hình lớp</span>
            </button>
            <button 
              onClick={() => setIsAutoScheduleOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm font-medium"
            >
              <Wand2 size={18} />
              <span>Xếp lịch tự động</span>
            </button>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download size={18} />
              <span>Xuất CSV</span>
            </button>
            <button 
              onClick={() => { resetForm(); setEditingRecord(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 font-medium"
            >
              <Plus size={20} />
              <span>Thêm lịch trực</span>
            </button>
          </div>
        </header>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm lớp, nhiệm vụ, người giám sát..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="text-slate-400" size={18} />
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value as Shift | 'Tất cả')}
            >
              <option value="Tất cả">Tất cả buổi</option>
              <option value="Sáng">Buổi Sáng</option>
              <option value="Chiều">Buổi Chiều</option>
            </select>
          </div>
        </div>

        {/* Data Table - Horizontal Layout */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-bottom border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ngày trực</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Buổi</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lớp trực</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nhiệm vụ chính</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Người giám sát</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Đánh giá</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <motion.tr 
                        key={record.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-slate-700 font-medium">
                            <Calendar size={16} className="text-slate-400" />
                            {new Date(record.date).toLocaleDateString('vi-VN')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            record.shift === 'Sáng' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <Clock size={12} />
                            {record.shift}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <Users size={16} className="text-indigo-500" />
                            {record.className}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-600 line-clamp-1 max-w-xs">{record.mainTask}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-slate-700">
                            <User size={16} className="text-slate-400" />
                            {record.supervisor}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${EVALUATION_COLORS[record.evaluation]}`}>
                            {record.evaluation}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEdit(record)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(record.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={40} className="text-slate-200" />
                          <p>Không tìm thấy bản ghi nào</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Settings Modal - Class Management */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Cấu hình lớp & Lịch bận</h2>
                  <p className="text-sm text-slate-500">Đánh dấu những buổi lớp bận học trái buổi (không thể trực)</p>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 gap-8">
                  {classes.map((cls) => (
                    <div key={cls.id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-indigo-600 text-lg flex items-center gap-2">
                          <Users size={20} />
                          Lớp {cls.name}
                        </h3>
                        <span className="text-xs text-slate-400 italic">Chọn buổi bận học</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {DAYS.map(day => (
                          <div key={day} className="space-y-2">
                            <p className="text-xs font-bold text-slate-500 text-center">{day}</p>
                            <div className="flex flex-col gap-1">
                              {SHIFTS.map(shift => {
                                const isBusy = cls.busyTimes.some(bt => bt.day === day && bt.shift === shift);
                                return (
                                  <button
                                    key={shift}
                                    onClick={() => toggleBusyTime(cls.id, day, shift)}
                                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all border ${
                                      isBusy 
                                        ? 'bg-rose-100 border-rose-200 text-rose-600' 
                                        : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-200'
                                    }`}
                                  >
                                    {shift} {isBusy ? '(Bận)' : ''}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold"
                >
                  Hoàn tất cấu hình
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auto Schedule Modal */}
      <AnimatePresence>
        {isAutoScheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Wand2 size={24} className="text-indigo-600" />
                  Xếp lịch tự động
                </h2>
                <button 
                  onClick={() => setIsAutoScheduleOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Chọn ngày bắt đầu tuần trực</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <p className="text-xs text-slate-400 italic">Hệ thống sẽ tự động bắt đầu từ Thứ 2 của tuần chứa ngày này.</p>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                  <AlertCircle className="text-amber-500 shrink-0" size={20} />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Hệ thống sẽ tự động chọn các lớp không bận học để xếp vào 12 ca trực (Sáng/Chiều từ T2-T7). Các lớp sẽ được xoay vòng công bằng.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setIsAutoScheduleOpen(false)}
                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-medium"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={generateSchedule}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold"
                  >
                    Bắt đầu xếp lịch
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Form (Manual Add/Edit) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingRecord ? 'Cập nhật lịch trực' : 'Thêm lịch trực mới'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddOrUpdate} className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Ngày trực</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>

                  {/* Shift */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Buổi trực</label>
                    <div className="flex gap-2">
                      {(['Sáng', 'Chiều'] as Shift[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({ ...formData, shift: s })}
                          className={`flex-1 py-2.5 rounded-xl border transition-all font-medium ${
                            formData.shift === s 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Class */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Lớp trực</label>
                    <select 
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={formData.className}
                      onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    >
                      <option value="">Chọn lớp...</option>
                      {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      <option value="Khác">Khác...</option>
                    </select>
                  </div>

                  {/* Supervisor */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Người giám sát</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Tên giáo viên hoặc học sinh"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={formData.supervisor}
                      onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                    />
                  </div>

                  {/* Main Task */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700">Nhiệm vụ chính</label>
                      <button
                        type="button"
                        onClick={handleAiSuggest}
                        disabled={isAiLoading}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {isAiLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        Gợi ý bằng AI
                      </button>
                    </div>
                    <textarea 
                      required
                      rows={2}
                      placeholder="VD: Trực cổng trường, kiểm tra vệ sinh hành lang..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                      value={formData.mainTask}
                      onChange={(e) => setFormData({ ...formData, mainTask: e.target.value })}
                    />
                  </div>

                  {/* Evaluation */}
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Đánh giá kết quả</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(['Tốt', 'Khá', 'Trung bình', 'Chưa đạt'] as Evaluation[]).map((ev) => (
                        <button
                          key={ev}
                          type="button"
                          onClick={() => setFormData({ ...formData, evaluation: ev })}
                          className={`py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                            formData.evaluation === ev 
                              ? EVALUATION_COLORS[ev] + ' shadow-sm'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {ev}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-medium"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold"
                  >
                    {editingRecord ? 'Lưu thay đổi' : 'Thêm bản ghi'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
