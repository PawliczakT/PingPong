//components/ChatInput.tsx
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {Send, WifiOff} from 'lucide-react-native';

export interface ChatInputProps {
    value: string;
    onChangeText: (text: string) => void;
    onSendMessage: (content: string) => Promise<void>;
    onMentionQueryChange: (query: string) => void;
    isLoading?: boolean;
    isSending?: boolean;
    isDisconnected?: boolean;
    placeholder?: string;
    maxLength?: number;
}

const ChatInput: React.FC<ChatInputProps> = ({
                                                 value,
                                                 onChangeText,
                                                 onSendMessage,
                                                 onMentionQueryChange,
                                                 isLoading = false,
                                                 isSending = false,
                                                 isDisconnected = false,
                                                 placeholder = "Send message...",
                                                 maxLength = 1000
                                             }) => {
    const {colors} = useTheme();
    const textInputRef = useRef<TextInput>(null);
    const mentionQueryRef = useRef<string>('');
    const [inputHeight, setInputHeight] = useState(40);

    // ✅ Memoized calculations
    const isInputDisabled = useMemo(() =>
            isLoading || isSending || isDisconnected,
        [isLoading, isSending, isDisconnected]
    );

    const isSendDisabled = useMemo(() =>
            isInputDisabled || value.trim().length === 0 || value.trim().length > maxLength,
        [isInputDisabled, value, maxLength]
    );

    const placeholderMessage = useMemo(() => {
        if (isDisconnected) return "No internet connection...";
        if (isSending) return "Sending...";
        if (isLoading) return "Loading...";
        return placeholder;
    }, [isDisconnected, isSending, isLoading, placeholder]);

    // ✅ Improved mention detection
    const handleTextChange = useCallback((text: string) => {
        // Limit text length
        if (text.length > maxLength) {
            return;
        }

        onChangeText(text);

        // Handle mention detection
        const words = text.split(/\s+/);
        const lastWord = words[words.length - 1] || "";

        if (lastWord.startsWith('@') && lastWord.length > 1) {
            const query = lastWord.substring(1);
            if (mentionQueryRef.current !== query) {
                onMentionQueryChange(query);
                mentionQueryRef.current = query;
            }
        } else {
            if (mentionQueryRef.current !== '') {
                onMentionQueryChange('');
                mentionQueryRef.current = '';
            }
        }
    }, [onChangeText, onMentionQueryChange, maxLength]);

    // ✅ Improved send handler
    const handleSend = useCallback(async () => {
        const trimmedMessage = value.trim();
        if (!trimmedMessage || isSendDisabled) {
            return;
        }

        try {
            await onSendMessage(trimmedMessage);
            // Clear mention query after successful send
            if (mentionQueryRef.current !== '') {
                onMentionQueryChange('');
                mentionQueryRef.current = '';
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            // Focus back to input on error
            textInputRef.current?.focus();
        }
    }, [value, isSendDisabled, onSendMessage, onMentionQueryChange]);

    // ✅ Handle content size change for dynamic height
    const handleContentSizeChange = useCallback((event: any) => {
        const newHeight = Math.min(Math.max(40, event.nativeEvent.contentSize.height), 120);
        setInputHeight(newHeight);
    }, []);

    // ✅ Render send button content
    const renderSendButtonContent = useCallback(() => {
        if (isSending) {
            return <ActivityIndicator size={16} color="#FFFFFF"/>;
        }
        if (isDisconnected) {
            return <WifiOff size={18} color="#FFFFFF"/>;
        }
        return <Send size={18} color="#FFFFFF"/>;
    }, [isSending, isDisconnected]);

    // ✅ Dynamic styles
    const inputStyle = useMemo(() => [
        styles.input,
        {
            backgroundColor: isInputDisabled ? colors.card : colors.background,
            color: isInputDisabled ? colors.text + '60' : colors.text,
            borderColor: isDisconnected ? '#FF5722' : colors.border,
            height: inputHeight,
        }
    ], [colors, isInputDisabled, isDisconnected, inputHeight]);

    const sendButtonStyle = useMemo(() => [
        styles.sendButton,
        {
            backgroundColor: isSendDisabled ? colors.border : colors.primary,
            opacity: isSendDisabled ? 0.5 : 1,
        }
    ], [colors, isSendDisabled]);

    return (
        <View style={[styles.container, {borderTopColor: colors.border, backgroundColor: colors.card}]}>
            {/* Character count indicator */}
            {value.length > maxLength * 0.8 && (
                <View style={styles.characterCountContainer}>
                    <Text style={[
                        styles.characterCount,
                        {
                            color: value.length > maxLength ? '#FF5722' : colors.text,
                            opacity: 0.7
                        }
                    ]}>
                        {value.length}/{maxLength}
                    </Text>
                </View>
            )}

            <View style={styles.inputContainer}>
                <TextInput
                    ref={textInputRef}
                    style={inputStyle}
                    placeholder={placeholderMessage}
                    placeholderTextColor={colors.text + '60'}
                    value={value}
                    onChangeText={handleTextChange}
                    onContentSizeChange={handleContentSizeChange}
                    multiline
                    editable={!isInputDisabled}
                    onSubmitEditing={Platform.OS === 'web' ? handleSend : undefined}
                    returnKeyType={Platform.OS === 'ios' ? 'send' : 'default'}
                    enablesReturnKeyAutomatically
                    accessibilityLabel="Send message"
                    accessibilityHint={isDisconnected ? "No internet connection" : "Send message"}
                    maxLength={maxLength}
                    textAlignVertical="top"
                />

                <TouchableOpacity
                    style={sendButtonStyle}
                    onPress={handleSend}
                    disabled={isSendDisabled}
                    activeOpacity={0.7}
                    accessibilityLabel={isSending ? "Sending..." : "Send message"}
                    accessibilityRole="button"
                    accessibilityState={{disabled: isSendDisabled}}
                >
                    {renderSendButtonContent()}
                </TouchableOpacity>
            </View>

            {/* Connection status indicator */}
            {isDisconnected && (
                <View style={styles.statusIndicator}>
                    <WifiOff size={12} color="#FF5722"/>
                    <Text style={[styles.statusText, {color: '#FF5722'}]}>
                        Brak połączenia
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
    },
    characterCountContainer: {
        alignItems: 'flex-end',
        paddingBottom: 4,
    },
    characterCount: {
        fontSize: 12,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        fontSize: 16,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 10,
        textAlignVertical: 'top',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 4,
    },
    statusText: {
        fontSize: 12,
        marginLeft: 4,
        fontWeight: '500',
    },
});

export default ChatInput;
