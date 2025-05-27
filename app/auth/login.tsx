import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import Button from '../../components/Button'; // Adjusted path
import { useAuthStore } from '../../store/authStore'; // Adjusted path

export default function LoginScreen() {
  const { loginWithGoogle, isLoading, error, clearError } = useAuthStore(state => ({
    loginWithGoogle: state.loginWithGoogle,
    isLoading: state.isLoading,
    error: state.error,
    clearError: state.clearError, // For potentially clearing error on new attempt or dismiss
  }));

  const handleLogin = () => {
    if (error) {
      clearError(); // Clear previous error on a new login attempt
    }
    loginWithGoogle();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {isLoading && (
          <ActivityIndicator size="large" color="#007AFF" style={styles.activityIndicator} />
        )}

        <Button
          title="Sign in with Google"
          onPress={handleLogin}
          disabled={isLoading}
        />

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Login Failed: {error.message}</Text>
            {/* Optionally, add a button to dismiss error or retry */}
            {/* <Button title="Try Again" onPress={handleLogin} disabled={isLoading} /> */}
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
    padding: 10,
    backgroundColor: '#FFD2D2', // Light red background for error
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#D8000C', // Dark red color for error text
    fontSize: 16,
    textAlign: 'center',
  },
});
