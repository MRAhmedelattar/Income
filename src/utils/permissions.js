export const canAccessView = (user, view) => {
  if (!user) return false;

  const permissions = {
    'home': ['admin', 'manager', 'user'],
    'collections': ['admin', 'manager', 'user'],
    'reports/receipts': ['admin', 'manager', 'user'],
    'reports/funds': ['admin', 'manager', 'user'],
    'reports/budget': ['admin', 'manager', 'user'],
    'reports/collection-items': ['admin', 'manager', 'user'],
    'reports/revenues': ['admin', 'manager', 'user'],
    'settings/basic': ['admin'],
    'settings/revenue': ['admin'],
    'settings/items': ['admin'],
    'settings/funds': ['admin'],
    'settings/deductions': ['admin'],
    'settings/budget-items': ['admin'],
    'settings/budget-deductions': ['admin'],
    'settings/signatures': ['admin'],
    'users': ['admin'],
    'data': ['admin'],
  };

  return permissions[view]?.includes(user.role) || false;
};

export const hasPermission = (user, resource, action) => {
  if (!user) return false;

  const rolePermissions = {
    admin: {
      collections: ['create', 'read', 'update', 'delete', 'edit'],
      reports: ['read'],
      settings: ['create', 'read', 'update', 'delete'],
      users: ['create', 'read', 'update', 'delete', 'edit'],
      data: ['create', 'read', 'update', 'delete'],
    },
    manager: {
      collections: ['create', 'read', 'update', 'edit'],
      reports: ['read'],
      settings: [],
      users: [],
      data: [],
    },
    user: {
      collections: ['create', 'read', 'edit'],
      reports: ['read'],
      settings: [],
      users: [],
      data: [],
    },
  };

  return rolePermissions[user.role]?.[resource]?.includes(action) || false;
};
