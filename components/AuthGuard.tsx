// import React, {ReactNode, useEffect} from 'react';
// import {ActivityIndicator, StyleSheet, View} from 'react-native';
// import {useAuthStore} from '@/store/authStore';
// import {useRouter, useSegments} from 'expo-router';
// import {supabase} from "@/lib/supabase";
//
// interface AuthGuardProps {
//     children: ReactNode;
// }
//
// const publicPathsConfig = {
//     groups: ['auth'],
//     routes: ['stats', 'achievements'],
// };
//
// function isCurrentRoutePublic(segments: string[]): boolean {
//     if (segments.length === 0 || (segments.length === 1 && segments[0] === '')) {
//         return false;
//     }
//
//     if (segments[0] === 'auth' || segments.includes('auth')) {
//         return true;
//     }
//
//     if (publicPathsConfig.groups.includes(segments[0])) {
//         return true;
//     }
//
//     if (publicPathsConfig.routes.includes(segments[0])) {
//         return true;
//     }
//
//     return segments.length > 1 && publicPathsConfig.routes.includes(segments[1]);
// }
//
// export default function AuthGuard({children}: AuthGuardProps) {
//     const user = useAuthStore(state => state.user);
//     const isInitialized = useAuthStore(state => state.isInitialized);
//     const isLoading = useAuthStore(state => state.isLoading);
//     const [isCheckingProfile, setIsCheckingProfile] = React.useState(true);
//     const [needsProfileSetup, setNeedsProfileSetup] = React.useState(false);
//     const [hasTriedNavigation, setHasTriedNavigation] = React.useState(false);
//
//     const segments = useSegments() as string[];
//     const router = useRouter();
//
//     const isAuthRoute = segments[0] === 'auth' || segments.includes('auth');
//     const isRootPath = segments.length === 0 || (segments.length === 1 && segments[0] === '');
//     const isProfileRoute = segments.includes('profile') || segments.includes('edit-profile');
//     const isPublicRoute = isCurrentRoutePublic(segments);
//
//     const checkProfile = React.useCallback(async () => {
//         if (!user) return { hasProfile: false, error: null };
//
//         try {
//             const { data: existingPlayer, error } = await supabase
//                 .from('players')
//                 .select('id')
//                 .eq('user_id', user.id)
//                 .maybeSingle();
//
//             return {
//                 hasProfile: !!existingPlayer && !error,
//                 error: error
//             };
//         } catch (error) {
//             console.error('Error checking profile:', error);
//             return { hasProfile: false, error };
//         }
//     }, [user]);
//
//     useEffect(() => {
//         console.log('[AuthGuard] user:', !!user, 'isInitialized:', isInitialized, 'isLoading:', isLoading, 'segments:', segments);
//
//         if (!isInitialized || isLoading) {
//             return;
//         }
//
//         const handleAuthFlow = async () => {
//             if (!user) {
//                 setIsCheckingProfile(false);
//                 // Zamiast nawigacji, ustaw flagę
//                 if (!isAuthRoute && !isPublicRoute && !hasTriedNavigation) {
//                     console.log('Potrzebujemy przekierowania do logowania');
//                     setHasTriedNavigation(true);
//                     // Próbuj nawigacji z opóźnieniem
//                     setTimeout(() => {
//                         router.replace('/auth/login').catch(error => {
//                             console.error('Błąd nawigacji do logowania:', error);
//                         });
//                     }, 100);
//                 }
//                 return;
//             }
//
//             // Użytkownik zalogowany
//             const { hasProfile, error } = await checkProfile();
//             setIsCheckingProfile(false);
//
//             if (error) {
//                 console.error('Błąd podczas sprawdzania profilu:', error);
//                 return;
//             }
//
//             if (!hasProfile) {
//                 console.log('Użytkownik potrzebuje profilu');
//                 setNeedsProfileSetup(true);
//                 if (!isProfileRoute && !hasTriedNavigation) {
//                     setHasTriedNavigation(true);
//                     setTimeout(() => {
//                         router.replace('/(tabs)/profile').catch(error => {
//                             console.error('Błąd nawigacji do profilu:', error);
//                         });
//                     }, 100);
//                 }
//                 return;
//             }
//
//             // Użytkownik ma profil
//             if ((isAuthRoute || isRootPath) && !hasTriedNavigation) {
//                 console.log('Przekierowanie do głównej aplikacji');
//                 setHasTriedNavigation(true);
//                 setTimeout(() => {
//                     router.replace('/(tabs)').catch(error => {
//                         console.error('Błąd nawigacji do tabs:', error);
//                     });
//                 }, 100);
//             }
//         };
//
//         handleAuthFlow();
//     }, [user, isInitialized, isLoading, segments.join('/'), hasTriedNavigation]);
//
//     // Reset flagi nawigacji gdy zmieniają się segmenty
//     useEffect(() => {
//         setHasTriedNavigation(false);
//     }, [segments.join('/')]);
//
//     // Pokaż loading
//     if (!isInitialized || isLoading || isCheckingProfile) {
//         return (
//             <View style={styles.loadingContainer} testID="loading-indicator">
//                 <ActivityIndicator size="large" color="#007AFF"/>
//             </View>
//         );
//     }
//
//     // Decyzja o renderowaniu na podstawie stanu
//     const shouldShowContent = () => {
//         if (!user) {
//             // Niezalogowany użytkownik - pokaż tylko jeśli na publicznej ścieżce
//             return isAuthRoute || isPublicRoute;
//         }
//
//         if (needsProfileSetup) {
//             // Zalogowany bez profilu - pokaż tylko na ścieżkach profilu
//             return isProfileRoute;
//         }
//
//         // Zalogowany z profilem - pokaż wszystko oprócz auth
//         return !isAuthRoute;
//     };
//
//     if (!shouldShowContent()) {
//         return (
//             <View style={styles.loadingContainer}>
//                 <ActivityIndicator size="large" color="#007AFF"/>
//             </View>
//         );
//     }
//
//     return <>{children}</>;
// }
//
// const styles = StyleSheet.create({
//     loadingContainer: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         backgroundColor: '#f5f5f5',
//     },
// });
