//app/(tabs)/_layout.tsx
import React from 'react';
import {Tabs} from 'expo-router';
import {useColorScheme} from 'react-native';
import {BarChart, Home, MessageCircle, PlusCircle, Trophy, User, Users} from 'lucide-react-native';
import {colors} from '@/constants';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textLight,
                tabBarStyle: {
                    backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
                    borderTopWidth: 0,
                    elevation: 0,
                    height: 60,
                    paddingBottom: 8,
                },
                headerStyle: {
                    backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
                },
                headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
                tabBarLabelStyle: {
                    fontSize: 12,
                    marginTop: 4,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({color, size}) => <Home size={size} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="players"
                options={{
                    title: 'Players',
                    tabBarIcon: ({color, size}) => <Users size={size} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="add-match"
                options={{
                    title: 'Add Match',
                    tabBarIcon: ({color, size}) => <PlusCircle size={size} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="tournaments"
                options={{
                    title: 'Tournaments',
                    tabBarIcon: ({color, size}) => <Trophy size={size} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="stats"
                options={{
                    title: 'Stats',
                    tabBarIcon: ({color, size}) => <BarChart size={size} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({color, size}) => <User size={size} color={color}/>,
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'Chat',
                    tabBarIcon: ({color, size}) => <MessageCircle size={size} color={color}/>,
                }}
            />
        </Tabs>
    );
}
