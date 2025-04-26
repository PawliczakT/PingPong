import React, { ReactNode, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { error } = useAuthStore();
  const segments = useSegments();

  // Special case for login screen - don't apply AuthGuard
  if (segments[0] === 'auth') {
    return <>{children}</>;
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: 'red', textAlign: 'center', margin: 16 }}>{error}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});