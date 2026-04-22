import React from 'react';
import { IconDollarSign, IconBarChart, IconSettings, IconUsers, IconDatabase, IconFileText } from '../components/Icons';

/**
 * صفحة الترحيب الرئيسية للتطبيق
 */
function Home({ currentUser }) {
  const features = [
    {
      icon: IconDollarSign,
      title: 'تسجيل الإيرادات',
      description: 'إدخال وإدارة التحصيلات المالية بسهولة ودقة.',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: IconBarChart,
      title: 'التقارير الشاملة',
      description: 'عرض إحصائيات مفصلة وتصدير التقارير بصيغ متعددة.',
      color: 'from-green-500 to-green-600'
    },
    {
      icon: IconSettings,
      title: 'إعدادات النظام',
      description: 'تخصيص الصناديق، البنود، والإيرادات حسب احتياجاتك.',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: IconUsers,
      title: 'إدارة المستخدمين',
      description: 'إضافة وإدارة المستخدمين مع صلاحيات متنوعة.',
      color: 'from-orange-500 to-orange-600'
    },
    {
      icon: IconDatabase,
      title: 'التخزين والنسخ الاحتياطي',
      description: 'حفظ آمن للبيانات مع إمكانية النسخ الاحتياطي.',
      color: 'from-red-500 to-red-600'
    },
    {
      icon: IconFileText,
      title: 'الوثائق والمساعدة',
      description: 'دليل شامل لاستخدام النظام بفعالية.',
      color: 'from-teal-500 to-teal-600'
    }
  ];

  return (
    <div className="space-y-8" dir="rtl">
      {/* رأس الصفحة الترحيبي */}
      <div className="text-center py-12 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-2xl text-white">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-5xl font-bold mb-4 animate-fade-in">
            مرحباً بك في نظام إدارة الإيرادات
          </h1>
          <p className="text-xl mb-8 opacity-90">
            نظام متكامل لإدارة التحصيلات المالية في المؤسسات التعليمية والإدارية
          </p>
          <div className="flex justify-center items-center gap-4 text-lg">
            <div className="flex items-center gap-2">
              <IconDollarSign className="w-6 h-6" />
              <span>إدارة مالية ذكية</span>
            </div>
            <div className="flex items-center gap-2">
              <IconBarChart className="w-6 h-6" />
              <span>تقارير شاملة</span>
            </div>
            <div className="flex items-center gap-2">
              <IconSettings className="w-6 h-6" />
              <span>سهولة في الاستخدام</span>
            </div>
          </div>
        </div>
      </div>

      {/* بطاقات الميزات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 mx-auto`}>
              <feature.icon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-center mb-3 text-text-light dark:text-text-dark">
              {feature.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center leading-relaxed">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* قسم الإحصائيات السريعة */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-3xl font-bold text-center mb-8 text-text-light dark:text-text-dark">
          نظرة سريعة على النظام
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              100%
            </div>
            <p className="text-gray-600 dark:text-gray-400">أمان البيانات</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
              24/7
            </div>
            <p className="text-gray-600 dark:text-gray-400">توافر النظام</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              ∞
            </div>
            <p className="text-gray-600 dark:text-gray-400">إمكانيات التوسع</p>
          </div>
        </div>
      </div>

      {/* رسالة ترحيبية للمستخدم */}
      <div className="bg-gradient-to-r from-green-400 to-blue-500 p-8 rounded-xl shadow-lg text-white text-center">
        <h3 className="text-2xl font-bold mb-4">
          مرحباً {currentUser?.name || 'المستخدم'}!
        </h3>
        <p className="text-lg opacity-90">
          أنت الآن في نظام إدارة الإيرادات المتقدم. ابدأ بتسجيل التحصيلات أو استعراض التقارير للحصول على أفضل النتائج.
        </p>
      </div>

      {/* نصائح سريعة */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-2xl font-bold mb-6 text-center text-text-light dark:text-text-dark">
          نصائح للبدء
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              1
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-text-light dark:text-text-dark">إعداد النظام</h4>
              <p className="text-gray-600 dark:text-gray-400">
                ابدأ بإعداد معلومات المؤسسة والصناديق والبنود من قسم الإعدادات.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              2
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-text-light dark:text-text-dark">تسجيل الإيرادات</h4>
              <p className="text-gray-600 dark:text-gray-400">
                استخدم صفحة تسجيل الإيرادات لإدخال التحصيلات الجديدة بدقة.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              3
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-text-light dark:text-text-dark">مراجعة التقارير</h4>
              <p className="text-gray-600 dark:text-gray-400">
                تحقق من التقارير الشهرية والسنوية لمتابعة الأداء المالي.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              4
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-text-light dark:text-text-dark">النسخ الاحتياطي</h4>
              <p className="text-gray-600 dark:text-gray-400">
                لا تنسَ عمل نسخ احتياطي دوري لبياناتك للحفاظ على سلامتها.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
