import React, { useState, useEffect } from 'react';

export default function DataManagement() {
    const [backupPath, setBackupPath] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [autoBackupTime, setAutoBackupTime] = useState('02:00');
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);

    // تحميل مسار النسخ الاحتياطي وإعدادات النسخ التلقائي عند تحميل المكون
    useEffect(() => {
        const loadSettings = async () => {
            try {
                if (window.electronAPI) {
                    // تحميل مسار النسخ الاحتياطي
                    const backupResult = await window.electronAPI.getBackupPath();
                    if (backupResult.status === 'success') {
                        setBackupPath(backupResult.path || '');
                    }

                    // تحميل إعدادات النسخ التلقائي
                    const autoBackupResult = await window.electronAPI.getAutoBackupSettings();
                    if (autoBackupResult.status === 'success' && autoBackupResult.settings) {
                        setAutoBackupTime(autoBackupResult.settings.time || '02:00');
                        setAutoBackupEnabled(autoBackupResult.settings.enabled || false);
                    }
                }
            } catch (error) {
                console.error('خطأ في تحميل الإعدادات:', error);
            }
        };
        loadSettings();
    }, []);

    const handleSelectBackupPath = async () => {
        try {
            if (!window.electronAPI) {
                alert('واجهة Electron غير متوفرة. يرجى تشغيل التطبيق من خلال Electron.');
                return;
            }

            if (!window.electronAPI.selectBackupPath) {
                alert('طريقة اختيار المجلد غير متوفرة في واجهة Electron. يرجى التحقق من إعدادات التطبيق.');
                console.error('selectBackupPath method not found in window.electronAPI');
                return;
            }

            const result = await window.electronAPI.selectBackupPath();

            if (!result) {
                alert('لم يتم استلام رد من عملية اختيار المجلد.');
                return;
            }

            if (result.status === 'success' && result.path) {
                setBackupPath(result.path);
                // حفظ المسار في الإعدادات
                if (window.electronAPI.setBackupPath) {
                    await window.electronAPI.setBackupPath(result.path);
                }
                alert('تم تحديد مجلد النسخ الاحتياطي بنجاح!');
            } else if (result.status === 'cancelled') {
                // المستخدم ألغى العملية، لا نحتاج لإظهار رسالة خطأ
                console.log('User cancelled folder selection');
            } else {
                alert('فشل في اختيار المجلد: ' + (result.message || 'خطأ غير معروف'));
            }
        } catch (error) {
            console.error('خطأ في اختيار مجلد النسخ الاحتياطي:', error);
            alert('حدث خطأ أثناء اختيار المجلد: ' + (error.message || 'خطأ غير معروف'));
        }
    };

    const handleExportData = async () => {
        // إذا لم يتم تحديد مجلد، اقترح تحديده أولاً
        if (!backupPath) {
            const shouldSelectPath = confirm('لم يتم تحديد مجلد النسخ الاحتياطي. هل تريد تحديده الآن؟');
            if (shouldSelectPath) {
                await handleSelectBackupPath();
                // إذا تم تحديد المجلد بنجاح، استمر في التصدير
                if (backupPath) {
                    // استمر في التصدير
                } else {
                    return; // إلغاء العملية
                }
            } else {
                return; // إلغاء العملية
            }
        }

        setIsLoading(true);
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.exportData(backupPath);
                if (result.status === 'success') {
                    alert('تم تصدير البيانات بنجاح إلى: ' + backupPath);
                } else {
                    alert('فشل في تصدير البيانات: ' + result.message);
                }
            } else {
                alert('واجهة Electron غير متوفرة. يرجى تشغيل التطبيق من خلال Electron.');
            }
        } catch (error) {
            console.error('خطأ في تصدير البيانات:', error);
            alert('حدث خطأ أثناء تصدير البيانات.');
        }
        setIsLoading(false);
    };

    const handleImportData = async () => {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.importData();
                if (result.status === 'success') {
                    alert('تم استيراد البيانات بنجاح! يرجى إعادة تحميل التطبيق.');
                    window.location.reload();
                } else {
                    alert('فشل في استيراد البيانات: ' + result.message);
                }
            } else {
                alert('واجهة Electron غير متوفرة. يرجى تشغيل التطبيق من خلال Electron.');
            }
        } catch (error) {
            console.error('خطأ في استيراد البيانات:', error);
            alert('حدث خطأ أثناء استيراد البيانات.');
        }
    };

    const handleSaveAutoBackupSettings = async () => {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.saveAutoBackupSettings({
                    time: autoBackupTime,
                    enabled: autoBackupEnabled,
                });
                if (result.status === 'success') {
                    alert('تم حفظ إعدادات النسخ الاحتياطي التلقائي بنجاح');
                } else {
                    alert('فشل في حفظ الإعدادات: ' + result.message);
                }
            } else {
                alert('واجهة Electron غير متوفرة. يرجى تشغيل التطبيق من خلال Electron.');
            }
        } catch (error) {
            console.error('خطأ في حفظ الإعدادات:', error);
            alert('حدث خطأ أثناء حفظ الإعدادات');
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="text-center">
                <h1 className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mb-4">
                    💾 التخزين والنسخ الاحتياطي
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    إدارة البيانات وإنشاء نسخ احتياطية لقاعدة البيانات
                </p>
            </div>

            {/* تحديد مجلد النسخ الاحتياطي */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-4">📁 مجلد النسخ الاحتياطي</h4>
                <div className="flex items-center gap-4 mb-4">
                    <input
                        type="text"
                        value={backupPath}
                        readOnly
                        placeholder="لم يتم تحديد مجلد بعد..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark"
                    />
                    <button
                        onClick={handleSelectBackupPath}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
                    >
                        اختر المجلد
                    </button>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                    يرجى تحديد مجلد آمن لحفظ النسخ الاحتياطية. سيتم حفظ جميع النسخ في هذا المجلد.
                </p>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-lg space-y-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4">
                    إدارة البيانات (SQLite)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* تصدير البيانات */}
                    <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-4">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">تصدير البيانات</h4>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            قم بتصدير ملف قاعدة البيانات للنسخ الاحتياطي.
                        </p>
                        <button
                            onClick={handleExportData}
                            className="w-full bg-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200 shadow-md flex items-center justify-center"
                        >
                            📥 تصدير البيانات
                        </button>
                    </div>

                    {/* استيراد البيانات */}
                    <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mr-4">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                                </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">استيراد البيانات</h4>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            قم باستيراد البيانات من ملف قاعدة البيانات محفوظ سابقاً.
                        </p>
                        <button
                            onClick={handleImportData}
                            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-md flex items-center justify-center"
                        >
                            ↩️ استيراد البيانات
                        </button>
                    </div>
                </div>

                {/* النسخ الاحتياطي التلقائي */}
                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
                    <h4 className="text-lg font-semibold text-purple-800 dark:text-purple-200 mb-4">⏰ النسخ الاحتياطي التلقائي</h4>
                    <div className="space-y-4">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="autoBackupEnabled"
                                checked={autoBackupEnabled}
                                onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                                className="mr-2"
                            />
                            <label htmlFor="autoBackupEnabled" className="text-sm text-purple-700 dark:text-purple-300">
                                تفعيل النسخ الاحتياطي التلقائي
                            </label>
                        </div>
                        <div className="flex items-center gap-4">
                            <label htmlFor="autoBackupTime" className="text-sm text-purple-700 dark:text-purple-300">
                                وقت النسخ الاحتياطي:
                            </label>
                            <input
                                type="time"
                                id="autoBackupTime"
                                value={autoBackupTime}
                                onChange={(e) => setAutoBackupTime(e.target.value)}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark"
                                disabled={!autoBackupEnabled}
                            />
                        </div>
                        <button
                            onClick={handleSaveAutoBackupSettings}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200"
                        >
                            حفظ الإعدادات
                        </button>
                    </div>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-4">
                        سيتم إجراء النسخ الاحتياطي تلقائياً في الوقت المحدد يومياً إذا كان التطبيق مفتوحاً.
                    </p>
                </div>

                <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <div className="flex items-start">
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                        </svg>
                        <div>
                            <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">تنبيه هام</h5>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                عند استيراد البيانات، سيتم استبدال جميع البيانات الحالية. تأكد من إنشاء نسخة احتياطية أولاً.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
