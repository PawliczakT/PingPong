import React from 'react';
import {Tabs} from 'expo-router';
import {useColorScheme} from 'react-native';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarStyle: {display: 'none'},
                headerStyle: {
                    backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
                },
                headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            }}
        >
            <Tabs.Screen name="index" options={{title: 'Home'}}/>
            <Tabs.Screen name="players" options={{title: 'Players'}}/>
            <Tabs.Screen name="add-match" options={{title: 'Add Match'}}/>
            <Tabs.Screen name="tournaments" options={{title: 'Tournaments'}}/>
            <Tabs.Screen name="stats" options={{title: 'Stats'}}/>
        </Tabs>
    );
}
