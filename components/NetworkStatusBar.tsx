import React, {useEffect, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {RefreshCw, WifiOff} from "lucide-react-native";
import {colors} from "@/constants/colors";
import {useNetworkStore} from "@/store/networkStore";

type NetworkStatusBarProps = {
    onSync?: () => void;
};

export default function NetworkStatusBar({onSync}: NetworkStatusBarProps) {
    const {isOnline, pendingMatches, syncPendingMatches, checkNetworkStatus} = useNetworkStore();
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        checkNetworkStatus();
        const interval = setInterval(() => {
            checkNetworkStatus();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleSync = async () => {
        if (isOnline && pendingMatches.length > 0) {
            setIsSyncing(true);
            await syncPendingMatches();
            if (onSync) onSync();
            setIsSyncing(false);
        }
    };

    if (isOnline && pendingMatches.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            {!isOnline ? (
                <View style={styles.content}>
                    <WifiOff size={16} color="#fff"/>
                    <Text style={styles.text}>You're offline. Changes will be saved locally.</Text>
                </View>
            ) : pendingMatches.length > 0 ? (
                <View style={styles.content}>
                    <Text style={styles.text}>{pendingMatches.length} match(es) pending sync</Text>
                    <Pressable
                        style={styles.syncButton}
                        onPress={handleSync}
                        disabled={isSyncing}
                    >
                        <RefreshCw size={16} color="#fff"/>
                        <Text style={styles.syncText}>{isSyncing ? "Syncing..." : "Sync Now"}</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.primary,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    text: {
        color: "#fff",
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
    syncButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    syncText: {
        color: "#fff",
        fontSize: 12,
        marginLeft: 4,
        fontWeight: "bold",
    },
});
