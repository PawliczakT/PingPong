import {Redirect} from 'expo-router';
import {useAuthStore} from '@/store/authStore';
import {ActivityIndicator, View} from 'react-native';

export default function Index() {
    const user = useAuthStore(state => state.user);
    const isInitialized = useAuthStore(state => state.isInitialized);

    if (!isInitialized) {
        return (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                <ActivityIndicator size="large" color="#007AFF"/>
            </View>
        );
    }

    if (!user) {
        return <Redirect href="/(auth)/login"/>;
    }

    return <Redirect href="/(tabs)"/>;
}
