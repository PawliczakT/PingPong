import React, {useRef} from 'react';
import {Platform, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {Send} from 'lucide-react-native';

interface ChatInputProps {
    value: string;
    onChangeText: (text: string) => void;
    onSendMessage: (messageContent: string) => void;
    onMentionQueryChange: (query: string | null) => void;
    isLoading?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
                                                 value,
                                                 onChangeText,
                                                 onSendMessage,
                                                 onMentionQueryChange,
                                                 isLoading = false
                                             }) => {
    const {colors} = useTheme();
    const mentionQueryRef = useRef<string | null>(null);

    const handleTextChange = (text: string) => {
        onChangeText(text);

        const lastWord = text.split(/\s+/).pop() || "";
        if (lastWord.startsWith('@')) {
            const query = lastWord.substring(1);
            if (query.length > 0) {
                if (mentionQueryRef.current !== query) {
                    onMentionQueryChange(query);
                    mentionQueryRef.current = query;
                }
            } else {
                onMentionQueryChange(null);
                mentionQueryRef.current = null;
            }
        } else {
            if (mentionQueryRef.current !== null) {
                onMentionQueryChange(null);
                mentionQueryRef.current = null;
            }
        }
    };

    const handleSend = () => {
        const trimmedMessage = value.trim();
        if (trimmedMessage) {
            onSendMessage(trimmedMessage);
            onChangeText('');
        }
    };

    return (
        <View style={[styles.container, {borderTopColor: colors.border, backgroundColor: colors.card}]}>
            {/* Placeholder for mention suggestion box that could appear above the input */}
            {/* <View style={styles.mentionSuggestionsContainer} /> */}

            <TextInput
                style={[
                    styles.input,
                    {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border
                    }
                ]}
                placeholder="Type a message..."
                placeholderTextColor={colors.text + '80'}
                value={value}
                onChangeText={handleTextChange}
                multiline
                editable={!isLoading}
                onSubmitEditing={Platform.OS === 'web' ? handleSend : undefined}
                returnKeyType={Platform.OS === 'ios' ? 'send' : 'default'}
                enablesReturnKeyAutomatically
                accessibilityLabel="Chat message input"
            />
            <TouchableOpacity
                style={[styles.sendButton, {backgroundColor: colors.primary}]}
                onPress={handleSend}
                disabled={isLoading || value.trim().length === 0}
                activeOpacity={0.7}
                accessibilityLabel="Send message"
                accessibilityRole="button"
            >
                <Send size={20} color="#FFFFFF"/>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 10,
        paddingTop: Platform.OS === 'ios' ? 10 : 8,
    },
    sendButton: {
        padding: 10,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mentionSuggestionsContainer: {
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: '#ccc',
      borderRadius: 8,
      padding: 4,
      maxHeight: 150,
    }
});

export default ChatInput;
