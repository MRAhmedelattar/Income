// src/components/LogoPreview.jsx
import React from 'react';

/**
 * مكون لعرض الشعار أو أيقونة افتراضية
 */
const LogoPreview = ({ logoUrl, Icon }) => (
  <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-gray-300 dark:border-gray-600">
    {logoUrl ? (
      <img src={logoUrl} alt="الشعار" className="w-full h-full object-cover" />
    ) : (
      <Icon className="w-12 h-12 text-gray-500" />
    )}
  </div>
);

export default LogoPreview;