import {Redirect, Stack} from 'expo-router';
import {useAuth} from '@/store/authStore';

export default function AuthLayout() {
    const {user} = useAuth();

    // If user is already logged in, redirect to home
    if (user) {
        return <Redirect href="/(tabs)"/>;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: {backgroundColor: '#fff'},
            }}
        >
            <Stack.Screen name="login"/>
        </Stack>
    );
}
