import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import apiClient from '../api'; // استيراد API client
import { hasPermission } from '../utils/permissions';
import { registerLocale, setDefaultLocale } from  "react-datepicker";
import ar from 'date-fns/locale/ar';

// تسجيل اللغة العربية رسمياً داخل المكتبة
registerLocale('ar', ar);

// دالة تحويل الأرقام إلى عربية
const toArabicNumbers = (num) => {
  return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
};

// دالة لتنسيق التاريخ كـ يوم/شهر/سنة
const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * صفحة تسجيل الإيرادات المالية
 */
function Collections({ items, funds, collections, setCollections, revenues, currentUser }) {
  // حالة لنموذج إدخال البيانات
  const [newCollection, setNewCollection] = useState({
    name: '',
    receiptNumber: '',
    paymentDate: new Date().toISOString().split('T')[0], // اليوم كقيمة افتراضية
    selectedRevenueId: '', // معرف الإيراد المختار
    distribution: null, // HDD-Safe: null حتى التحميل الكامل
  });

  // HDD-Safe State Readiness Logic
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // حالة للتاريخ المختار في DatePicker
  const [selectedDate, setSelectedDate] = useState(new Date());

  // حالة للتعديل
  const [editingCollection, setEditingCollection] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // مزامنة التاريخ المختار مع تاريخ السداد
  useEffect(() => {
    if (newCollection.paymentDate) {
      setSelectedDate(new Date(newCollection.paymentDate));
    } else {
      setSelectedDate(new Date());
    }
  }, [newCollection.paymentDate]);

  // 🔹 useEffect لاقتراح رقم الإيصال التلقائي اللحظي بناءً على أحدث تسجيل
  // يراقب مصفوفة collections ويقترح الرقم التالي فوراً عند الإضافة
  useEffect(() => {
    // الشرط: وضع الإضافة فقط + الحقل فارغ (للسماح بالتعديل اليدوي)
    if (!isEditing && newCollection.receiptNumber === '') {
      if (collections && collections.length > 0) {
        // 🔍 البحث عن السجل ذو أحدث تاريخ تسجيل (ليس بالضرورة الأول في المصفوفة)
        const latestCollection = collections.reduce((latest, current) => {
          return new Date(current.registrationDate) > new Date(latest.registrationDate)
            ? current
            : latest;
        });

        const lastReceiptNum = parseInt(latestCollection.receiptNumber, 10);
        
        if (!isNaN(lastReceiptNum)) {
          // ✅ زيادة الرقم بمقدار 1 وتعيينه فوراً
          setNewCollection(prev => ({
            ...prev,
            receiptNumber: String(lastReceiptNum + 1)
          }));
        } else {
          // إذا لم يكن الرقم صالحاً، نبدأ من 1
          setNewCollection(prev => ({
            ...prev,
            receiptNumber: '1'
          }));
        }
      } else {
        // 🆕 قائمة فارغة: نبدأ بالرقم الافتراضي 1
        setNewCollection(prev => ({
          ...prev,
          receiptNumber: '1'
        }));
      }
    }
    // ✅ تم إزالة تعليق eslint-disable لضمان التوافق، والمصفوفة التالية صحيحة وآمنة
  }, [collections, isEditing]);

  // حالة البحث
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('name'); // 'name' أو 'receiptNumber'

  // حالة الترقيم pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  
  // حالة معاينة التقرير
  const [showReportModal, setShowReportModal] = useState(false);

  // دالة لتحديث حقل في النموذج
  const handleInputChange = (field, value) => {
    setNewCollection(prev => ({ ...prev, [field]: value }));
  };

  // دالة لتحديث اختيار الإيراد وملء البنود تلقائياً (HDD-Safe)
  const handleRevenueChange = async (revenueId) => {
    setIsDataLoaded(false); // 🚨 Loading Gap Protection

    if (revenueId === '') {
      // مسح الاختيار: إعادة تعيين آمنة
        setNewCollection(prev => ({
          ...prev,
          selectedRevenueId: '',
          distribution: null,
        }));
        setIsDataLoaded(false);
      return;
    }

    try {
      // 🔍 تحسين: البحث مع مقارنة الآمنة للمعرفات كنصوص
      const selectedRevenue = revenues?.find(revenue => 
        revenue && String(revenue.id) === String(revenueId)
      );
      
      setNewCollection(prev => ({
        ...prev,
        selectedRevenueId: revenueId,
        distribution: selectedRevenue ? selectedRevenue.itemValues : null,
      }));
      setIsDataLoaded(true); // ✅ Data Loaded
    } catch (error) {
      console.error('خطأ في تحميل بيانات الإيراد:', error);
      setNewCollection(prev => ({
        ...prev,
        selectedRevenueId: revenueId,
        distribution: null,
      }));
      setIsDataLoaded(false);
    }
  };

  // دالة لتحديث قيمة بند معين (HDD-Safe Guard)
  const handleItemAmountChange = (itemId, amount) => {
    // 🚨 Guard: منع التعديل أثناء Loading Gap
    if (!isDataLoaded || newCollection.distribution === null) {
      console.warn('محاولة تعديل أثناء Loading Gap - تم تجاهلها');
      return;
    }

    setNewCollection(prev => ({
      ...prev,
      distribution: {
        ...prev.distribution,
        [itemId]: amount === '' ? 0 : Number(amount), // حفظ الصفر المتعمد، تجاهل الفارغ فقط
      },
    }));
  };

  // دالة لحساب الإجمالي (HDD-Safe)
  const calculateTotal = () => {
    if (!isDataLoaded || newCollection.distribution === null || Object.keys(newCollection.distribution).length === 0) {
      return 0; // 🛡️ منع crash أثناء Loading Gap
    }
    return Object.values(newCollection.distribution).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  };

  // التحقق من أن الحقول المطلوبة ممتلئة وأن رقم الإيصال غير مكرر
  const isDuplicateReceipt = collections.some(collection =>
    collection.receiptNumber === newCollection.receiptNumber.trim() &&
    (!isEditing || collection.id !== editingCollection?.id)
  );

  const isFormValid = newCollection.name && 
                      newCollection.receiptNumber && 
                      newCollection.paymentDate && 
                      !isDuplicateReceipt && 
                      isDataLoaded;
                      
  // ✅ دالة مساعدة لعرض اسم الإيراد - مُحسّنة بالكامل
  const getRevenueTitle = (revenueId) => {
    // 🛡️ تحسين الأداء: التحقق من وجود البيانات قبل الوصول للخصائص
    if (!revenueId || !revenues || !Array.isArray(revenues) || revenues.length === 0) return '-';
    
    // 🔍 مقارنة المعرفات بعد تحويلها لنصوص لتجنب اختلاف الأنواع (Number vs String)
    const found = revenues.find(r => 
      r && r.id !== undefined && String(r.id) === String(revenueId)
    );
    
    // 🛡️ التحقق الآمن من وجود العنوان قبل الوصول إليه
    return found?.title ? String(found.title) : '-';
  };

  // ✅ دالة لإضافة تحصيل جديد أو تحديث موجود - مُحسّنة للربط الفوري
  const handleAddCollection = async () => {
    // 🚨 Final Guard: منع الحفظ إذا لم تكن البيانات جاهزة
    if (!isDataLoaded || newCollection.distribution === null) {
      alert('🚫 البيانات غير جاهزة!\nانتظر تحميل هيكل الإيراد كاملاً (HDD قد يكون بطيئاً).');
      return;
    }

    // 🔗 دالة مساعدة لضمان توحيد نوع المعرف كنص
    const normalizeRevenueId = (id) => id ? String(id) : null;

    if (isEditing && editingCollection) {
      // تحديث التحصيل الموجود
      const updatedCollection = {
        ...editingCollection,
        ...newCollection,
        selectedRevenueId: normalizeRevenueId(newCollection.selectedRevenueId),
        distribution: Object.entries(newCollection.distribution).map(([itemId, amount]) => ({ 
          itemId: String(itemId), 
          amount: Number(amount) || 0 
        })),
        total: calculateTotal(),
      };

      try {
        const result = await apiClient.updateCollection(editingCollection.id, updatedCollection);
        // 🔗 ضمان الربط الفوري: توحيد نوع selectedRevenueId في النتيجة
        const normalizedResult = {
          ...result,
          selectedRevenueId: normalizeRevenueId(result.selectedRevenueId || newCollection.selectedRevenueId)
        };
        setCollections(prevCollections =>
          prevCollections.map(collection =>
            collection.id === editingCollection.id ? normalizedResult : collection
          )
        );
      } catch (error) {
        console.error('فشل في تحديث التحصيل:', error);
        // تحديث محلي في حالة فشل - مع ضمان توحيد المعرف
        setCollections(prevCollections =>
          prevCollections.map(collection =>
            collection.id === editingCollection.id ? {
              ...updatedCollection,
              selectedRevenueId: normalizeRevenueId(updatedCollection.selectedRevenueId)
            } : collection
          )
        );
      }

      // إعادة تعيين الحالة
      setIsEditing(false);
      setEditingCollection(null);
    } else {
      // إضافة تحصيل جديد
      const collectionToAdd = {
        id: crypto.randomUUID(),
        registrationDate: new Date().toISOString(),
        ...newCollection,
        selectedRevenueId: normalizeRevenueId(newCollection.selectedRevenueId),
        distribution: Object.entries(newCollection.distribution).map(([itemId, amount]) => ({ 
          itemId: String(itemId), 
          amount: String(amount) 
        })),
        total: calculateTotal(),
      };

      try {
        const createdCollection = await apiClient.createCollection(collectionToAdd);
        // ✅ الربط الفوري: ضمان أن selectedRevenueId محفوظ كنص للبحث الصحيح في getRevenueTitle
        const normalizedCollection = {
          ...createdCollection,
          selectedRevenueId: normalizeRevenueId(
            createdCollection.selectedRevenueId || newCollection.selectedRevenueId
          )
        };
        // 🔄 تحديث الحالة فوراً لضمان استجابة المكون
        setCollections(prevCollections => [...prevCollections, normalizedCollection]);
      } catch (error) {
        console.error('فشل في إضافة التحصيل:', error);
        // إضافة محلي في حالة فشل - مع ضمان توحيد المعرف للعرض الفوري
        const fallbackCollection = {
          ...collectionToAdd,
          selectedRevenueId: normalizeRevenueId(collectionToAdd.selectedRevenueId)
        };
        setCollections(prevCollections => [...prevCollections, fallbackCollection]);
      }
    }

    // 🔄 إعادة تعيين النموذج: تفريغ الحقول سيؤدي لإطلاق useEffect وحساب الرقم التالي فوراً
    setNewCollection({
      name: '',
      receiptNumber: '', // 👈 التفريغ هنا هو "الزناد" الذي يطلق حساب الرقم الجديد
      paymentDate: new Date().toISOString().split('T')[0],
      selectedRevenueId: '',
      distribution: null,
    });
    setIsDataLoaded(false);
  };

  // دالة لتعديل تحصيل
  const handleEditCollection = (collection) => {
    setEditingCollection(collection);
    setIsEditing(true);
    const loadedDistribution = Array.isArray(collection.distribution) 
      ? collection.distribution.reduce((acc, curr) => ({ ...acc, [curr.itemId]: curr.amount }), {}) 
      : { ...collection.distribution };
    
    setNewCollection({
      name: collection.name,
      receiptNumber: collection.receiptNumber,
      paymentDate: collection.paymentDate,
      selectedRevenueId: collection.selectedRevenueId ? String(collection.selectedRevenueId) : '',
      distribution: loadedDistribution,
    });
    setIsDataLoaded(true); // ✅ Editing: Data already loaded
  };

  // دالة لحذف تحصيل
  const handleDeleteCollection = async (collectionId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا التحصيل؟')) {
      try {
        await apiClient.deleteCollection(collectionId);
        setCollections(prevCollections =>
          prevCollections.filter(collection => collection.id !== collectionId)
        );
      } catch (error) {
        console.error('فشل في حذف التحصيل:', error);
        // حذف محلي في حالة فشل
        setCollections(prevCollections =>
          prevCollections.filter(collection => collection.id !== collectionId)
        );
      }
    }
  };

  // دالة لإلغاء التعديل
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingCollection(null);
    setNewCollection({
      name: '',
      receiptNumber: '',
      paymentDate: new Date().toISOString().split('T')[0],
      selectedRevenueId: '',
      distribution: null,
    });
    setIsDataLoaded(false);
  };

  // فلترة السجلات حسب البحث (البحث يشمل جميع البيانات)
  const filteredCollections = collections.filter(collection => {
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase();
    if (searchType === 'name') {
      return collection.name.toLowerCase().includes(term);
    } else if (searchType === 'receiptNumber') {
      return collection.receiptNumber.toLowerCase().includes(term);
    }
    return true;
  });

  // ترتيب السجلات من الأحدث للأقدم (حسب تاريخ التسجيل)
  const sortedCollections = [...filteredCollections].sort((a, b) => {
    return new Date(b.registrationDate) - new Date(a.registrationDate);
  });

  // حساب عدد الصفحات
  const totalPages = Math.ceil(sortedCollections.length / ITEMS_PER_PAGE);

  // الحصول على السجلات للصفحة الحالية
  const paginatedCollections = sortedCollections.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // إعادة تعيين الصفحة الحالية عند تغيير البحث
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* رأس الصفحة */}
      <div>
        <h1 className="text-3xl font-bold mb-2 text-text-light dark:text-text-dark">
          تسجيل إيرادات
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          إدخال بيانات تحصيل جديد وعرض السجلات السابقة.
        </p>
      </div>

      {hasPermission(currentUser, 'collections', 'edit') && (
        <>
          {/* نموذج إدخال البيانات */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
              {isEditing ? 'تعديل التحصيل' : 'بيانات التحصيل الجديد'}
            </h2>

            {/* صف أول: تاريخ التسجيل والاسم */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">تاريخ التسجيل</label>
                <input
                  type="text"
                  value={formatDate(new Date())}
                  readOnly
                  className="w-full p-2 border rounded-md bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم الطالب/الشخص</label>
                <input
                  type="text"
                  value={newCollection.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholder="أدخل الاسم"
                />
              </div>
            </div>

            {/* صف ثاني: رقم الإيصال وتاريخ السداد واختيار الإيراد */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">رقم الإيصال</label>
                <input
                  type="text"
                  value={newCollection.receiptNumber}
                  onChange={(e) => handleInputChange('receiptNumber', e.target.value)}
                  className={`w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 ${isDuplicateReceipt ? 'border-red-500' : ''}`}
                  placeholder="أدخل رقم الإيصال"
                />
                {isDuplicateReceipt && (
                  <p className="text-red-500 text-xs mt-1">رقم الإيصال مكرر، يرجى إدخال رقم مختلف.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">تاريخ السداد</label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => {
                    setSelectedDate(date);
                    if (date) {
                      const isoDate = date.toISOString().split('T')[0];
                      handleInputChange('paymentDate', isoDate);
                    } else {
                      handleInputChange('paymentDate', '');
                    }
                  }}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  placeholderText="اختر التاريخ"
                  locale="ar"
                />
                <div className="mt-1 text-xs text-gray-500">
                  التاريخ المحدد: {newCollection.paymentDate ? formatDate(newCollection.paymentDate) : 'غير محدد'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اختيار الإيراد</label>
                <select
                  value={newCollection.selectedRevenueId}
                  onChange={(e) => handleRevenueChange(e.target.value)}
                  className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">اختر إيراداً...</option>
                  {revenues?.map(revenue => (
                    <option key={revenue.id} value={revenue.id}>
                      {revenue.title} - المجموع: {items?.reduce((total, item) => total + (revenue.itemValues?.[item.id] || 0), 0) || 0}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* جدول البنود */}
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">البنود</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-2">البند</th>
                      <th className="text-right p-2">القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items?.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => (
                      <tr key={item.id} className="border-b">
                        <td className="p-2">{item.name}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={newCollection.distribution?.[item.id] || ''}
                            onChange={(e) => handleItemAmountChange(item.id, e.target.value)}
                            className={`w-full p-1 border rounded border-gray-300 dark:border-gray-600 ${
                              item.isEditable
                                ? 'bg-gray-50 dark:bg-gray-700'
                                : 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed'
                            }`}
                            placeholder={isDataLoaded ? '0' : 'جاري التحميل...'}
                            disabled={!item.isEditable || !isDataLoaded}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* الإجمالي وأزرار الإجراءات */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-green-600 dark:text-green-400">
                الإجمالي: {calculateTotal().toFixed(2)}
              </h3>
              <div className="flex gap-2">
                {isEditing && (
                  <button
                    onClick={handleCancelEdit}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition duration-200"
                  >
                    إلغاء
                  </button>
                )}
                <div className="flex items-center gap-2">
                  {!isDataLoaded && newCollection.selectedRevenueId !== '' && (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                      <span className="text-sm text-gray-500">جاري التحميل...</span>
                    </>
                  )}
                  <button
                    onClick={handleAddCollection}
                    disabled={!isFormValid || !isDataLoaded}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isEditing ? 'تحديث التحصيل' : 'إضافة تحصيل'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* قسم البحث */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">البحث في السجلات</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نوع البحث</label>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="name">البحث بالاسم</option>
              <option value="receiptNumber">البحث برقم الإيصال</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {searchType === 'name' ? 'الاسم' : 'رقم الإيصال'}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
              placeholder={searchType === 'name' ? 'أدخل الاسم...' : 'أدخل رقم الإيصال...'}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setSearchType('name');
              }}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              مسح البحث
            </button>
          </div>
        </div>
      </div>

      {/* جدول عرض السجلات السابقة */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
          السجلات السابقة ({filteredCollections.length}{collections.length !== filteredCollections.length ? ` من ${collections.length}` : ''})
        </h2>
        {collections.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">لا توجد تحصيلات مسجلة بعد.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-700">
                    <th className="text-right p-2">الاسم</th>
                    <th className="text-right p-2">رقم الإيصال</th>
                    <th className="text-right p-2">الإيراد</th>
                    <th className="text-right p-2">تاريخ التسجيل</th>
                    <th className="text-right p-2">تاريخ السداد</th>
                    <th className="text-right p-2">الإجمالي</th>
                    <th className="text-right p-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCollections.map(collection => (
                    <tr key={collection.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-2">{collection.name}</td>
                      <td className="p-2">{collection.receiptNumber}</td>
                      {/* ✅ استخدام الدالة المحسّنة لعرض اسم الإيراد فوراً */}
                      <td className="p-2">{getRevenueTitle(collection.selectedRevenueId)}</td>
                      <td className="p-2">{formatDate(collection.registrationDate)}</td>
                      <td className="p-2">{formatDate(collection.paymentDate)}</td>
                      <td className="p-2 font-semibold text-green-600 dark:text-green-400">{collection.total?.toFixed(2) || '0.00'}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          {hasPermission(currentUser, 'collections', 'edit') && (
                            <button
                              onClick={() => handleEditCollection(collection)}
                              className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150"
                              title="تعديل التحصيل"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                              </svg>
                            </button>
                          )}
                          {hasPermission(currentUser, 'collections', 'edit') && (
                            <button
                              onClick={() => handleDeleteCollection(collection.id)}
                              className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-150"
                              title="حذف التحصيل"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* أزرار التنقل بين الصفحات */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                {/* زر الصفحة السابقة */}
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  السابق
                </button>

                {/* أرقام الصفحات */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  // إظهار محدود من أرقام الصفحات
                  const showPage = 
                    page === 1 || 
                    page === totalPages || 
                    (page >= currentPage - 1 && page <= currentPage + 1);
                  
                  if (!showPage) {
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-2">...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                {/* زر الصفحة التالية */}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  التالي
                </button>
              </div>
            )}

            {/* معلومات الصفحة الحالية */}
            {totalPages > 0 && (
              <div className="text-center mt-2 text-sm text-gray-600 dark:text-gray-400">
                صفحة {currentPage} من {totalPages}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Collections;