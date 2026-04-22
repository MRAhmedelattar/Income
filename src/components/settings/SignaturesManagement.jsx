import React, { useState } from 'react';
import apiClient from '../../api'; // استيراد API client

/**
 * مكون إدارة التوقيعات
 */
const SignaturesManagement = ({ signatures, setSignatures }) => {
  const [newSignature, setNewSignature] = useState({
    title: '',
    name: '',
  });

  const [editingSignature, setEditingSignature] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // دالة لتحديث حقل في النموذج
  const handleInputChange = (field, value) => {
    setNewSignature(prev => ({ ...prev, [field]: value }));
  };

  // دالة لإضافة توقيع جديد
  const handleAddSignature = async () => {
    if (!newSignature.title) {
      alert('يرجى إدخال الصفة على الأقل');
      return;
    }

    const signatureToAdd = {
      id: crypto.randomUUID(),
      ...newSignature,
      orderIndex: signatures.length,
    };

    try {
      const createdSignature = await apiClient.createSignature(signatureToAdd);
      setSignatures(prev => [...prev, createdSignature]);
    } catch (error) {
      console.error('فشل في إضافة التوقيع:', error);
      // إضافة محلي في حالة فشل
      setSignatures(prev => [...prev, signatureToAdd]);
    }

    // إعادة تعيين النموذج
    setNewSignature({
      title: '',
      name: '',
    });
  };

  // دالة لتعديل توقيع
  const handleEditSignature = (signature) => {
    setEditingSignature(signature);
    setIsEditing(true);
    setNewSignature({
      title: signature.title,
      name: signature.name,
    });
  };

  // دالة لتحديث توقيع
  const handleUpdateSignature = async () => {
    if (!newSignature.title) {
      alert('يرجى إدخال الصفة على الأقل');
      return;
    }

    const updatedSignature = {
      ...editingSignature,
      ...newSignature,
    };

    try {
      const result = await apiClient.updateSignature(editingSignature.id, updatedSignature);
      setSignatures(prev =>
        prev.map(sig => sig.id === editingSignature.id ? result : sig)
      );
    } catch (error) {
      console.error('فشل في تحديث التوقيع:', error);
      // تحديث محلي في حالة فشل
      setSignatures(prev =>
        prev.map(sig => sig.id === editingSignature.id ? updatedSignature : sig)
      );
    }

    // إعادة تعيين الحالة
    setIsEditing(false);
    setEditingSignature(null);
    setNewSignature({
      title: '',
      name: '',
    });
  };

  // دالة لحذف توقيع
  const handleDeleteSignature = async (signatureId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا التوقيع؟')) {
      try {
        await apiClient.deleteSignature(signatureId);
        setSignatures(prev => prev.filter(sig => sig.id !== signatureId));
      } catch (error) {
        console.error('فشل في حذف التوقيع:', error);
        // حذف محلي في حالة فشل
        setSignatures(prev => prev.filter(sig => sig.id !== signatureId));
      }
    }
  };

  // دالة لإلغاء التعديل
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingSignature(null);
    setNewSignature({
      name: '',
      title: '',
    });
  };

  // دالة لتحريك التوقيع لأعلى
  const moveSignatureUp = async (index) => {
    if (index === 0) return;

    const newSignatures = [...signatures];
    [newSignatures[index - 1], newSignatures[index]] = [newSignatures[index], newSignatures[index - 1]];

    // تحديث الترتيب
    newSignatures.forEach((sig, i) => {
      sig.orderIndex = i;
    });

    try {
      // تحديث عبر API لكلا التوقيعين
      await apiClient.updateSignature(newSignatures[index - 1].id, { orderIndex: index - 1 });
      await apiClient.updateSignature(newSignatures[index].id, { orderIndex: index });
      setSignatures(newSignatures);
    } catch (error) {
      console.error('فشل في تحديث ترتيب التوقيعات:', error);
      setSignatures(newSignatures); // تحديث محلي في حالة فشل
    }
  };

  // دالة لتحريك التوقيع لأسفل
  const moveSignatureDown = async (index) => {
    if (index === signatures.length - 1) return;

    const newSignatures = [...signatures];
    [newSignatures[index], newSignatures[index + 1]] = [newSignatures[index + 1], newSignatures[index]];

    // تحديث الترتيب
    newSignatures.forEach((sig, i) => {
      sig.orderIndex = i;
    });

    try {
      // تحديث عبر API لكلا التوقيعين
      await apiClient.updateSignature(newSignatures[index].id, { orderIndex: index });
      await apiClient.updateSignature(newSignatures[index + 1].id, { orderIndex: index + 1 });
      setSignatures(newSignatures);
    } catch (error) {
      console.error('فشل في تحديث ترتيب التوقيعات:', error);
      setSignatures(newSignatures); // تحديث محلي في حالة فشل
    }
  };

  // فرز التوقيعات حسب الترتيب
  const sortedSignatures = [...signatures].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return (
    <div className="space-y-8 animate-slide-in-up">
      <h3 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 border-b pb-2">
        إدارة التوقيعات
      </h3>

      {/* نموذج إضافة/تعديل التوقيع */}
      <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg space-y-4 border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">
          {isEditing ? 'تعديل التوقيع' : 'إضافة توقيع جديد'}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الصفة
            </label>
            <input
              type="text"
              value={newSignature.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="أدخل الصفة"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الاسم
            </label>
            <input
              type="text"
              value={newSignature.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="أدخل الاسم"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleUpdateSignature}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-md"
              >
                تحديث التوقيع
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
              onClick={handleAddSignature}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-200 shadow-md"
            >
              إضافة توقيع
            </button>
          )}
        </div>
      </div>

      {/* قائمة التوقيعات الحالية */}
      <div className="space-y-3 pt-4">
        <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">التوقيعات الحالية ({sortedSignatures.length}):</h4>
        <ul className="bg-white dark:bg-gray-700 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-600">
          {sortedSignatures.map((signature, index) => (
            <li key={signature.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition duration-150">
              <div className="flex flex-col">
                <span className="font-medium text-gray-800 dark:text-gray-200">{signature.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  الصفة: {signature.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => moveSignatureUp(index)}
                  disabled={index === 0}
                  className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="تحريك لأعلى"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                  </svg>
                </button>
                <button
                  onClick={() => moveSignatureDown(index)}
                  disabled={index === sortedSignatures.length - 1}
                  className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="تحريك لأسفل"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                <button
                  onClick={() => handleEditSignature(signature)}
                  className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150"
                  title="تعديل التوقيع"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteSignature(signature.id)}
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-150"
                  title="حذف التوقيع"
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

export default SignaturesManagement;
