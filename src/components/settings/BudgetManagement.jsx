// src/components/settings/BudgetManagement.jsx
import React, { useState } from 'react';
import apiClient from '../../api'; // استيراد API client

export default function BudgetManagement({ budgetItems, setBudgetItems }) {
    const [newBudgetItemName, setNewBudgetItemName] = useState('');
    const [isEditableInSettings, setIsEditableInSettings] = useState(false);
    const [editingBudgetItemId, setEditingBudgetItemId] = useState(null); // حالة لمعرف البند المُعدل
    const [editingName, setEditingName] = useState(''); // حالة للاسم المُعدل

    // دالة إضافة بند موازنة جديد
    const handleAddBudgetItem = async () => {
        if (newBudgetItemName.trim() === '') return;

        const newBudgetItem = {
            id: crypto.randomUUID(),
            name: newBudgetItemName.trim(),
            isEditableInSettings: isEditableInSettings,
            orderIndex: budgetItems.length,
        };

        try {
            // إضافة عبر API
            const createdBudgetItem = await apiClient.createBudgetItem(newBudgetItem);
            // تحديث الحالة المحلية
            setBudgetItems(prevBudgetItems => [...prevBudgetItems, createdBudgetItem]);
            setNewBudgetItemName('');
            setIsEditableInSettings(false);
        } catch (error) {
            console.error('فشل في إضافة البند:', error);
            // في حالة فشل API، يمكن إضافة محليًا كحل مؤقت
            setBudgetItems(prevBudgetItems => [...prevBudgetItems, newBudgetItem]);
            setNewBudgetItemName('');
            setIsEditableInSettings(false);
        }
    };

    // دالة بدء التعديل
    const handleStartEdit = (budgetItem) => {
        setEditingBudgetItemId(budgetItem.id);
        setEditingName(budgetItem.name);
    };

    // دالة حفظ التعديل
    const handleSaveEdit = async () => {
        if (editingName.trim() === '') return;

        try {
            // تحديث عبر API
            const updatedBudgetItem = await apiClient.updateBudgetItem(editingBudgetItemId, { name: editingName.trim() });
            // تحديث الحالة المحلية
            setBudgetItems(prevBudgetItems => prevBudgetItems.map(budgetItem =>
                budgetItem.id === editingBudgetItemId ? { ...budgetItem, name: editingName.trim() } : budgetItem
            ));
            setEditingBudgetItemId(null);
            setEditingName('');
        } catch (error) {
            console.error('فشل في تحديث البند:', error);
            // في حالة فشل API، تحديث محلي
            setBudgetItems(prevBudgetItems => prevBudgetItems.map(budgetItem =>
                budgetItem.id === editingBudgetItemId ? { ...budgetItem, name: editingName.trim() } : budgetItem
            ));
            setEditingBudgetItemId(null);
            setEditingName('');
        }
    };

    // دالة إلغاء التعديل
    const handleCancelEdit = () => {
        setEditingBudgetItemId(null);
        setEditingName('');
    };

    // دالة حذف بند موازنة
    const handleDeleteBudgetItem = async (id) => {
        try {
            // حذف عبر API
            await apiClient.deleteBudgetItem(id);
            // تحديث الحالة المحلية
            setBudgetItems(prevBudgetItems => prevBudgetItems.filter(budgetItem => budgetItem.id !== id));
        } catch (error) {
            console.error('فشل في حذف البند:', error);
            // في حالة فشل API، حذف محلي
            setBudgetItems(prevBudgetItems => prevBudgetItems.filter(budgetItem => budgetItem.id !== id));
        }
    };

    // دالة تحريك البند لأعلى
    const handleMoveUp = async (index) => {
        if (index > 0) {
            const newBudgetItems = [...budgetItems];
            [newBudgetItems[index - 1], newBudgetItems[index]] = [newBudgetItems[index], newBudgetItems[index - 1]];
            // تحديث orderIndex
            newBudgetItems[index - 1].orderIndex = index - 1;
            newBudgetItems[index].orderIndex = index;

            try {
                // تحديث عبر API لكلا البندين
                await apiClient.updateBudgetItem(newBudgetItems[index - 1].id, { orderIndex: index - 1 });
                await apiClient.updateBudgetItem(newBudgetItems[index].id, { orderIndex: index });
                setBudgetItems(newBudgetItems);
            } catch (error) {
                console.error('فشل في تحديث ترتيب البنود:', error);
                setBudgetItems(newBudgetItems); // تحديث محلي في حالة فشل
            }
        }
    };

    // دالة تحريك البند لأسفل
    const handleMoveDown = async (index) => {
        if (index < budgetItems.length - 1) {
            const newBudgetItems = [...budgetItems];
            [newBudgetItems[index], newBudgetItems[index + 1]] = [newBudgetItems[index + 1], newBudgetItems[index]];
            // تحديث orderIndex
            newBudgetItems[index].orderIndex = index;
            newBudgetItems[index + 1].orderIndex = index + 1;

            try {
                // تحديث عبر API لكلا البندين
                await apiClient.updateBudgetItem(newBudgetItems[index].id, { orderIndex: index });
                await apiClient.updateBudgetItem(newBudgetItems[index + 1].id, { orderIndex: index + 1 });
                setBudgetItems(newBudgetItems);
            } catch (error) {
                console.error('فشل في تحديث ترتيب البنود:', error);
                setBudgetItems(newBudgetItems); // تحديث محلي في حالة فشل
            }
        }
    };

    return (
        <div className="space-y-8 animate-slide-in-up">
            <h3 className="text-2xl font-extrabold text-green-600 dark:text-green-400 border-b pb-2">
                إضافة وإدارة بنود الموازنة
            </h3>

            {/* نموذج إضافة بند موازنة جديد */}
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg space-y-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">إضافة بند موازنة جديد</h4>

                {/* حقل اسم البند */}
                <div>
                    <label htmlFor="budgetItemName" className="block text-sm font-medium mb-1">اسم البند</label>
                    <input
                        type="text"
                        id="budgetItemName"
                        value={newBudgetItemName}
                        onChange={(e) => setNewBudgetItemName(e.target.value)}
                        placeholder="اسم البند الجديد (مثال: بند الرواتب)"
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-green-500"
                    />
                </div>

                {/* خيار قابل للتحرير في الإعدادات */}
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="isEditableInSettings"
                        checked={isEditableInSettings}
                        onChange={(e) => setIsEditableInSettings(e.target.checked)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label htmlFor="isEditableInSettings" className="ml-2 text-sm">قابل للتحرير في قسم إعدادات النظام</label>
                </div>

                <button
                    onClick={handleAddBudgetItem}
                    className="w-full bg-green-600 text-white px-4 py-2 mt-4 rounded-lg font-semibold hover:bg-green-700 transition duration-200 shadow-md flex items-center justify-center"
                >
                    + إضافة بند موازنة
                </button>
            </div>

            {/* قائمة البنود الموجودة */}
            <div className="space-y-3">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">البنود الحالية ({budgetItems.length}):</h4>
                <ul className="bg-white dark:bg-gray-700 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-600">
                    {budgetItems.map((budgetItem, index) => (
                        <li key={budgetItem.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition duration-150">
                            {editingBudgetItemId === budgetItem.id ? (
                                // وضع التعديل
                                <div className="flex items-center gap-2 flex-grow">
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        className="flex-grow px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition duration-150"
                                        autoFocus
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
                                    <div className="flex items-center gap-2">
                                        {budgetItem.isEditableInSettings && (
                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">قابل للتحرير</span>
                                        )}
                                        <span className="text-gray-800 dark:text-gray-200 font-medium">{budgetItem.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleStartEdit(budgetItem)}
                                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150"
                                            title="تعديل الاسم"
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
                                            disabled={index === budgetItems.length - 1}
                                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="تحريك لأسفل"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBudgetItem(budgetItem.id)}
                                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-150"
                                            title="حذف البند"
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
