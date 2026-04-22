import React from 'react';
import apiClient from '../../api';

/**
 * مكون إعدادات المؤسسة الأساسية
 */
const BasicSettings = ({ config, setConfig }) => {
  const handleInputChange = async (field, value) => {
    const updatedConfig = {
      ...config,
      [field]: value
    };

    console.log('تحديث الحقل:', field, 'القيمة:', value);
    console.log('البيانات المرسلة:', updatedConfig);

    // تحديث الحالة المحلية فورًا
    setConfig(updatedConfig);

    // حفظ البيانات في قاعدة البيانات تلقائيًا
    try {
      const result = await apiClient.updateConfig(updatedConfig);
      console.log('تم حفظ البيانات بنجاح:', result);
    } catch (error) {
      console.error('فشل في حفظ إعدادات المؤسسة:', error);
      // يمكن إضافة إشعار للمستخدم هنا إذا لزم الأمر
    }
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange('universityLogo', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFacultyLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange('facultyLogo', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">معلومات الجامعة</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              اسم الجامعة
            </label>
            <input
              type="text"
              value={config.universityName || ''}
              onChange={(e) => handleInputChange('universityName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="أدخل اسم الجامعة"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              شعار الجامعة
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">معلومات الكلية/القسم</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              اسم الكلية/القسم
            </label>
            <input
              type="text"
              value={config.facultyName || ''}
              onChange={(e) => handleInputChange('facultyName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="أدخل اسم الكلية أو القسم"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              شعار الكلية/القسم
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFacultyLogoUpload}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicSettings;
