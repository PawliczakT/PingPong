import React from 'react';
import {ActivityIndicator, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import Button from '../../components/Button';
import {useAuthStore} from '@/store/authStore';

export default function LoginScreen() {
    const {loginWithGoogle, isLoading, error, clearError} = useAuthStore();

    const handleLogin = async () => {
        if (error) {
            clearError();
        }

        console.log('[Login] Starting Google authentication flow');
        try {
            await loginWithGoogle();
            console.log('[Login] Authentication flow completed successfully');
        } catch (e) {
            console.error('[Login] Authentication error caught in component:', e);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>Welcome!</Text>
                <Text style={styles.subtitle}>Sign in to continue</Text>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#007AFF" style={styles.activityIndicator}/>
                ) : (
                    <Button
                        title="Sign in with Google"
                        onPress={handleLogin}
                        disabled={isLoading}
                    />
                )}

                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>
                            Login Failed: {error.message || 'Authentication error. Please try again.'}
                        </Text>
                        <Button
                            title="Try Again"
                            onPress={clearError}
                            style={styles.tryAgainButton}
                        />
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f5f5f5', // Light background for the whole screen
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    subtitle: {
        fontSize: 18,
        color: '#666',
        marginBottom: 40,
    },
    activityIndicator: {
        marginBottom: 20,
    },
    errorContainer: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#FFD2D2', // Light red background for error
        borderRadius: 8,
        alignItems: 'center',
        width: '100%',
        maxWidth: 300,
    },
    errorText: {
        color: '#D8000C', // Dark red color for error text
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 10,
    },
    tryAgainButton: {
        marginTop: 10,
    },
});
