//constants/index.ts
export * from './achievements';
export * from './colors';
export * from './chat';

export const CHAT_MESSAGE_PAGE_SIZE = 20;
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

console.log('✅ Constants loaded');
