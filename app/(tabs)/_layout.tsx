import React from 'react';
import {Tabs} from 'expo-router';
import {useColorScheme} from 'react-native';
import {BarChart, Home, PlusCircle, Trophy, Users} from 'lucide-react-native';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colorScheme === 'dark' ? '#ffffff' : '#007AFF',
                tabBarInactiveTintColor: colorScheme === 'dark' ? '#888888' : '#8E8E93',
                tabBarStyle: {
                    backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
                },
                headerStyle: {
                    backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
                },
                headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({color}) => <Home size={24} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="players"
                options={{
                    title: 'Players',
                    tabBarIcon: ({color}) => <Users size={24} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="add-match"
                options={{
                    title: 'Add Match',
                    tabBarIcon: ({color}) => <PlusCircle size={24} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="tournaments"
                options={{
                    title: 'Tournaments',
                    tabBarIcon: ({color}) => <Trophy size={24} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="stats"
                options={{
                    title: 'Stats',
                    tabBarIcon: ({color}) => <BarChart size={24} color={color}/>,
                }}
            />
        </Tabs>
    );
}
