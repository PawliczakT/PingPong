import React, {ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useAuthStore} from '@/store/authStore';
import {useSegments} from 'expo-router';

interface AuthGuardProps {
    children: ReactNode;
}

export default function AuthGuard({children}: AuthGuardProps) {
    const {error} = useAuthStore();
    const segments = useSegments();

    if (segments[0] === 'auth') {
        return <>{children}</>;
    }

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{color: 'red', textAlign: 'center', margin: 16}}>{error.message}</Text>
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
