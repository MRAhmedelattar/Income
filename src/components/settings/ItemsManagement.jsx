// src/components/settings/ItemsManagement.jsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../api'; // استيراد API client

export default function ItemsManagement({ items, setItems, funds, budgetItems }) {
    // حالة النموذج الجديد
    const [newItem, setNewItem] = useState({
        name: '',
        isEditable: false,
        isEditableInSettings: false,
        type: 'budget', // 'budget' or 'fund'
        fundId: null,
        budgetItemId: null,
    });

    // تحديث budgetItemId عند تغيير budgetItems
    useEffect(() => {
        if (newItem.type === 'budget' && budgetItems.length > 0 && !newItem.budgetItemId) {
            setNewItem(prev => ({ ...prev, budgetItemId: budgetItems[0].id }));
        }
    }, [budgetItems, newItem.type, newItem.budgetItemId]);

    // تحديث fundId عند تغيير funds
    useEffect(() => {
        if (newItem.type === 'fund' && funds.length > 0 && !newItem.fundId) {
            setNewItem(prev => ({ ...prev, fundId: funds[0].id }));
        }
    }, [funds, newItem.type, newItem.fundId]);

    // حالات التعديل
    const [editingItemId, setEditingItemId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [editingType, setEditingType] = useState('budget');
    const [editingFundId, setEditingFundId] = useState(null);
    const [editingBudgetItemId, setEditingBudgetItemId] = useState(null);
    const [editingIsEditable, setEditingIsEditable] = useState(false);

    // دالة تحديث الحقل
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewItem(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
            // إعادة تعيين fundId و budgetItemId عند تغيير النوع
            ...(name === 'type' && value === 'budget' && { fundId: null, budgetItemId: (budgetItems.length > 0 ? budgetItems[0].id : null) }),
            ...(name === 'type' && value === 'fund' && { budgetItemId: null, fundId: (funds.length > 0 ? funds[0].id : null) }),
        }));
    };

    // دالة إضافة البند
    const handleAddItem = async () => {
        if (!newItem.name || (newItem.type === 'fund' && !newItem.fundId) || (newItem.type === 'budget' && !newItem.budgetItemId)) {
            alert("الرجاء ملء جميع الحقول المطلوبة.");
            return;
        }

        const itemToAdd = {
            id: crypto.randomUUID(),
            name: newItem.name.trim(),
            defaultValue: 0, // لا توجد قيمة افتراضية
            isEditable: newItem.isEditable,
            isEditableInSettings: newItem.isEditableInSettings || false,
            type: newItem.type,
            fundId: newItem.type === 'fund' ? newItem.fundId : null,
            budgetItemId: newItem.type === 'budget' ? newItem.budgetItemId : null,
            orderIndex: items.length,
        };

        try {
            // إضافة عبر API
            const createdItem = await apiClient.createItem(itemToAdd);
            // تحديث الحالة المحلية
            setItems(prevItems => [...prevItems, createdItem]);
            setNewItem({
                name: '',
                isEditable: false,
                isEditableInSettings: false,
                type: 'budget',
                fundId: null,
                budgetItemId: null,
            });
        } catch (error) {
            console.error('فشل في إضافة البند:', error);
            // في حالة فشل API، إضافة محلي
            setItems(prevItems => [...prevItems, itemToAdd]);
            setNewItem({
                name: '',
                isEditable: false,
                isEditableInSettings: false,
                type: 'budget',
                fundId: null,
                budgetItemId: null,
            });
        }
    };

    // دالة حذف البند
    const handleDeleteItem = async (id) => {
        try {
            // حذف عبر API
            await apiClient.deleteItem(id);
            // تحديث الحالة المحلية
            setItems(prevItems => prevItems.filter(item => item.id !== id));
        } catch (error) {
            console.error('فشل في حذف البند:', error);
            // في حالة فشل API، حذف محلي
            setItems(prevItems => prevItems.filter(item => item.id !== id));
        }
    };

    // دالة تحريك البند لأعلى
    const handleMoveUp = async (index) => {
        if (index > 0) {
            const newItems = [...items];
            [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
            // تحديث orderIndex
            newItems[index - 1].orderIndex = index - 1;
            newItems[index].orderIndex = index;

            try {
                // تحديث عبر API لكلا البندين
                await apiClient.updateItem(newItems[index - 1].id, { orderIndex: index - 1 });
                await apiClient.updateItem(newItems[index].id, { orderIndex: index });
                setItems(newItems);
            } catch (error) {
                console.error('فشل في تحديث ترتيب البنود:', error);
                setItems(newItems); // تحديث محلي في حالة فشل
            }
        }
    };

    // دالة تحريك البند لأسفل
    const handleMoveDown = async (index) => {
        if (index < items.length - 1) {
            const newItems = [...items];
            [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
            // تحديث orderIndex
            newItems[index].orderIndex = index;
            newItems[index + 1].orderIndex = index + 1;

            try {
                // تحديث عبر API لكلا البندين
                await apiClient.updateItem(newItems[index].id, { orderIndex: index });
                await apiClient.updateItem(newItems[index + 1].id, { orderIndex: index + 1 });
                setItems(newItems);
            } catch (error) {
                console.error('فشل في تحديث ترتيب البنود:', error);
                setItems(newItems); // تحديث محلي في حالة فشل
            }
        }
    };

    // دالة بدء التعديل
    const handleStartEdit = (item) => {
        setEditingItemId(item.id);
        setEditingName(item.name);
        setEditingType(item.type);
        setEditingFundId(item.fundId);
        setEditingBudgetItemId(item.budgetItemId);
        setEditingIsEditable(item.isEditable);
    };

    // دالة حفظ التعديل
    const handleSaveEdit = async () => {
        if (editingName.trim() === '') return;

        const updateData = {
            name: editingName.trim(),
            type: editingType,
            fundId: editingType === 'fund' ? editingFundId : null,
            budgetItemId: editingType === 'budget' ? editingBudgetItemId : null,
            isEditable: editingIsEditable,
        };

        try {
            // تحديث عبر API
            const updatedItem = await apiClient.updateItem(editingItemId, updateData);
            // تحديث الحالة المحلية
            setItems(prevItems => prevItems.map(item =>
                item.id === editingItemId ? { ...item, ...updateData } : item
            ));
            setEditingItemId(null);
            setEditingName('');
            setEditingType('budget');
            setEditingFundId(null);
            setEditingBudgetItemId(null);
        } catch (error) {
            console.error('فشل في تحديث البند:', error);
            // في حالة فشل API، تحديث محلي
            setItems(prevItems => prevItems.map(item =>
                item.id === editingItemId ? { ...item, ...updateData } : item
            ));
            setEditingItemId(null);
            setEditingName('');
            setEditingType('budget');
            setEditingFundId(null);
            setEditingBudgetItemId(null);
        }
    };

    // دالة إلغاء التعديل
    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditingName('');
        setEditingType('budget');
        setEditingFundId(null);
        setEditingBudgetItemId(null);
    };

    // دالة مساعدة للحصول على اسم الصندوق
    const getFundName = (fundId) => {
        const fund = funds.find(f => f.id === fundId);
        return fund ? fund.name : 'صندوق محذوف';
    };

    return (
        <div className="space-y-8 animate-slide-in-up">
            <h3 className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 border-b pb-2">
                إدارة بنود التحصيل والرسوم
            </h3>

            {/* نموذج إضافة بند جديد */}
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg space-y-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">إضافة بند جديد</h4>

                {/* حقل اسم البند */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-1">اسم البند</label>
                    <input type="text" name="name" id="name" value={newItem.name} onChange={handleChange}
                        placeholder="رسوم دراسية / رسوم أنشطة"
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-purple-500" />
                </div>



                {/* خيار قابل للتحرير */}
                <div className="flex items-center">
                    <input type="checkbox" name="isEditable" id="isEditable" checked={newItem.isEditable} onChange={handleChange}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                    <label htmlFor="isEditable" className="ml-2 text-sm">القيمة قابلة للتحرير يدوياً عند التحصيل</label>
                </div>



                {/* اختيار نوع البند */}
                <div className="space-y-2 pt-2">
                    <span className="block text-sm font-medium mb-1">نوع البند:</span>
                    <div className="flex space-x-4 rtl:space-x-reverse">
                        <label className="flex items-center">
                            <input type="radio" name="type" value="budget" checked={newItem.type === 'budget'} onChange={handleChange}
                                className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500" />
                            <span className="ml-2">موازنة عامة</span>
                        </label>
                        <label className="flex items-center">
                            <input type="radio" name="type" value="fund" checked={newItem.type === 'fund'} onChange={handleChange}
                                className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500" />
                            <span className="ml-2">صندوق خاص</span>
                        </label>
                    </div>
                </div>

                {/* اختيار الصندوق (يظهر فقط إذا كان النوع "صندوق خاص") */}
                {newItem.type === 'fund' && (
                    <div className="pt-2">
                        <label htmlFor="fundId" className="block text-sm font-medium mb-1">اختيار الصندوق</label>
                        <select name="fundId" id="fundId" value={newItem.fundId || ''} onChange={(e) => setNewItem(prev => ({ ...prev, fundId: e.target.value }))}
                            className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-purple-500"
                            disabled={funds.length === 0}>
                            {funds.length === 0 ? (
                                <option value="">يجب إضافة صناديق أولاً</option>
                            ) : (
                                <>
                                    <option value="" disabled>-- اختر صندوق --</option>
                                    {funds.map(fund => (
                                        <option key={fund.id} value={fund.id}>{fund.name}</option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>
                )}

                {/* اختيار بند الموازنة (يظهر فقط إذا كان النوع "موازنة عامة") */}
                {newItem.type === 'budget' && (
                    <div className="pt-2">
                        <label htmlFor="budgetItemId" className="block text-sm font-medium mb-1">اختيار بند الموازنة</label>
                        <select name="budgetItemId" id="budgetItemId" value={newItem.budgetItemId || ''} onChange={(e) => setNewItem(prev => ({ ...prev, budgetItemId: e.target.value }))}
                            className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-purple-500"
                            disabled={budgetItems.length === 0}>
                            {budgetItems.length === 0 ? (
                                <option value="">يجب إضافة بنود الموازنة أولاً</option>
                            ) : (
                                <>
                                    <option value="" disabled>-- اختر بند الموازنة --</option>
                                    {budgetItems.map(budgetItem => (
                                        <option key={budgetItem.id} value={budgetItem.id}>{budgetItem.name}</option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>
                )}

                <button onClick={handleAddItem}
                    className="w-full bg-purple-600 text-white px-4 py-2 mt-4 rounded-lg font-semibold hover:bg-purple-700 transition duration-200 shadow-md flex items-center justify-center">
                    + إضافة بند التحصيل
                </button>
            </div>

            {/* قائمة البنود الحالية */}
            <div className="space-y-3 pt-4">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">البنود الحالية ({items.length}):</h4>
                <ul className="bg-white dark:bg-gray-700 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-600">
                    {items.map((item, index) => (
                        <li key={item.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition duration-150">
                            {editingItemId === item.id ? (
                                // وضع التعديل
                                <div className="flex flex-col gap-2 flex-grow">
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        placeholder="اسم البند"
                                        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition duration-150"
                                        autoFocus
                                    />
                                    <div className="flex items-center gap-2 pt-2">
                                        <input
                                            type="checkbox"
                                            checked={editingIsEditable}
                                            onChange={(e) => setEditingIsEditable(e.target.checked)}
                                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                        />
                                        <label className="text-sm">القيمة قابلة للتحرير يدوياً عند التحصيل</label>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm">النوع:</label>
                                            <select
                                                value={editingType}
                                                onChange={(e) => {
                                                    setEditingType(e.target.value);
                                                    if (e.target.value === 'budget') {
                                                        setEditingFundId(null);
                                                        setEditingBudgetItemId(budgetItems.length > 0 ? budgetItems[0].id : null);
                                                    } else if (e.target.value === 'fund') {
                                                        setEditingBudgetItemId(null);
                                                        setEditingFundId(funds.length > 0 ? funds[0].id : null);
                                                    }
                                                }}
                                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                                            >
                                                <option value="budget">موازنة عامة</option>
                                                <option value="fund">صندوق خاص</option>
                                            </select>
                                        </div>
                                        {editingType === 'fund' && (
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm">الصندوق:</label>
                                                <select
                                                    value={editingFundId || ''}
                                                    onChange={(e) => setEditingFundId(e.target.value)}
                                                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                                                    disabled={funds.length === 0}
                                                >
                                                    <option value="" disabled>-- اختر صندوق --</option>
                                                    {funds.map(fund => (
                                                        <option key={fund.id} value={fund.id}>{fund.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {editingType === 'budget' && (
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm">بند الموازنة:</label>
                                                <select
                                                    value={editingBudgetItemId || ''}
                                                    onChange={(e) => setEditingBudgetItemId(e.target.value)}
                                                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                                                    disabled={budgetItems.length === 0}
                                                >
                                                    <option value="" disabled>-- اختر بند الموازنة --</option>
                                                    {budgetItems.map(budgetItem => (
                                                        <option key={budgetItem.id} value={budgetItem.id}>{budgetItem.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                </div>
                            ) : (
                                // العرض العادي
                                <>
                                    <div className="flex flex-col text-sm">
                                        <div className="flex items-center gap-2">
                                            {item.isEditableInSettings && (
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">قابل للتحرير</span>
                                            )}
                                            <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            النوع: **{item.type === 'budget' ? 'موازنة عامة' : getFundName(item.fundId)}** | التحرير: {item.isEditable ? 'نعم' : 'لا'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleStartEdit(item)}
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
                                            disabled={index === items.length - 1}
                                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="تحريك لأسفل"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
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
