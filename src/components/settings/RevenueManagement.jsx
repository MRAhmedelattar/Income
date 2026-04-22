// src/components/settings/RevenueManagement.jsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../api'; // استيراد API client
import { parseLocaleNumber, normalizeNumberObject, formatLocaleNumber } from '../../utils/numberUtils'; // استيراد دوال معالجة الأرقام

// مفتاح التخزين المحلي
const REVENUE_TYPES_STORAGE_KEY = 'revenueTypes_custom';

// الأنواع الافتراضية
const DEFAULT_REVENUE_TYPES = [
    { id: 'general', name: 'عام' },
    { id: 'special', name: 'مميز' },
    { id: 'postgraduate', name: 'دراسات عليا' },
    { id: 'other', name: 'أخرى' },
];

// تحميل الأنواع من localStorage أو استخدام الافتراضية
const loadRevenueTypes = () => {
    try {
        const saved = localStorage.getItem(REVENUE_TYPES_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.warn('فشل في تحميل أنواع الإيرادات من localStorage، استخدام الافتراضية.');
    }
    return DEFAULT_REVENUE_TYPES;
};

// حفظ الأنواع في localStorage
const saveRevenueTypes = (types) => {
    try {
        localStorage.setItem(REVENUE_TYPES_STORAGE_KEY, JSON.stringify(types));
    } catch (error) {
        console.error('فشل في حفظ أنواع الإيرادات في localStorage:', error);
    }
};

export default function RevenueManagement({ items, revenues, setRevenues }) {
    // حالة أنواع الإيرادات (محليًا في الواجهة + localStorage)
    const [revenueTypes, setRevenueTypes] = useState(() => loadRevenueTypes());

    // حالة تعديل نوع معين
    const [editingTypeId, setEditingTypeId] = useState(null);
    const [editTypeName, setEditTypeName] = useState('');

    // حالة إضافة نوع جديد
    const [newTypeName, setNewTypeName] = useState('');

    // رسالة خطأ عامة
    const [errorMessage, setErrorMessage] = useState('');

    // حالة الإيراد الجديد أو المعدل
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [newRevenue, setNewRevenue] = useState({
        title: '',
        type: 'general', // الافتراضي
        itemValues: null,
        itemEditability: {}, // إضافة حالة لقابلية التحرير
    });

    // حالة لتحديد ما إذا كنا في وضع التعديل
    const [editingRevenueId, setEditingRevenueId] = useState(null);

    // تأكد أن الحالة في localStorage محدثة عند كل تغيير
    useEffect(() => {
        saveRevenueTypes(revenueTypes);
    }, [revenueTypes]);

    // HDD-Safe: Add New mode ready on mount
    useEffect(() => {
        setIsDataLoaded(true);
    }, []);

    // دالة تحديث عنوان الإيراد
    const handleTitleChange = (e) => {
        setNewRevenue(prev => ({
            ...prev,
            title: e.target.value,
        }));
    };

    // دالة تحديث نوع الإيراد
    const handleTypeChange = (e) => {
        setNewRevenue(prev => ({
            ...prev,
            type: e.target.value,
        }));
    };

    // دالة تحديث قيمة البند
    const handleItemValueChange = (itemId, value) => {
        const parsedValue = parseLocaleNumber(value);
        setNewRevenue(prev => ({
            ...prev,
            itemValues: {
                ...prev.itemValues,
                [itemId]: parsedValue,
            },
        }));
    };

    // 🆕 دالة تحديث قابلية التحرير للبند
    const handleItemEditabilityChange = (itemId, isChecked) => {
        setNewRevenue(prev => ({
            ...prev,
            itemEditability: {
                ...prev.itemEditability,
                [itemId]: isChecked,
            },
        }));
    };

    // دالة إضافة نوع إيراد جديد
    const handleAddRevenueType = () => {
        if (!newTypeName.trim()) {
            setErrorMessage('يرجى إدخال اسم النوع');
            return;
        }

        if (revenueTypes.some(t => t.name === newTypeName.trim())) {
            setErrorMessage('هذا النوع موجود مسبقًا');
            return;
        }

        const newId = 'custom_' + Date.now().toString();
        const newTypes = [...revenueTypes, { id: newId, name: newTypeName.trim() }];
        setRevenueTypes(newTypes);
        setNewTypeName('');
        setErrorMessage('');
    };

    // دالة بدء تعديل نوع
    const startEditingType = (type) => {
        setEditingTypeId(type.id);
        setEditTypeName(type.name);
    };

    // دالة حفظ تعديل النوع
    const saveEditingType = () => {
        if (!editTypeName.trim()) {
            setErrorMessage('اسم النوع لا يمكن أن يكون فارغًا');
            return;
        }

        if (revenueTypes.some(t => t.name === editTypeName.trim() && t.id !== editingTypeId)) {
            setErrorMessage('هذا النوع موجود مسبقًا');
            return;
        }

        const updatedTypes = revenueTypes.map(t =>
            t.id === editingTypeId ? { ...t, name: editTypeName.trim() } : t
        );
        setRevenueTypes(updatedTypes);
        setEditingTypeId(null);
        setEditTypeName('');
        setErrorMessage('');

        // تحديث نوع الإيراد الحالي إذا كان من النوع المعدّل
        if (newRevenue.type === editingTypeId) {
            setNewRevenue(prev => ({ ...prev, type: editingTypeId }));
        }
    };

    // دالة إلغاء تعديل النوع
    const cancelEditingType = () => {
        setEditingTypeId(null);
        setEditTypeName('');
    };

    // دالة حذف نوع
    const handleDeleteRevenueType = (id) => {
        if (revenueTypes.length <= 1) {
            setErrorMessage('يجب أن يبقى نوع واحد على الأقل');
            return;
        }

        if (newRevenue.type === id) {
            setErrorMessage('لا يمكن حذف النوع المستخدم حاليًا');
            return;
        }

        const isUsed = revenues.some(rev => rev.type === id);
        if (isUsed) {
            setErrorMessage('لا يمكن حذف نوع مستخدم في إيرادات موجودة');
            return;
        }

        const confirmed = window.confirm('هل أنت متأكد من حذف هذا النوع؟');
        if (confirmed) {
            const updatedTypes = revenueTypes.filter(t => t.id !== id);
            setRevenueTypes(updatedTypes);
            setErrorMessage('');
        }
    };

    // دالة إضافة أو تحديث الإيراد
    const handleAddRevenue = async () => {
        // HDD-Safe Guard
        if (!isDataLoaded || newRevenue.itemValues === null || isSaving) {
            console.warn('Revenue not ready for saving - HDD loading or saving in progress');
            return;
        }

        if (!newRevenue.title.trim()) {
            alert("الرجاء إدخال عنوان الإيراد.");
            return;
        }

        setIsSaving(true);

        // تطبيع البيانات قبل الإرسال
        const normalizedItemValues = normalizeNumberObject(newRevenue.itemValues);

        try {
            if (editingRevenueId) {
                const updatedRevenue = await apiClient.updateRevenue(editingRevenueId, {
                    title: newRevenue.title.trim(),
                    type: newRevenue.type,
                    itemValues: normalizedItemValues,
                });
                setRevenues(prevRevenues =>
                    prevRevenues.map(revenue =>
                        revenue.id === editingRevenueId ? updatedRevenue : revenue
                    )
                );
                setEditingRevenueId(null);
            } else {
                const revenueToAdd = {
                    id: crypto.randomUUID(),
                    title: newRevenue.title.trim(),
                    type: newRevenue.type,
                    itemValues: normalizedItemValues,
                    itemEditability: { ...newRevenue.itemEditability },
                    date: new Date().toISOString(),
                    orderIndex: revenues.length,
                };

                const createdRevenue = await apiClient.createRevenue(revenueToAdd);
                setRevenues(prevRevenues => [...prevRevenues, createdRevenue]);
            }
        } catch (error) {
            console.error('فشل في حفظ الإيراد:', error);
            // Local fallback
            if (editingRevenueId) {
                setRevenues(prevRevenues =>
                    prevRevenues.map(revenue =>
                        revenue.id === editingRevenueId
                            ? {
                                ...revenue,
                                title: newRevenue.title.trim(),
                                type: newRevenue.type,
                                itemValues: normalizedItemValues,
                            }
                            : revenue
                    )
                );
            } else {
                const revenueToAdd = {
                    id: crypto.randomUUID(),
                    title: newRevenue.title.trim(),
                    type: newRevenue.type,
                    itemValues: normalizedItemValues,
                    itemEditability: { ...newRevenue.itemEditability },
                    date: new Date().toISOString(),
                    orderIndex: revenues.length,
                };
                setRevenues(prevRevenues => [...prevRevenues, revenueToAdd]);
            }
            setEditingRevenueId(null);
        } finally {
            setIsSaving(false);
        }

        setNewRevenue({
            title: '',
            type: 'general',
            itemValues: null,
            itemEditability: {},
        });
        setIsDataLoaded(true);
    };

    // دالة حذف الإيراد (بدون تغيير)
    const handleDeleteRevenue = async (id) => {
        const confirmed = window.confirm("هل أنت متأكد من رغبتك في حذف هذا الإيراد؟ هذا الإجراء لا يمكن التراجع عنه.");
        if (confirmed) {
            try {
                await apiClient.deleteRevenue(id);
                setRevenues(prevRevenues => prevRevenues.filter(revenue => revenue.id !== id));
            } catch (error) {
                console.error('فشل في حذف الإيراد:', error);
                setRevenues(prevRevenues => prevRevenues.filter(revenue => revenue.id !== id));
            }
        }
    };

    // دالة تحريك الإيراد لأعلى (بدون تغيير)
    const handleMoveUp = async (index) => {
        if (index > 0) {
            const newRevenues = [...revenues];
            [newRevenues[index - 1], newRevenues[index]] = [newRevenues[index], newRevenues[index - 1]];
            newRevenues[index - 1].orderIndex = index - 1;
            newRevenues[index].orderIndex = index;

            try {
                await apiClient.updateRevenue(newRevenues[index - 1].id, { orderIndex: index - 1 });
                await apiClient.updateRevenue(newRevenues[index].id, { orderIndex: index });
                setRevenues(newRevenues);
            } catch (error) {
                console.error('فشل في تحديث ترتيب الإيرادات:', error);
                setRevenues(newRevenues);
            }
        }
    };

    // دالة تحريك الإيراد لأسفل (بدون تغيير)
    const handleMoveDown = async (index) => {
        if (index < revenues.length - 1) {
            const newRevenues = [...revenues];
            [newRevenues[index], newRevenues[index + 1]] = [newRevenues[index + 1], newRevenues[index]];
            newRevenues[index].orderIndex = index;
            newRevenues[index + 1].orderIndex = index + 1;

            try {
                await apiClient.updateRevenue(newRevenues[index].id, { orderIndex: index });
                await apiClient.updateRevenue(newRevenues[index + 1].id, { orderIndex: index + 1 });
                setRevenues(newRevenues);
            } catch (error) {
                console.error('فشل في تحديث ترتيب الإيرادات:', error);
                setRevenues(newRevenues);
            }
        }
    };

    // حساب المجموع الكلي للإيراد مع التقريب إلى رقمين عشريين
    const calculateTotal = (itemValues) => {
        const total = items.reduce((total, item) => {
            const value = (itemValues && itemValues[item.id]) || 0;
            return total + value;
        }, 0);
        return formatLocaleNumber(total, 2);
    };

    // دالة للحصول على اسم النوع لعرضه في القائمة
    const getTypeName = (typeId) => {
        const type = revenueTypes.find(t => t.id === typeId);
        return type ? type.name : typeId;
    };

    return (
        <div className="space-y-8 animate-slide-in-up">
            <h3 className="text-2xl font-extrabold text-green-600 dark:text-green-400 border-b pb-2">
                إدارة الإيرادات والتحصيلات
            </h3>

            {/* إدارة أنواع الإيرادات */}
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg space-y-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">
                    إدارة أنواع الإيرادات
                </h4>

                {/* إضافة نوع جديد */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="أدخل اسم نوع جديد"
                        className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-green-500"
                    />
                    <button
                        onClick={handleAddRevenueType}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-md"
                    >
                        + إضافة نوع
                    </button>
                </div>

                {errorMessage && (
                    <div className="text-red-500 text-sm">{errorMessage}</div>
                )}

                {/* عرض الأنواع الحالية مع خيارات التعديل والحذف */}
                <div className="space-y-2 pt-2">
                    {revenueTypes.map((type) => (
                        <div key={type.id} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            {editingTypeId === type.id ? (
                                <div className="flex gap-2 flex-1">
                                    <input
                                        type="text"
                                        value={editTypeName}
                                        onChange={(e) => setEditTypeName(e.target.value)}
                                        className="flex-1 p-1 border rounded dark:bg-gray-600 dark:border-gray-500"
                                    />
                                    <button
                                        onClick={saveEditingType}
                                        className="bg-green-600 text-white px-2 py-1 rounded text-sm"
                                    >
                                        حفظ
                                    </button>
                                    <button
                                        onClick={cancelEditingType}
                                        className="bg-gray-500 text-white px-2 py-1 rounded text-sm"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            ) : (
                                <span className="font-medium text-gray-800 dark:text-gray-200">{type.name}</span>
                            )}
                            <div className="flex gap-1">
                                <button
                                    onClick={() => startEditingType(type)}
                                    className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full"
                                    title="تعديل"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleDeleteRevenueType(type.id)}
                                    disabled={revenueTypes.length <= 1}
                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="حذف"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* نموذج إضافة إيراد جديد */}
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg space-y-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">
                    {editingRevenueId ? 'تعديل الإيراد' : 'إضافة إيراد جديد'}
                </h4>

                <div>
                    <label htmlFor="title" className="block text-sm font-medium mb-1">عنوان الإيراد</label>
                    <input type="text" name="title" id="title" value={newRevenue.title} onChange={handleTitleChange}
                        placeholder="مثال: إيرادات الشهر الأول"
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-green-500" />
                </div>

                {/* اختيار نوع الإيراد (ديناميكي من localStorage) */}
                <div>
                    <label htmlFor="type" className="block text-sm font-medium mb-1">نوع الإيراد</label>
                    <select name="type" id="type" value={newRevenue.type} onChange={handleTypeChange}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-green-500">
                        {revenueTypes.map((type) => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-3">
                    <h5 className="text-md font-medium text-text-light dark:text-text-dark">تحديد قيم البنود:</h5>
                    {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex flex-col flex-1">
                                <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                                <div className="flex items-center mt-1">
                                    <input
                                        type="checkbox"
                                        id={`editable-${item.id}`}
                                        checked={newRevenue.itemEditability[item.id] !== undefined ? newRevenue.itemEditability[item.id] : item.isEditable}
                                        onChange={(e) => handleItemEditabilityChange(item.id, e.target.checked)}
                                        className="mr-2"
                                        disabled={!isDataLoaded || isSaving}
                                    />
                                    <label htmlFor={`editable-${item.id}`} className="text-xs text-gray-500 dark:text-gray-400">
                                        القيمة قابلة للتحرير يدوياً عند التحصيل
                                    </label>
                                </div>
                            </div>
                            <input
                                type="number"
                                value={newRevenue.itemValues && newRevenue.itemValues[item.id] !== undefined ? newRevenue.itemValues[item.id] : ''}
                                onChange={(e) => handleItemValueChange(item.id, e.target.value)}
                                min="0"
                                className="w-24 p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-green-500"
                                disabled={!isDataLoaded || isSaving}
                                placeholder={isDataLoaded ? '0' : 'جاري التحميل...'}
                            />
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        الإجمالي: <span className="text-green-600 dark:text-green-400">{calculateTotal(newRevenue.itemValues)}</span>
                    </h3>
                </div>

                <div className="flex gap-2">
                    <button onClick={handleAddRevenue}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-200 shadow-md flex items-center justify-center">
                        {editingRevenueId ? 'تحديث الإيراد' : '+ إضافة الإيراد'}
                    </button>
                    {editingRevenueId && (
                        <button onClick={() => {
                            setEditingRevenueId(null);
                            setNewRevenue({ title: '', type: 'general', itemValues: {}, itemEditability: {} });
                        }}
                            className="bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition duration-200 shadow-md">
                            إلغاء
                        </button>
                    )}
                </div>
            </div>

            {/* قائمة الإيرادات الحالية */}
            <div className="space-y-3 pt-4">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">الإيرادات الحالية ({revenues.length}):</h4>
                <ul className="bg-white dark:bg-gray-700 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-600">
                    {revenues.map((revenue, index) => (
                        <li key={revenue.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition duration-150">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{revenue.title}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        التاريخ: {new Date(revenue.date).toLocaleDateString('ar-EG')} | النوع: {getTypeName(revenue.type)} | المجموع: {calculateTotal(revenue.itemValues)}
                                    </span>
                                    <div className="mt-2 space-y-1">
                                        {items.map((item) => (
                                            <span key={item.id} className="inline-block bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs mr-2 mb-1">
                                        {item.name}: {formatLocaleNumber((revenue.itemValues && revenue.itemValues[item.id]) || 0, 2)}
                                    </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-1">
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
                                        disabled={index === revenues.length - 1}
                                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="تحريك لأسفل"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const revenueToEdit = revenues.find(r => r.id === revenue.id);
                                            setIsDataLoaded(false);
                                            setEditingRevenueId(revenue.id);
                                            setNewRevenue({
                                                title: revenueToEdit.title,
                                                type: revenueToEdit.type || 'general',
                                                itemValues: revenueToEdit.itemValues || null,
                                                itemEditability: { ...(revenueToEdit.itemEditability || {}) },
                                            });
                                            // Snapshot loaded, ready for edit
                                            setTimeout(() => setIsDataLoaded(true), 50);
                                        }}
                                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150"
                                        title="تعديل الإيراد"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRevenue(revenue.id)}
                                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-150"
                                        title="حذف الإيراد"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}