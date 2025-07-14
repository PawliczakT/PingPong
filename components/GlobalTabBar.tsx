import React from 'react';
import {StyleSheet, Text, TouchableOpacity, useColorScheme, View} from 'react-native';
import {usePathname, useRouter} from 'expo-router';
import {BarChart, Home, PlusCircle, Trophy, Users} from 'lucide-react-native';

export default function GlobalTabBar() {
    const router = useRouter();
    const pathname = usePathname();
    const colorScheme = useColorScheme();

    const isActive = (path: string) => {
        return pathname === path || pathname.startsWith(`/${path}`);
    };

    const activeColor = colorScheme === 'dark' ? '#ffffff' : '#007AFF';
    const inactiveColor = colorScheme === 'dark' ? '#888888' : '#8E8E93';
    const backgroundColor = colorScheme === 'dark' ? '#1C1C1E' : '#F2F2F7';

    return (
        <View style={[styles.container, {backgroundColor}]}>
            <TouchableOpacity
                style={styles.tab}
                onPress={() => router.push('/')}
                activeOpacity={0.7}
            >
                <Home size={24} color={isActive('') ? activeColor : inactiveColor}/>
                <Text style={[styles.label, {color: isActive('') ? activeColor : inactiveColor}]}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.tab}
                onPress={() => router.push('/players')}
                activeOpacity={0.7}
            >
                <Users size={24} color={isActive('players') ? activeColor : inactiveColor}/>
                <Text style={[styles.label, {color: isActive('players') ? activeColor : inactiveColor}]}>Players</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.tab}
                onPress={() => router.push('/add-match')}
                activeOpacity={0.7}
            >
                <PlusCircle size={24} color={isActive('add-match') ? activeColor : inactiveColor}/>
                <Text style={[styles.label, {color: isActive('add-match') ? activeColor : inactiveColor}]}>Add
                    Match</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.tab}
                onPress={() => router.push('/tournaments')}
                activeOpacity={0.7}
            >
                <Trophy size={24} color={isActive('tournaments') ? activeColor : inactiveColor}/>
                <Text
                    style={[styles.label, {color: isActive('tournaments') ? activeColor : inactiveColor}]}>Tournaments</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.tab}
                onPress={() => router.push('/stats')}
                activeOpacity={0.7}
            >
                <BarChart size={24} color={isActive('stats') ? activeColor : inactiveColor}/>
                <Text style={[styles.label, {color: isActive('stats') ? activeColor : inactiveColor}]}>Stats</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        height: 60,
        width: '100%',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        elevation: 8,
        shadowColor: '#000000',
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 999,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    tab: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 8,
    },
    label: {
        fontSize: 10,
        marginTop: 2,
    }
});
