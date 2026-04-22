import React, { useState } from 'react';
import apiClient from '../../api'; // استيراد API client

/**
 * مكون إدارة الاستقطاعات
 */
const DeductionsManagement = ({ deductions, setDeductions }) => {
  const [newDeduction, setNewDeduction] = useState({
    name: '',
    percentage: '',
  });

  const [editingDeduction, setEditingDeduction] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // دالة لتحديث حقل في النموذج
  const handleInputChange = (field, value) => {
    setNewDeduction(prev => ({ ...prev, [field]: value }));
  };

  // دالة لإضافة استقطاع جديد
  const handleAddDeduction = async () => {
    if (!newDeduction.name || !newDeduction.percentage) {
      alert('يرجى ملء جميع الحقول');
      return;
    }

    const percentage = parseFloat(newDeduction.percentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      alert('النسبة المئوية يجب أن تكون رقمًا بين 0 و 100');
      return;
    }

    const deductionToAdd = {
      id: crypto.randomUUID(),
      ...newDeduction,
      percentage,
      orderIndex: deductions.length,
    };

    try {
      const createdDeduction = await apiClient.createDeduction(deductionToAdd);
      setDeductions(prev => [...prev, createdDeduction]);
    } catch (error) {
      console.error('فشل في إضافة الاستقطاع:', error);
      // إضافة محلي في حالة فشل
      setDeductions(prev => [...prev, deductionToAdd]);
    }

    // إعادة تعيين النموذج
    setNewDeduction({
      name: '',
      percentage: '',
    });
  };

  // دالة لتعديل استقطاع
  const handleEditDeduction = (deduction) => {
    setEditingDeduction(deduction);
    setIsEditing(true);
    setNewDeduction({
      name: deduction.name,
      percentage: deduction.percentage.toString(),
    });
  };

  // دالة لتحديث استقطاع
  const handleUpdateDeduction = async () => {
    if (!newDeduction.name || !newDeduction.percentage) {
      alert('يرجى ملء جميع الحقول');
      return;
    }

    const percentage = parseFloat(newDeduction.percentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      alert('النسبة المئوية يجب أن تكون رقمًا بين 0 و 100');
      return;
    }

    const updatedDeduction = {
      ...editingDeduction,
      ...newDeduction,
      percentage,
    };

    try {
      const result = await apiClient.updateDeduction(editingDeduction.id, updatedDeduction);
      setDeductions(prev =>
        prev.map(ded => ded.id === editingDeduction.id ? result : ded)
      );
    } catch (error) {
      console.error('فشل في تحديث الاستقطاع:', error);
      // تحديث محلي في حالة فشل
      setDeductions(prev =>
        prev.map(ded => ded.id === editingDeduction.id ? updatedDeduction : ded)
      );
    }

    // إعادة تعيين الحالة
    setIsEditing(false);
    setEditingDeduction(null);
    setNewDeduction({
      name: '',
      percentage: '',
    });
  };

  // دالة لحذف استقطاع
  const handleDeleteDeduction = async (deductionId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الاستقطاع؟')) {
      try {
        await apiClient.deleteDeduction(deductionId);
        setDeductions(prev => prev.filter(ded => ded.id !== deductionId));
      } catch (error) {
        console.error('فشل في حذف الاستقطاع:', error);
        // حذف محلي في حالة فشل
        setDeductions(prev => prev.filter(ded => ded.id !== deductionId));
      }
    }
  };

  // دالة لإلغاء التعديل
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingDeduction(null);
    setNewDeduction({
      name: '',
      percentage: '',
    });
  };

  // دالة لتحريك الاستقطاع لأعلى
  const moveDeductionUp = async (index) => {
    if (index === 0) return;

    const newDeductions = [...deductions];
    [newDeductions[index - 1], newDeductions[index]] = [newDeductions[index], newDeductions[index - 1]];

    // تحديث الترتيب
    newDeductions.forEach((ded, i) => {
      ded.orderIndex = i;
    });

    try {
      // تحديث عبر API لكلا الاستقطاعين
      await apiClient.updateDeduction(newDeductions[index - 1].id, { orderIndex: index - 1 });
      await apiClient.updateDeduction(newDeductions[index].id, { orderIndex: index });
      setDeductions(newDeductions);
    } catch (error) {
      console.error('فشل في تحديث ترتيب الاستقطاعات:', error);
      setDeductions(newDeductions); // تحديث محلي في حالة فشل
    }
  };

  // دالة لتحريك الاستقطاع لأسفل
  const moveDeductionDown = async (index) => {
    if (index === deductions.length - 1) return;

    const newDeductions = [...deductions];
    [newDeductions[index], newDeductions[index + 1]] = [newDeductions[index + 1], newDeductions[index]];

    // تحديث الترتيب
    newDeductions.forEach((ded, i) => {
      ded.orderIndex = i;
    });

    try {
      // تحديث عبر API لكلا الاستقطاعين
      await apiClient.updateDeduction(newDeductions[index].id, { orderIndex: index });
      await apiClient.updateDeduction(newDeductions[index + 1].id, { orderIndex: index + 1 });
      setDeductions(newDeductions);
    } catch (error) {
      console.error('فشل في تحديث ترتيب الاستقطاعات:', error);
      setDeductions(newDeductions); // تحديث محلي في حالة فشل
    }
  };

  // فرز الاستقطاعات حسب الترتيب
  const sortedDeductions = [...deductions].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return (
    <div className="space-y-8 animate-slide-in-up">
      <h3 className="text-2xl font-extrabold text-gray-600 dark:text-gray-400 border-b pb-2">
        إدارة الاستقطاعات
      </h3>

      {/* نموذج إضافة/تعديل الاستقطاع */}
      <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg space-y-4 border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">
          {isEditing ? 'تعديل الاستقطاع' : 'إضافة استقطاع جديد'}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              اسم البند
            </label>
            <input
              type="text"
              value={newDeduction.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-gray-500 focus:border-gray-500"
              placeholder="أدخل اسم البند"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              النسبة المئوية (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={newDeduction.percentage}
              onChange={(e) => handleInputChange('percentage', e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-gray-500 focus:border-gray-500"
              placeholder="أدخل النسبة المئوية"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleUpdateDeduction}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-md"
              >
                تحديث الاستقطاع
              </button>
              <button
                onClick={handleCancelEdit}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition duration-200 shadow-md"
              >
                إلغاء
              </button>
            </>
          ) : (
            <button
              onClick={handleAddDeduction}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-200 shadow-md"
            >
              إضافة استقطاع
            </button>
          )}
        </div>
      </div>

      {/* قائمة الاستقطاعات الحالية */}
      <div className="space-y-3 pt-4">
        <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">الاستقطاعات الحالية ({sortedDeductions.length}):</h4>
        <ul className="bg-white dark:bg-gray-700 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-600">
          {sortedDeductions.map((deduction, index) => (
            <li key={deduction.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition duration-150">
              <div className="flex flex-col">
                <span className="font-medium text-gray-800 dark:text-gray-200">{deduction.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  النسبة المئوية: {deduction.percentage}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => moveDeductionUp(index)}
                  disabled={index === 0}
                  className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="تحريك لأعلى"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                  </svg>
                </button>
                <button
                  onClick={() => moveDeductionDown(index)}
                  disabled={index === sortedDeductions.length - 1}
                  className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="تحريك لأسفل"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                <button
                  onClick={() => handleEditDeduction(deduction)}
                  className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150"
                  title="تعديل الاستقطاع"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteDeduction(deduction.id)}
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-150"
                  title="حذف الاستقطاع"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default DeductionsManagement;
