import React, { useState } from 'react';
import apiClient from '../../api';
import { hasPermission } from '../../utils/permissions';

export default function UserManagement({ users, setUsers, currentUser }) {
    // حالة المستخدم الجديد أو المعدل
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        role: 'user', // 'admin' أو 'user'
        permissions: {
            collections: 'edit', // 'view', 'edit', 'none'
            reports: 'view',
            setup: 'none',
            userManagement: 'none', // صلاحية إدارة المستخدمين
            data: 'none', // صلاحية التخزين والنسخ الاحتياطي
        },
    });

    // حالة لتحديد ما إذا كنا في وضع التعديل
    const [editingUserId, setEditingUserId] = useState(null);

    // حالة لتأكيد كلمة المرور
    const [confirmPassword, setConfirmPassword] = useState('');

    // دالة تحديث اسم المستخدم
    const handleUsernameChange = (e) => {
        setNewUser(prev => ({
            ...prev,
            username: e.target.value,
        }));
    };

    // دالة تحديث كلمة المرور
    const handlePasswordChange = (e) => {
        setNewUser(prev => ({
            ...prev,
            password: e.target.value,
        }));
    };

    // دالة تحديث تأكيد كلمة المرور
    const handleConfirmPasswordChange = (e) => {
        setNewUser(prev => ({
            ...prev,
            confirmPassword: e.target.value,
        }));
    };

    // دالة تحديث الدور
    const handleRoleChange = (e) => {
        const newRole = e.target.value;
        setNewUser(prev => ({
            ...prev,
            role: newRole,
            permissions: newRole === 'admin' ? {
                collections: 'edit',
                reports: 'edit',
                setup: 'edit',
                userManagement: 'edit',
                data: 'edit',
            } : prev.permissions,
        }));
    };

    // دالة تحديث الصلاحيات
    const handlePermissionChange = (section, permission) => {
        setNewUser(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [section]: permission,
            },
        }));
    };

    // دالة إضافة أو تحديث المستخدم
    const handleAddUser = async () => {
        if (!newUser.username.trim()) {
            alert("الرجاء إدخال اسم المستخدم.");
            return;
        }

        if (!newUser.password.trim() && !editingUserId) {
            alert("الرجاء إدخال كلمة المرور.");
            return;
        }

        if (!editingUserId && newUser.password !== newUser.confirmPassword) {
            alert("كلمة المرور وتأكيد كلمة المرور غير متطابقين.");
            return;
        }

        try {
            if (editingUserId) {
                // تحديث المستخدم الموجود
                const updatedUser = await apiClient.updateUser(editingUserId, {
                    username: newUser.username.trim(),
                    role: newUser.role,
                    permissions: { ...newUser.permissions },
                    ...(newUser.password.trim() && { password: newUser.password.trim() }),
                });

                setUsers(prevUsers =>
                    prevUsers.map(user =>
                        user.id === editingUserId
                            ? { ...user, ...updatedUser }
                            : user
                    )
                );
                setEditingUserId(null);
            } else {
                // إضافة مستخدم جديد
                const userToAdd = {
                    username: newUser.username.trim(),
                    password: newUser.password.trim(),
                    role: newUser.role,
                    permissions: { ...newUser.permissions },
                };
                const createdUser = await apiClient.createUser(userToAdd);
                setUsers(prevUsers => [...prevUsers, createdUser]);
            }

            setNewUser({
                username: '',
                password: '',
                confirmPassword: '',
                role: 'user',
                permissions: {
                    collections: 'edit',
                    reports: 'view',
                    setup: 'none',
                    userManagement: 'none',
                    data: 'none',
                },
            });
        } catch (error) {
            console.error('Error saving user:', error);
            alert('حدث خطأ أثناء حفظ المستخدم. يرجى المحاولة مرة أخرى.');
        }
    };

    // دالة حذف المستخدم
    const handleDeleteUser = async (id) => {
        if (id === currentUser?.id) {
            alert("لا يمكنك حذف حسابك الخاص.");
            return;
        }

        const confirmed = window.confirm("هل أنت متأكد من رغبتك في حذف هذا المستخدم؟ هذا الإجراء لا يمكن التراجع عنه.");
        if (confirmed) {
            try {
                await apiClient.deleteUser(id);
                setUsers(prevUsers => prevUsers.filter(user => user.id !== id));
            } catch (error) {
                console.error('Error deleting user:', error);
                alert('حدث خطأ أثناء حذف المستخدم. يرجى المحاولة مرة أخرى.');
            }
        }
    };

    // دالة الحصول على اسم الصلاحية بالعربية
    const getPermissionLabel = (permission) => {
        switch (permission) {
            case 'view': return 'مشاهدة فقط';
            case 'edit': return 'تعديل';
            case 'none': return 'غير مسموح';
            default: return permission;
        }
    };

    return (
        <div className="space-y-8 animate-slide-in-up">
            <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 border-b pb-2">
                إدارة المستخدمين والصلاحيات
            </h3>

            {/* نموذج إضافة مستخدم جديد */}
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg space-y-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">
                    {editingUserId ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
                </h4>

                {/* حقل اسم المستخدم */}
                <div>
                    <label htmlFor="username" className="block text-sm font-medium mb-1">اسم المستخدم</label>
                    <input type="text" name="username" id="username" value={newUser.username} onChange={handleUsernameChange}
                        placeholder="مثال: ahmed123"
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500" />
                </div>

                {/* حقل كلمة المرور */}
                <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-1">
                        كلمة المرور {editingUserId && '(اتركه فارغاً للاحتفاظ بالكلمة الحالية)'}
                    </label>
                    <input type="password" name="password" id="password" value={newUser.password} onChange={handlePasswordChange}
                        placeholder="أدخل كلمة مرور قوية"
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500" />
                </div>

                {/* حقل تأكيد كلمة المرور */}
                {!editingUserId && (
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">تأكيد كلمة المرور</label>
                        <input type="password" name="confirmPassword" id="confirmPassword" value={newUser.confirmPassword} onChange={handleConfirmPasswordChange}
                            placeholder="أعد إدخال كلمة المرور"
                            className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500" />
                    </div>
                )}

                {/* اختيار الدور */}
                <div>
                    <label htmlFor="role" className="block text-sm font-medium mb-1">الدور</label>
                    <select name="role" id="role" value={newUser.role} onChange={handleRoleChange}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500">
                        <option value="user">مستخدم</option>
                        <option value="admin">مدير</option>
                    </select>
                </div>

                {/* إعدادات الصلاحيات */}
                {newUser.role !== 'admin' && (
                    <div className="space-y-3">
                        <h5 className="text-md font-medium text-text-light dark:text-text-dark">تحديد الصلاحيات:</h5>

                        {/* صلاحية التحصيلات */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="font-medium text-gray-800 dark:text-gray-200">تسجيل الإيرادات</span>
                            <select
                                value={newUser.permissions.collections}
                                onChange={(e) => handlePermissionChange('collections', e.target.value)}
                                className="w-32 p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-blue-500"
                            >
                                <option value="none">غير مسموح</option>
                                <option value="view">مشاهدة فقط</option>
                                <option value="edit">تعديل</option>
                            </select>
                        </div>

                        {/* صلاحية التقارير */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="font-medium text-gray-800 dark:text-gray-200">التقارير</span>
                            <select
                                value={newUser.permissions.reports}
                                onChange={(e) => handlePermissionChange('reports', e.target.value)}
                                className="w-32 p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-blue-500"
                            >
                                <option value="none">غير مسموح</option>
                                <option value="view">مشاهدة فقط</option>
                                <option value="edit">تعديل</option>
                            </select>
                        </div>

                        {/* صلاحية إعداد النظام */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="font-medium text-gray-800 dark:text-gray-200">إعداد النظام</span>
                            <select
                                value={newUser.permissions.setup}
                                onChange={(e) => handlePermissionChange('setup', e.target.value)}
                                className="w-32 p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-blue-500"
                            >
                                <option value="none">غير مسموح</option>
                                <option value="view">مشاهدة فقط</option>
                                <option value="edit">تعديل</option>
                            </select>
                        </div>

                        {/* صلاحية إدارة المستخدمين */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="font-medium text-gray-800 dark:text-gray-200">إدارة المستخدمين</span>
                            <select
                                value={newUser.permissions.userManagement}
                                onChange={(e) => handlePermissionChange('userManagement', e.target.value)}
                                className="w-32 p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-blue-500"
                            >
                                <option value="none">غير مسموح</option>
                                <option value="view">مشاهدة فقط</option>
                                <option value="edit">تعديل</option>
                            </select>
                        </div>

                        {/* صلاحية التخزين والنسخ الاحتياطي */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="font-medium text-gray-800 dark:text-gray-200">التخزين والنسخ الاحتياطي</span>
                            <select
                                value={newUser.permissions.data}
                                onChange={(e) => handlePermissionChange('data', e.target.value)}
                                className="w-32 p-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 focus:ring-blue-500"
                            >
                                <option value="none">غير مسموح</option>
                                <option value="view">مشاهدة فقط</option>
                                <option value="edit">تعديل</option>
                            </select>
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <button onClick={handleAddUser}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-md flex items-center justify-center">
                        {editingUserId ? 'تحديث المستخدم' : '+ إضافة المستخدم'}
                    </button>
                    {editingUserId && (
                        <button onClick={() => {
                            setEditingUserId(null);
                            setNewUser({
                                username: '',
                                password: '',
                                role: 'user',
                                permissions: {
                                    collections: 'edit',
                                    reports: 'view',
                                    setup: 'none',
                                    userManagement: 'none',
                                    data: 'none',
                                },
                            });
                        }}
                            className="bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition duration-200 shadow-md">
                            إلغاء
                        </button>
                    )}
                </div>
            </div>

            {/* قائمة المستخدمين الحاليين */}
            <div className="space-y-3 pt-4">
                <h4 className="text-lg font-semibold text-text-light dark:text-text-dark">المستخدمون الحاليون ({users.length}):</h4>
                <ul className="bg-white dark:bg-gray-700 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-600">
                    {users.map((user) => (
                        <li key={user.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition duration-150">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                        {user.username} {user.id === currentUser?.id && '(أنت)'}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        الدور: {user.role === 'admin' ? 'مدير' : 'مستخدم'} |
                                        تاريخ الإنشاء: {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                                    </span>
                                    {user.role === 'admin' ? (
                                        <div className="mt-2">
                                            <span className="inline-block bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs">
                                                جميع الصلاحيات
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="mt-2 space-y-1">
                                            <span className="inline-block bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs mr-2 mb-1">
                                                التحصيلات: {getPermissionLabel((user.permissions || {}).collections)}
                                            </span>
                                            <span className="inline-block bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs mr-2 mb-1">
                                                التقارير: {getPermissionLabel((user.permissions || {}).reports)}
                                            </span>
                                            <span className="inline-block bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs mr-2 mb-1">
                                                إعداد النظام: {getPermissionLabel((user.permissions || {}).setup)}
                                            </span>
                                            <span className="inline-block bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs mr-2 mb-1">
                                                إدارة المستخدمين: {getPermissionLabel((user.permissions || {}).userManagement)}
                                            </span>
                                            <span className="inline-block bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs mr-2 mb-1">
                                                التخزين والنسخ الاحتياطي: {getPermissionLabel((user.permissions || {}).data)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                <div className="flex gap-1">
                                    {hasPermission(currentUser, 'users', 'edit') && (
                                        <button
                                            onClick={() => {
                                                const userToEdit = users.find(u => u.id === user.id);
                                                setEditingUserId(user.id);
                                                setNewUser({
                                                    username: userToEdit.username,
                                                    password: '',
                                                    role: userToEdit.role,
                                                    permissions: { ...(userToEdit.permissions || {}) },
                                                });
                                            }}
                                            className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full transition duration-150"
                                            title="تعديل المستخدم"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                            </svg>
                                        </button>
                                    )}
                                    {user.id !== currentUser?.id && hasPermission(currentUser, 'users', 'delete') && (
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded-full transition duration-150"
                                            title="حذف المستخدم"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
