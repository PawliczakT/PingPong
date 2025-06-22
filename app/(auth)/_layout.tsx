//app/(auth)/_layout.tsx
import {Redirect, Stack} from 'expo-router';
import {useAuth} from '@/store/authStore';

export default function AuthLayout() {
    const {user} = useAuth();

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
            <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
    );
}
