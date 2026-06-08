import axios from 'axios';
import { 
  User, Group, GroupDetail, Expense, Settlement, 
  OptimizedTransaction, ParsedExpense 
} from '../types/index';

const API_BASE_URL = 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartexpense_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle Unauthorized Error
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear credentials and force reload or redirect if token expired
      localStorage.removeItem('smartexpense_token');
      localStorage.removeItem('smartexpense_user');
      // If we are in client browser, reload
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  register: async (data: any) => {
    const response = await api.post<{ success: boolean; token: string; user: User; message: string }>('/auth/register', data);
    return response.data;
  },
  login: async (data: any) => {
    const response = await api.post<{ success: boolean; token: string; user: User; message: string }>('/auth/login', data);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get<{ success: boolean; user: User & { notifications: any[] } }>('/auth/profile');
    return response.data;
  },
  markNotificationsRead: async () => {
    const response = await api.post<{ success: boolean }>('/auth/notifications/read');
    return response.data;
  },
};

export const groupService = {
  getGroups: async () => {
    const response = await api.get<{ success: boolean; groups: Group[] }>('/groups');
    return response.data;
  },
  createGroup: async (data: any) => {
    const response = await api.post<{ success: boolean; group: Group; message: string }>('/groups', data);
    return response.data;
  },
  getGroupDetail: async (id: string) => {
    const response = await api.get<{ success: boolean; group: GroupDetail }>(`/groups/${id}`);
    return response.data;
  },
  deleteGroup: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/groups/${id}`);
    return response.data;
  },
  addMember: async (groupId: string, email: string) => {
    const response = await api.post<{ success: boolean; user: User; message: string }>(`/groups/${groupId}/members`, { email });
    return response.data;
  },
};

export const expenseService = {
  getExpenses: async (params?: { groupId?: string; memberId?: string }) => {
    const response = await api.get<{ success: boolean; expenses: Expense[] }>('/expenses', { params });
    return response.data;
  },
  createExpense: async (data: any) => {
    const response = await api.post<{ success: boolean; expense: Expense; message: string }>('/expenses', data);
    return response.data;
  },
  updateExpense: async (id: string, data: any) => {
    const response = await api.put<{ success: boolean; expense: Expense; message: string }>(`/expenses/${id}`, data);
    return response.data;
  },
  deleteExpense: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/expenses/${id}`);
    return response.data;
  },
};

export const settlementService = {
  getOptimizedSettlements: async (groupId: string) => {
    const response = await api.get<{ 
      success: boolean; 
      currency: string; 
      balances: any[]; 
      optimizedSettlements: OptimizedTransaction[] 
    }>(`/settlements/${groupId}`);
    return response.data;
  },
  createSettlement: async (groupId: string, data: { fromId: string; toId: string; amount: number }) => {
    const response = await api.post<{ success: boolean; settlement: Settlement; message: string }>(`/settlements/${groupId}`, data);
    return response.data;
  },
};

export const aiService = {
  parseExpense: async (text: string, groupId?: string) => {
    const response = await api.post<{ success: boolean; parsed: ParsedExpense }>('/ai/parse-expense', { text, groupId });
    return response.data;
  },
};

export default api;
export { api };
