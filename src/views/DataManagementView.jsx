import React from 'react';
import DataManagement from '../components/settings/DataManagement';

/**
 * المكون الرئيسي لعرض التخزين والنسخ الاحتياطي
 */
export default function DataManagementView() {
  return (
    <div className="space-y-8 animate-fade-in">
      <DataManagement />
    </div>
  );
}
