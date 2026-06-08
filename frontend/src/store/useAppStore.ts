import { create } from 'zustand';
import { 
  User, Group, GroupDetail, OptimizedTransaction, Notification 
} from '../types/index';
import { authService, groupService, settlementService } from '../services/api';

interface AppState {
  // Auth state
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // App UI state
  loading: boolean;
  isDarkMode: boolean;
  notifications: Notification[];

  // Data state
  groups: Group[];
  activeGroup: GroupDetail | null;
  optimizedSettlements: OptimizedTransaction[];

  // Auth Actions
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  loadProfile: () => Promise<void>;
  
  // Group Actions
  fetchGroups: () => Promise<void>;
  fetchGroupDetail: (id: string) => Promise<void>;
  createGroup: (name: string, description: string, currency: string) => Promise<void>;
  addMember: (groupId: string, email: string) => Promise<string>;
  deleteGroup: (groupId: string) => Promise<void>;
  
  // Settlement Actions
  fetchOptimizedSettlements: (groupId: string) => Promise<void>;
  recordSettlement: (groupId: string, fromId: string, toId: string, amount: number) => Promise<void>;

  // UI Actions
  toggleDarkMode: (force?: boolean) => void;
  markNotificationsRead: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => {
  // Initial Theme load
  const storedTheme = localStorage.getItem('smartexpense_dark');
  const initialDark = storedTheme ? storedTheme === 'true' : true; // Default to Dark mode for premium feel!
  
  // Set html class on startup
  if (typeof window !== 'undefined') {
    if (initialDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  const storedUser = localStorage.getItem('smartexpense_user');
  const storedToken = localStorage.getItem('smartexpense_token');

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken || null,
    isAuthenticated: !!storedToken,
    loading: false,
    isDarkMode: initialDark,
    notifications: [],
    groups: [],
    activeGroup: null,
    optimizedSettlements: [],

    setAuth: (token, user) => {
      localStorage.setItem('smartexpense_token', token);
      localStorage.setItem('smartexpense_user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },

    clearAuth: () => {
      localStorage.removeItem('smartexpense_token');
      localStorage.removeItem('smartexpense_user');
      set({ token: null, user: null, isAuthenticated: false, groups: [], activeGroup: null });
    },

    loadProfile: async () => {
      try {
        const data = await authService.getProfile();
        if (data.success) {
          set({ 
            user: {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              createdAt: data.user.createdAt
            },
            notifications: data.user.notifications || []
          });
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      }
    },

    fetchGroups: async () => {
      set({ loading: true });
      try {
        const data = await groupService.getGroups();
        if (data.success) {
          set({ groups: data.groups });
        }
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      } finally {
        set({ loading: false });
      }
    },

    fetchGroupDetail: async (id) => {
      set({ loading: true });
      try {
        const data = await groupService.getGroupDetail(id);
        if (data.success) {
          set({ activeGroup: data.group });
        }
      } catch (err) {
        console.error(`Failed to fetch group detail for ${id}:`, err);
        set({ activeGroup: null });
      } finally {
        set({ loading: false });
      }
    },

    createGroup: async (name, description, currency) => {
      try {
        const data = await groupService.createGroup({ name, description, currency });
        if (data.success) {
          await get().fetchGroups();
        }
      } catch (err) {
        console.error('Failed to create group:', err);
        throw err;
      }
    },

    addMember: async (groupId, email) => {
      try {
        const data = await groupService.addMember(groupId, email);
        if (data.success) {
          await get().fetchGroupDetail(groupId);
          return data.message;
        }
        return 'Member added';
      } catch (err: any) {
        console.error('Failed to add member:', err);
        const errMsg = err.response?.data?.message || 'Failed to add member';
        throw new Error(errMsg, { cause: err });
      }
    },

    deleteGroup: async (groupId) => {
      try {
        const data = await groupService.deleteGroup(groupId);
        if (data.success) {
          await get().fetchGroups();
          if (get().activeGroup?.id === groupId) {
            set({ activeGroup: null });
          }
        }
      } catch (err) {
        console.error('Failed to delete group:', err);
        throw err;
      }
    },

    fetchOptimizedSettlements: async (groupId) => {
      try {
        const data = await settlementService.getOptimizedSettlements(groupId);
        if (data.success) {
          set({ optimizedSettlements: data.optimizedSettlements });
        }
      } catch (err) {
        console.error('Failed to fetch optimized settlements:', err);
      }
    },

    recordSettlement: async (groupId, fromId, toId, amount) => {
      try {
        const data = await settlementService.createSettlement(groupId, { fromId, toId, amount });
        if (data.success) {
          await get().fetchGroupDetail(groupId);
          await get().fetchOptimizedSettlements(groupId);
        }
      } catch (err) {
        console.error('Failed to record settlement:', err);
        throw err;
      }
    },

    toggleDarkMode: (force) => {
      set((state) => {
        const newValue = force !== undefined ? force : !state.isDarkMode;
        localStorage.setItem('smartexpense_dark', String(newValue));
        if (typeof window !== 'undefined') {
          if (newValue) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        return { isDarkMode: newValue };
      });
    },

    markNotificationsRead: async () => {
      try {
        await authService.markNotificationsRead();
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true }))
        }));
      } catch (err) {
        console.error('Failed to mark notifications read:', err);
      }
    },

    setLoading: (loading) => set({ loading }),
  };
});
