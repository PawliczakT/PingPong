import React from 'react';
import {ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View} from 'react-native';
import {useSettingsStore} from '@/store/settingsStore';
import {useAuthStore} from '@/store/authStore';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Bell, Info, LogOut, Moon, Shield, Wifi, User} from 'lucide-react-native'; // Added User icon
import { Link } from 'expo-router'; // Added Link

export default function SettingsScreen() {
    const {
        notificationsEnabled,
        toggleNotificationsEnabled,
        darkMode,
        toggleDarkMode,
        offlineMode,
        toggleOfflineMode
    } = useSettingsStore();

    const {logout, user} = useAuthStore();

    const handleLogout = async () => {
        await logout();
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView>
                {user && (
                    <View style={styles.userSection}>
                        <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>App Settings</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingLabelContainer}>
                            <Bell size={20} color="#007AFF"/>
                            <Text style={styles.settingLabel}>Notifications</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={toggleNotificationsEnabled}
                            trackColor={{false: '#767577', true: '#81b0ff'}}
                            thumbColor={notificationsEnabled ? '#007AFF' : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingLabelContainer}>
                            <Moon size={20} color="#007AFF"/>
                            <Text style={styles.settingLabel}>Dark Mode</Text>
                        </View>
                        <Switch
                            value={darkMode}
                            onValueChange={toggleDarkMode}
                            trackColor={{false: '#767577', true: '#81b0ff'}}
                            thumbColor={darkMode ? '#007AFF' : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingLabelContainer}>
                            <Wifi size={20} color="#007AFF"/>
                            <Text style={styles.settingLabel}>Offline Mode</Text>
                        </View>
                        <Switch
                            value={offlineMode}
                            onValueChange={toggleOfflineMode}
                            trackColor={{false: '#767577', true: '#81b0ff'}}
                            thumbColor={offlineMode ? '#007AFF' : '#f4f3f4'}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingLabelContainer}>
                            <Info size={20} color="#007AFF"/>
                            <Text style={styles.settingLabel}>App Version</Text>
                        </View>
                        <Text style={styles.settingValue}>1.0.0</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingLabelContainer}>
                            <Shield size={20} color="#007AFF"/>
                            <Text style={styles.settingLabel}>Privacy Policy</Text>
                        </View>
                    </TouchableOpacity>
                </View>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    {user && (
                        <Link href="/player/edit-profile" asChild>
                            <TouchableOpacity style={styles.settingItem}>
                                <View style={styles.settingLabelContainer}>
                                    <User size={20} color="#007AFF"/>
                                    <Text style={styles.settingLabel}>Edit My Profile</Text>
                                </View>
                            </TouchableOpacity>
                        </Link>
                    )}

                    <TouchableOpacity
                        style={[styles.settingItem, styles.logoutButton, !user && styles.disabledButton]}
                        onPress={handleLogout}
                        disabled={!user}
                    >
                        <View style={styles.settingLabelContainer}>
                            <LogOut size={20} color={user ? "#FF3B30" : "#cccccc"}/>
                            <Text style={[styles.settingLabel, user ? styles.logoutText : styles.disabledText]}>Log
                                Out</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    userSection: {
        padding: 20,
        backgroundColor: '#ffffff',
        marginBottom: 20,
        borderRadius: 10,
        marginHorizontal: 15,
        marginTop: 15,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    userEmail: {
        fontSize: 17,
        fontWeight: '500',
        color: '#333',
    },
    section: {
        marginBottom: 20,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        overflow: 'hidden',
        marginHorizontal: 15,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6D6D72',
        marginTop: 15,
        marginBottom: 8,
        paddingHorizontal: 15,
        textTransform: 'uppercase',
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#C6C6C8',
        backgroundColor: '#ffffff',
    },
    settingLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingLabel: {
        fontSize: 17,
        marginLeft: 15,
        color: '#000',
    },
    settingValue: {
        fontSize: 17,
        color: '#8E8E93',
    },
    logoutButton: {
        borderBottomWidth: 0,
    },
    logoutText: {
        color: '#FF3B30',
    },
    disabledButton: {
        backgroundColor: '#f0f0f0',
    },
    disabledText: {
        color: '#cccccc',
    },
});
