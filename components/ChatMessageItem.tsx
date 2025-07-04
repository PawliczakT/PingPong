//components/ChatMessageItem.tsx
import React, {memo} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {useRouter} from 'expo-router';
import {AlertTriangle, Award, CheckCircle, Trophy, UserPlus, Zap} from 'lucide-react-native';
import PlayerAvatar from './PlayerAvatar';
import {formatChatMessageTime} from '@/utils/formatters';
import MessageReactions, {ReactionsData} from './MessageReactions';

export interface ChatMessage {
    id: string;
    user_id: string | null;
    profile?: {
        id: string;
        avatar_url: string | null;
        nickname: string | null;
    } | null;
    message_content: string | null;
    created_at: string;
    message_type: 'user_message' | 'system_notification';
    metadata?: {
        notification_type?: string;
        [key: string]: any;
    } | null;
    reactions?: ReactionsData | null;
}

interface ChatMessageItemProps {
    message: ChatMessage;
    currentUserId?: string | null;
}

const ChatMessageItem = memo<ChatMessageItemProps>(({message, currentUserId}) => {
    const {colors} = useTheme();
    const router = useRouter();

    const isUserMessage = message.message_type === 'user_message';
    const isMyMessage = isUserMessage && message.user_id === currentUserId;

    const handleNicknamePress = () => {
        if (message.profile?.id && isUserMessage) {
            router.push(`/player/${message.profile.id}`);
        }
    };

    const renderSystemNotificationContent = () => {
        console.log('📨 Rendering system notification:', {
            messageId: message.id,
            messageType: message.message_type,
            metadata: message.metadata,
            content: message.message_content
        });

        if (!message.metadata || !message.metadata.notification_type) {
            console.log('⚠️ No notification type in metadata, falling back to default message');
            return <Text style={{color: colors.text}}>{message.message_content || 'System notification'}</Text>;
        }

        const {metadata} = message;
        let icon = <AlertTriangle size={16} color={colors.notification}/>;
        let content: React.ReactNode = message.message_content;

        if (metadata.notification_type === 'match_won') {
            console.log('🔍 Match metadata:', {
                winnerNickname: metadata.winnerNickname,
                opponentNickname: metadata.opponentNickname,
                loserNickname: metadata.loserNickname,
                score: metadata.score
            });
        }

        switch (metadata.notification_type) {
            case 'match_won':
                icon = <Trophy size={16} color={colors.primary}/>;
                const opponent = metadata.loserNickname || metadata.opponentNickname;
                content = (
                    <Text>
                        <Text style={styles.bold}>🏆 {metadata.winnerNickname}</Text> defeated <Text
                        style={styles.bold}>{opponent}</Text>{metadata.score ? ` ${metadata.score}` : ''}!
                    </Text>
                );
                break;
            case 'tournament_won':
                console.log('🏆 Rendering tournament_won notification with metadata:', metadata);
                if (!metadata.winnerNickname || !metadata.tournamentName) {
                    console.error('❌ Missing required fields in tournament_won notification', {
                        hasWinnerNickname: !!metadata.winnerNickname,
                        hasTournamentName: !!metadata.tournamentName,
                        metadata
                    });
                }
                icon = <Award size={16} color={colors.primary}/>;
                content = (
                    <Text>
                        <Text style={styles.bold}>👑 {metadata.winnerNickname || 'Someone'}</Text> won the
                        tournament <Text
                        style={styles.bold}>{metadata.tournamentName || 'the tournament'}</Text>!
                    </Text>
                );
                break;
            case 'achievement_unlocked':
                icon = <CheckCircle size={16} color={colors.primary}/>;
                content = (
                    <Text>
                        <Text style={styles.bold}>🏅 {metadata.achieverNickname}</Text> unlocked achievement: <Text
                        style={styles.bold}>{metadata.achievementName}</Text>!
                    </Text>
                );
                break;
            case 'rank_up':
                icon = <Zap size={16} color={colors.primary}/>;
                content = (
                    <Text>
                        <Text style={styles.bold}>🚀 {metadata.playerNickname}</Text> advanced to rank <Text
                        style={styles.bold}>{metadata.rankName}</Text>!
                    </Text>
                );
                break;
            case 'new_player':
                icon = <UserPlus size={16} color={colors.primary}/>;
                content = (
                    <Text>
                        👋 Welcome to the game, <Text style={styles.bold}>{metadata.newPlayerNickname}</Text>!
                    </Text>
                );
                break;
            default:
                content = (
                    <Text>{message.message_content || `System notification: ${metadata.notification_type}`}</Text>
                );
        }

        return (
            <View style={styles.systemMessageContent}>
                {icon}
                <Text style={[styles.systemMessageText, {color: colors.text, marginLeft: 8}]}>{content}</Text>
            </View>
        );
    };

    return (
        <View
            style={[
                styles.container,
                isUserMessage ? (isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer)
                    : styles.systemMessageContainer,
                {borderBottomColor: colors.border}
            ]}
        >
            {isUserMessage && message.profile && (
                <TouchableOpacity onPress={handleNicknamePress} style={styles.avatarContainer}>
                    <PlayerAvatar
                        avatarUrl={message.profile.avatar_url}
                        name={message.profile.nickname || 'Player'}
                        size={32}
                    />
                </TouchableOpacity>
            )}

            <View style={styles.messageContentContainer}>
                {isUserMessage && message.profile && (
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={handleNicknamePress}
                                          accessibilityLabel={`View profile of ${message.profile.nickname || 'User'}`}
                                          accessibilityRole="button">
                            <Text
                                style={[styles.nickname, {color: colors.primary}]}>{message.profile.nickname || 'Player'}</Text>
                        </TouchableOpacity>
                        <Text style={[styles.timestamp, {color: colors.text, opacity: 0.7}]}>
                            {formatChatMessageTime(message.created_at)}
                        </Text>
                    </View>
                )}

                <View
                    style={[
                        styles.messageBubble,
                        isUserMessage
                            ? (isMyMessage
                                    ? {backgroundColor: colors.primary}
                                    : {backgroundColor: colors.card}
                            )
                            : {backgroundColor: colors.background}
                    ]}
                    accessibilityLabel={isUserMessage ? `Message from ${message.profile?.nickname || 'User'}: ${message.message_content}` : `System notification: ${message.metadata?.notification_type}`}
                >
                    {isUserMessage ? (
                        <Text style={[styles.messageText, isMyMessage ? {color: '#FFFFFF'} : {color: colors.text}]}>
                            {message.message_content}
                        </Text>
                    ) : (
                        renderSystemNotificationContent()
                    )}
                </View>
                {message.reactions && (
                    <MessageReactions
                        reactions={message.reactions}
                        messageId={message.id}
                        onToggleReaction={(emoji) => {
                            console.log(`Toggled reaction: ${emoji} for message ${message.id}`);
                        }}
                    />
                )}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
    },
    myMessageContainer: {},
    otherMessageContainer: {},
    systemMessageContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 4,
    },
    avatarContainer: {
        marginRight: 10,
        justifyContent: 'flex-start',
    },
    messageContentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    nickname: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    timestamp: {
        fontSize: 12,
    },
    messageBubble: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 18,
        maxWidth: '90%',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    systemMessageContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    systemMessageText: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    bold: {
        fontWeight: 'bold',
    },
});

export default memo(ChatMessageItem);
