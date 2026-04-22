import React from 'react';
import UserManagement from '../components/settings/UserManagement';

/**
 * المكون الرئيسي لعرض إدارة المستخدمين
 */
export default function UserManagementView({ users, setUsers, currentUser }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mb-4">
          👥 إدارة المستخدمين والصلاحيات
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          إدارة المستخدمين وتحديد صلاحياتهم في النظام
        </p>
      </div>

      <UserManagement users={users} setUsers={setUsers} currentUser={currentUser} />
    </div>
  );
}
