import React from 'react';

export default function BackupOnExitModal({ isVisible, onConfirm, onCancel, onSkip }) {
    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 ease-in-out">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-lg w-full mx-4 transform transition-all duration-300 ease-in-out scale-95 hover:scale-100">
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-blue-100 dark:bg-blue-900 mb-6">
                        <svg className="h-16 w-16 text-blue-600 dark:text-blue-400" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
                        هل تريد إنشاء نسخة احتياطية؟
                    </h3>
                    <p className="text-md text-gray-500 dark:text-gray-400 mb-8">
                        يُنصح دائماً بإنشاء نسخة احتياطية قبل إغلاق البرنامج لحماية بياناتك.
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <button
                        onClick={onConfirm}
                        className="w-full flex items-center justify-center px-6 py-4 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 focus:outline-none focus:ring-4 focus:ring-green-300 dark:focus:ring-green-800 transition duration-300 ease-in-out transform hover:-translate-y-1"
                    >
                        <svg className="w-6 h-6 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>نعم، قم بالنسخ ثم الإغلاق</span>
                    </button>
                    <button
                        onClick={onSkip}
                        className="w-full flex items-center justify-center px-6 py-4 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-300 dark:focus:ring-red-800 transition duration-300 ease-in-out transform hover:-translate-y-1"
                    >
                        <svg className="w-6 h-6 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>لا، أغلق مباشرة</span>
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full px-6 py-4 bg-transparent text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600 transition duration-300 ease-in-out"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
}