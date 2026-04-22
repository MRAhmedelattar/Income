// src/components/settings/BudgetDeductionsManagement.jsx
import React, { useState } from 'react';
import apiClient from '../../api'; // استيراد API client

export default function BudgetDeductionsManagement({ budgetDeductions, setBudgetDeductions }) {
    const [newBudgetDeductionName, setNewBudgetDeductionName] = useState('');
    const [newBudgetDeductionPercentage, setNewBudgetDeductionPercentage] = useState('');
    const [editingBudgetDeductionId, setEditingBudgetDeductionId] = useState(null); // حالة لمعرف الاستقطاع المُعدل
    const [editingName, setEditingName] = useState(''); // حالة للاسم المُعدل
    const [editingPercentage, setEditingPercentage] = useState(''); // حالة للنسبة المُعدلة

    // دالة إضافة استقطاع موازنة جديد
    const handleAddBudgetDeduction = async () => {
        if (newBudgetDeductionName.trim() === '' || newBudgetDeductionPercentage === '') return;

        const percentage = parseFloat(newBudgetDeductionPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) return;

        const newBudgetDeduction = {
            id: crypto.randomUUID(),
            name: newBudgetDeductionName.trim(),
            percentage: percentage,
            orderIndex: budgetDeductions.length,
        };

        try {
            // إضافة عبر API
            const createdBudgetDeduction = await apiClient.createBudgetDeduction(newBudgetDeduction);
            // تحديث الحالة المحلية
            setBudgetDeductions(prevBudgetDeductions => [...prevBudgetDeductions, createdBudgetDeduction]);
            setNewBudgetDeductionName('');
            setNewBudgetDeductionPercentage('');
        } catch (error) {
            console.error('فشل في إضافة الاستقطاع:', error);
            // في حالة فشل API، يمكن إضافة محليًا كحل مؤقت
            setBudgetDeductions(prevBudgetDeductions => [...prevBudgetDeductions, newBudgetDeduction]);
            setNewBudgetDeductionName('');
            setNewBudgetDeductionPercentage('');
        }
    };

    // دالة بدء التعديل
    const handleStartEdit = (budgetDeduction) => {
        setEditingBudgetDeductionId(budgetDeduction.id);
        setEditingName(budgetDeduction.name);
        setEditingPercentage(budgetDeduction.percentage.toString());
    };

    // دالة حفظ التعديل
    const handleSaveEdit = async () => {
        if (editingName.trim() === '' || editingPercentage === '') return;

        const percentage = parseFloat(editingPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) return;

        try {
            // تحديث عبر API
            const updatedBudgetDeduction = await apiClient.updateBudgetDeduction(editingBudgetDeductionId, {
                name: editingName.trim(),
                percentage: percentage
            });
            // تحديث الحالة المحلية
            setBudgetDeductions(prevBudgetDeductions => prevBudgetDeductions.map(budgetDeduction =>
                budgetDeduction.id === editingBudgetDeductionId ? {
                    ...budgetDeduction,
                    name: editingName.trim(),
                    percentage: percentage
                } : budgetDeduction
            ));
            setEditingBudgetDeductionId(null);
            setEditingName('');
            setEditingPercentage('');
        } catch (error) {
            console.error('فشل في تحديث الاستقطاع:', error);
            // في حالة فشل API، تحديث محلي
            setBudgetDeductions(prevBudgetDeductions => prevBudgetDeductions.map(budgetDeduction =>
                budgetDeduction.id === editingBudgetDeductionId ? {
                    ...budgetDeduction,
                    name: editingName.trim(),
                    percentage: percentage
                } : budgetDeduction
            ));
            setEditingBudgetDeductionId(null);
            setEditingName('');
            setEditingPercentage('');
        }
    };

    // دالة إلغاء التعديل
    const handleCancelEdit = () => {
        setEditingBudgetDeductionId(null);
        setEditingName('');
        setEditingPercentage('');
    };

    // دالة حذف استقطاع موازنة
    const handleDeleteBudgetDeduction = async (id) => {
        try {
            // حذف عبر API
            await apiClient.deleteBudgetDeduction(id);
            // تحديث الحالة المحلية
            setBudgetDeductions(prevBudgetDeductions => prevBudgetDeductions.filter(budgetDeduction => budgetDeduction.id !== id));
        } catch (error) {
            console.error('فشل في حذف الاستقطاع:', error);
            // في حالة فشل API، حذف محلي
            setBudgetDeductions(prevBudgetDeductions => prevBudgetDeductions.filter(budgetDeduction => budgetDeduction.id !== id));
        }
    };

    // دالة تحريك الاستقطاع لأعلى
    const handleMoveUp = async (index) => {
        if (index > 0) {
            const newBudgetDeductions = [...budgetDeductions];
            [newBudgetDeductions[index - 1], newBudgetDeductions[index]] = [newBudgetDeductions[index], newBudgetDeductions[index - 1]];
            // تحديث orderIndex
            newBudgetDeductions[index - 1].orderIndex = index - 1;
            newBudgetDeductions[index].orderIndex = index;

            try {
                // تحديث عبر API لكلا الاستقطاعين
                await apiClient.updateBudgetDeduction(newBudgetDeductions[index - 1].id, { orderIndex: index - 1 });
                await apiClient.updateBudgetDeduction(newBudgetDeductions[index].id, { orderIndex: index });
                setBudgetDeductions(newBudgetDeductions);
            } catch (error) {
                console.error('فشل في تحديث ترتيب الاستقطاعات:', error);
                setBudgetDeductions(newBudgetDeductions); // تحديث محلي في حالة فشل
            }
        }
    };

    // دالة تحريك الاستقطاع لأسفل
    const handleMoveDown = async (index) => {
        if (index < budgetDeductions.length - 1) {
            const newBudgetDeductions = [...budgetDeductions];
            [newBudgetDeductions[index], newBudgetDeductions[index + 1]] = [newBudgetDeductions[index + 1], newBudgetDeductions[index]];
            // تحديث orderIndex
            newBudgetDeductions[index].orderIndex = index;
            newBudgetDeductions[index + 1].orderIndex = index + 1;

            try {
                // تحديث عبر API لكلا الاستقطاعين
                await apiClient.updateBudgetDeduction(newBudgetDeductions[index].id, { orderIndex: index });
                await apiClient.updateBudgetDeduction(newBudgetDeductions[index + 1].id, { orderIndex: index + 1 });
                setBudgetDeductions(newBudgetDeductions);
            } catch (error) {
                console.error('فشل في تحديث ترتيب الاستقطاعات:', error);
                setBudgetDeductions(newBudgetDeductions); // تحديث محلي في حالة فشل
            }
        }
    };

    return (
        <div className="space-y-8 animate-slide-in-up">
            <h3 className="text-2xl font-extrabold text-green-600 dark:text-green-400 border-b pb-2">
                إضافة ابواب موازنة
            </h3>

            {/* نموذج إضافة استقطاع موازنة جديد */}
            <div className="flex space-x-2 rtl:space-x-reverse bg-surface-light dark:bg-surface-dark p-4 rounded-xl shadow-lg">
                <input
                    type="text"
                    value={newBudgetDeductionName}
                    onChange={(e) => setNewBudgetDeductionName(e.target.value)}
                    placeholder="اسم الباب الجديد (مثال: باب أول)"
                    className="flex-grow px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition duration-150"
                />
                <input
                    type="number"
                    value={newBudgetDeductionPercentage}
                    onChange={(e) => setNewBudgetDeductionPercentage(e.target.value)}
                    placeholder="النسبة (%)"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-24 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition duration-150"
                />
                <button
                    onClick={handleAddBudgetDeduction}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-200 shadow-md flex items-center justify-center"
                >
                    + إضافة
                </button>
            </div>

            {/* قائمة الاستقطاعات الموجودة */}
            <div className="space-y-3">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">الابواب الحالية ({budgetDeductions.length}):</h4>
                <ul className="bg-white dark:bg-gray-700 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-600">
                    {budgetDeductions.map((budgetDeduction, index) => (
                        <li key={budgetDeduction.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition duration-150">
                            {editingBudgetDeductionId === budgetDeduction.id ? (
                                // وضع التعديل
                                <div className="flex items-center gap-2 flex-grow">
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        className="flex-grow px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition duration-150"
                                        autoFocus
                                    />
                                    <input
                                        type="number"
                                        value={editingPercentage}
                                        onChange={(e) => setEditingPercentage(e.target.value)}
                                        placeholder="النسبة (%)"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        className="w-20 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition duration-150"
                                    />
                                    <button
                                        onClick={handleSaveEdit}
                                        className="bg-blue-600 text-white px-3 py-1 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-md text-sm"
                                    >
                                        حفظ
                                    </button>
                                    <button
                                        onClick={handleCancelEdit}
                                        className="bg-gray-500 text-white px-3 py-1 rounded-lg font-semibold hover:bg-gray-600 transition duration-200 shadow-md text-sm"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            ) : (
                                // العرض العادي
                                <>
                                    <div className="flex flex-col">
                                        <span className="text-gray-800 dark:text-gray-200 font-medium">{budgetDeduction.name}</span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">نسبة: {budgetDeduction.percentage}%</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleStartEdit(budgetDeduction)}
                                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150"
                                            title="تعديل الاستقطاع"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleMoveUp(index)}
                                            disabled={index === 0}
                                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="تحريك لأعلى"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleMoveDown(index)}
                                            disabled={index === budgetDeductions.length - 1}
                                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="تحريك لأسفل"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBudgetDeduction(budgetDeduction.id)}
                                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-150"
                                            title="حذف الاستقطاع"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
