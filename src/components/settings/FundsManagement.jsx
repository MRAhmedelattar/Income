// src/components/settings/FundsManagement.jsx
import React, { useState } from 'react';
import apiClient from '../../api'; // استيراد API client

export default function FundsManagement({ funds, setFunds }) {
    const [newFundName, setNewFundName] = useState('');
    const [editingFundId, setEditingFundId] = useState(null); // حالة لمعرف الصندوق المُعدل
    const [editingName, setEditingName] = useState(''); // حالة للاسم المُعدل

    // دالة إضافة صندوق جديد
    const handleAddFund = async () => {
        if (newFundName.trim() === '') return;

        const newFund = {
            id: crypto.randomUUID(),
            name: newFundName.trim(),
            orderIndex: funds.length,
        };

        try {
            // إضافة عبر API
            const createdFund = await apiClient.createFund(newFund);
            // تحديث الحالة المحلية
            setFunds(prevFunds => [...prevFunds, createdFund]);
            setNewFundName('');
        } catch (error) {
            console.error('فشل في إضافة الصندوق:', error);
            // في حالة فشل API، يمكن إضافة محليًا كحل مؤقت
            setFunds(prevFunds => [...prevFunds, newFund]);
            setNewFundName('');
        }
    };

    // دالة بدء التعديل
    const handleStartEdit = (fund) => {
        setEditingFundId(fund.id);
        setEditingName(fund.name);
    };

    // دالة حفظ التعديل
    const handleSaveEdit = async () => {
        if (editingName.trim() === '') return;

        try {
            // تحديث عبر API
            const updatedFund = await apiClient.updateFund(editingFundId, { name: editingName.trim() });
            // تحديث الحالة المحلية
            setFunds(prevFunds => prevFunds.map(fund =>
                fund.id === editingFundId ? { ...fund, name: editingName.trim() } : fund
            ));
            setEditingFundId(null);
            setEditingName('');
        } catch (error) {
            console.error('فشل في تحديث الصندوق:', error);
            // في حالة فشل API، تحديث محلي
            setFunds(prevFunds => prevFunds.map(fund =>
                fund.id === editingFundId ? { ...fund, name: editingName.trim() } : fund
            ));
            setEditingFundId(null);
            setEditingName('');
        }
    };

    // دالة إلغاء التعديل
    const handleCancelEdit = () => {
        setEditingFundId(null);
        setEditingName('');
    };

    // دالة حذف صندوق
    const handleDeleteFund = async (id) => {
        try {
            // حذف عبر API
            await apiClient.deleteFund(id);
            // تحديث الحالة المحلية
            setFunds(prevFunds => prevFunds.filter(fund => fund.id !== id));
        } catch (error) {
            console.error('فشل في حذف الصندوق:', error);
            // في حالة فشل API، حذف محلي
            setFunds(prevFunds => prevFunds.filter(fund => fund.id !== id));
        }
    };

    // دالة تحريك الصندوق لأعلى
    const handleMoveUp = async (index) => {
        if (index > 0) {
            const newFunds = [...funds];
            [newFunds[index - 1], newFunds[index]] = [newFunds[index], newFunds[index - 1]];
            // تحديث orderIndex
            newFunds[index - 1].orderIndex = index - 1;
            newFunds[index].orderIndex = index;

            try {
                // تحديث عبر API لكلا الصندوقين
                await apiClient.updateFund(newFunds[index - 1].id, { orderIndex: index - 1 });
                await apiClient.updateFund(newFunds[index].id, { orderIndex: index });
                setFunds(newFunds);
            } catch (error) {
                console.error('فشل في تحديث ترتيب الصناديق:', error);
                setFunds(newFunds); // تحديث محلي في حالة فشل
            }
        }
    };

    // دالة تحريك الصندوق لأسفل
    const handleMoveDown = async (index) => {
        if (index < funds.length - 1) {
            const newFunds = [...funds];
            [newFunds[index], newFunds[index + 1]] = [newFunds[index + 1], newFunds[index]];
            // تحديث orderIndex
            newFunds[index].orderIndex = index;
            newFunds[index + 1].orderIndex = index + 1;

            try {
                // تحديث عبر API لكلا الصندوقين
                await apiClient.updateFund(newFunds[index].id, { orderIndex: index });
                await apiClient.updateFund(newFunds[index + 1].id, { orderIndex: index + 1 });
                setFunds(newFunds);
            } catch (error) {
                console.error('فشل في تحديث ترتيب الصناديق:', error);
                setFunds(newFunds); // تحديث محلي في حالة فشل
            }
        }
    };

    return (
        <div className="space-y-8 animate-slide-in-up">
            <h3 className="text-2xl font-extrabold text-green-600 dark:text-green-400 border-b pb-2">
                إضافة وإدارة الصناديق الخاصة
            </h3>

            {/* نموذج إضافة صندوق جديد */}
            <div className="flex space-x-2 rtl:space-x-reverse bg-surface-light dark:bg-surface-dark p-4 rounded-xl shadow-lg">
                <input
                    type="text"
                    value={newFundName}
                    onChange={(e) => setNewFundName(e.target.value)}
                    placeholder="اسم الصندوق الجديد (مثال: صندوق التنمية)"
                    className="flex-grow px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition duration-150"
                />
                <button
                    onClick={handleAddFund}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-200 shadow-md flex items-center justify-center"
                >
                    + إضافة
                </button>
            </div>

            {/* قائمة الصناديق الموجودة */}
            <div className="space-y-3">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">الصناديق الحالية ({funds.length}):</h4>
                <ul className="bg-white dark:bg-gray-700 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-600">
                    {funds.map((fund, index) => (
                        <li key={fund.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition duration-150">
                            {editingFundId === fund.id ? (
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
                                    <span className="text-gray-800 dark:text-gray-200 font-medium">{fund.name}</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleStartEdit(fund)}
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
                                            disabled={index === funds.length - 1}
                                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="تحريك لأسفل"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFund(fund.id)}
                                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-150"
                                            title="حذف الصندوق"
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
