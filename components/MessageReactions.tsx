import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '@react-navigation/native';

export interface ReactionsData {
    [emoji: string]: string[];
}

interface MessageReactionsProps {
    reactions: ReactionsData | null | undefined;
    messageId: string;
    onToggleReaction?: (emoji: string) => void;
}

const MessageReactions: React.FC<MessageReactionsProps> = ({reactions, messageId, onToggleReaction}) => {
    const {colors} = useTheme();

    if (!reactions || Object.keys(reactions).length === 0) {
        return null;
    }

    const sortedEmojis = Object.keys(reactions).sort(
        (a, b) => (reactions[b]?.length || 0) - (reactions[a]?.length || 0)
    );

    return (
        <View style={styles.container}>
            {sortedEmojis.map((emoji) => {
                const count = reactions[emoji]?.length || 0;
                if (count === 0) return null;

                return (
                    <TouchableOpacity
                        key={emoji}
                        style={[
                            styles.reactionChip,
                            {backgroundColor: colors.border},
                        ]}
                        onPress={() => onToggleReaction && onToggleReaction(emoji)}
                        activeOpacity={0.7}
                        accessibilityLabel={`Reaction ${emoji}, count ${count}. Press to toggle.`}
                        accessibilityRole="button"
                    >
                        <Text style={styles.emojiText}>{emoji}</Text>
                        <Text style={[styles.countText, {color: colors.text}]}>{count}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
        alignItems: 'center',
    },
    reactionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 6,
        marginBottom: 6,
        borderWidth: 1,
    },
    emojiText: {
        fontSize: 14,
        marginRight: 4,
    },
    countText: {
        fontSize: 13,
        fontWeight: '500',
    },
});

export default MessageReactions;
