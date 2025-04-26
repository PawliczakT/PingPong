// AuthStore disabled: authentication logic removed for simplicity






// AuthStore disabled: no authentication required
export const useAuthStore = () => ({
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  isLoading: false,
  isInitialized: true,
  user: null,
  error: null,
  clearError: () => {},
});