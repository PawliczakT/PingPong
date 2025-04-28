interface User {
    id: string;
    name: string;
    nickname: string;
    email: string;
}

interface AuthState {
    login: () => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    isInitialized: boolean;
    user: User | null;
    error: Error | null;
    clearError: () => void;
}

export const useAuthStore = (): AuthState => ({
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    isLoading: false,
    isInitialized: true,
    user: null,
    error: null,
    clearError: () => {
    },
});
