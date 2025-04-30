import React, {ReactNode, useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useAuthStore} from '@/store/authStore';
import {useSegments} from 'expo-router';
import LogRocket from '@logrocket/react-native';

interface AuthGuardProps {
    children: ReactNode;
}

export default function AuthGuard({children}: AuthGuardProps) {
    const {error, user} = useAuthStore();
    const segments = useSegments();

    useEffect(() => {
        if (user) {
            LogRocket.identify(user.id, {
                name: user.name,
                email: user.email,
                nickname: user.nickname,
            });
            console.log('LogRocket identified user:', user.id);
        }
    }, [user]);

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
