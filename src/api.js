// API client for communicating with the backend server

const API_BASE_URL = 'http://localhost:3001';

// دالة معالجة البيانات الرقمية لضمان التوافق الإقليمي
const normalizeRevenueData = (revenue) => {
  if (!revenue) return revenue;
  
  return {
    ...revenue,
    itemValues: revenue.itemValues ? 
      Object.entries(revenue.itemValues).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'number' ? value : parseFloat(value) || 0;
        return acc;
      }, {})
      : revenue.itemValues,
  };
};

const normalizeCollectionData = (collection) => {
  if (!collection) return collection;
  
  return {
    ...collection,
    total: typeof collection.total === 'number' ? collection.total : parseFloat(collection.total) || 0,
    distribution: collection.distribution ? 
      collection.distribution.map(item => ({
        ...item,
        amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0,
      }))
      : collection.distribution,
  };
};

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        // Try to get more details from the response body
        const errorBody = await response.json().catch(() => null);
        const errorMessage = errorBody ? JSON.stringify(errorBody, null, 2) : `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Config endpoints
  async getConfig() {
    return this.request('/api/config');
  }

  async updateConfig(config) {
    return this.request('/api/config', {
      method: 'POST',
      body: config,
    });
  }

  // Funds endpoints
  async getFunds() {
    return this.request('/api/funds');
  }

  async createFund(fund) {
    return this.request('/api/funds', {
      method: 'POST',
      body: fund,
    });
  }

  async updateFund(id, fund) {
    return this.request(`/api/funds/${id}`, {
      method: 'PUT',
      body: fund,
    });
  }

  async deleteFund(id) {
    return this.request(`/api/funds/${id}`, {
      method: 'DELETE',
    });
  }

  // Items endpoints
  async getItems() {
    return this.request('/api/items');
  }

  async createItem(item) {
    return this.request('/api/items', {
      method: 'POST',
      body: item,
    });
  }

  async updateItem(id, item) {
    return this.request(`/api/items/${id}`, {
      method: 'PUT',
      body: item,
    });
  }

  async deleteItem(id) {
    return this.request(`/api/items/${id}`, {
      method: 'DELETE',
    });
  }

  // Revenues endpoints
  async getRevenues() {
    const revenues = await this.request('/api/revenues');
    // تطبيع البيانات الرقمية عند الاستقبال
    return Array.isArray(revenues) ? revenues.map(normalizeRevenueData) : revenues;
  }

  async createRevenue(revenue) {
    const result = await this.request('/api/revenues', {
      method: 'POST',
      body: revenue,
    });
    return normalizeRevenueData(result);
  }

  async updateRevenue(id, revenue) {
    const result = await this.request(`/api/revenues/${id}`, {
      method: 'PUT',
      body: revenue,
    });
    return normalizeRevenueData(result);
  }

  async deleteRevenue(id) {
    return this.request(`/api/revenues/${id}`, {
      method: 'DELETE',
    });
  }

  // Collections endpoints
  async getCollections() {
    const collections = await this.request('/api/collections');
    // تطبيع البيانات الرقمية عند الاستقبال
    return Array.isArray(collections) ? collections.map(normalizeCollectionData) : collections;
  }

  async createCollection(collection) {
    const result = await this.request('/api/collections', {
      method: 'POST',
      body: collection,
    });
    return normalizeCollectionData(result);
  }

  async updateCollection(id, collection) {
    const result = await this.request(`/api/collections/${id}`, {
      method: 'PUT',
      body: collection,
    });
    return normalizeCollectionData(result);
  }

  async deleteCollection(id) {
    return this.request(`/api/collections/${id}`, {
      method: 'DELETE',
    });
  }

  // Users endpoints
  async getUsers() {
    return this.request('/api/users');
  }

  async createUser(user) {
    return this.request('/api/users', {
      method: 'POST',
      body: user,
    });
  }

  async updateUser(id, user) {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: user,
    });
  }

  async deleteUser(id) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Deductions endpoints
  async getDeductions() {
    return this.request('/api/deductions');
  }

  async createDeduction(deduction) {
    return this.request('/api/deductions', {
      method: 'POST',
      body: deduction,
    });
  }

  async updateDeduction(id, deduction) {
    return this.request(`/api/deductions/${id}`, {
      method: 'PUT',
      body: deduction,
    });
  }

  async deleteDeduction(id) {
    return this.request(`/api/deductions/${id}`, {
      method: 'DELETE',
    });
  }

  // Signatures endpoints
  async getSignatures() {
    return this.request('/api/signatures');
  }

  async createSignature(signature) {
    return this.request('/api/signatures', {
      method: 'POST',
      body: signature,
    });
  }

  async updateSignature(id, signature) {
    return this.request(`/api/signatures/${id}`, {
      method: 'PUT',
      body: signature,
    });
  }

  async deleteSignature(id) {
    return this.request(`/api/signatures/${id}`, {
      method: 'DELETE',
    });
  }

  // Budget Items endpoints
  async getBudgetItems() {
    return this.request('/api/budget-items');
  }

  async createBudgetItem(budgetItem) {
    return this.request('/api/budget-items', {
      method: 'POST',
      body: budgetItem,
    });
  }

  async updateBudgetItem(id, budgetItem) {
    return this.request(`/api/budget-items/${id}`, {
      method: 'PUT',
      body: budgetItem,
    });
  }

  async deleteBudgetItem(id) {
    return this.request(`/api/budget-items/${id}`, {
      method: 'DELETE',
    });
  }

  // Budget Deductions endpoints
  async getBudgetDeductions() {
    return this.request('/api/budget-deductions');
  }

  async createBudgetDeduction(budgetDeduction) {
    return this.request('/api/budget-deductions', {
      method: 'POST',
      body: budgetDeduction,
    });
  }

  async updateBudgetDeduction(id, budgetDeduction) {
    return this.request(`/api/budget-deductions/${id}`, {
      method: 'PUT',
      body: budgetDeduction,
    });
  }

  async deleteBudgetDeduction(id) {
    return this.request(`/api/budget-deductions/${id}`, {
      method: 'DELETE',
    });
  }

  // Authentication endpoints
  async login(credentials) {
    return this.request('/api/login', {
      method: 'POST',
      body: credentials,
    });
  }

  async logout() {
    return this.request('/api/logout', {
      method: 'POST',
    });
  }
}

// Create and export a singleton instance
const apiClient = new ApiClient();
export default apiClient;
