import React, {useRef} from 'react';
import {Animated, StyleSheet, Text, TouchableOpacity} from 'react-native';
import {useTheme} from '@react-navigation/native';

interface PositionStyle {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
    alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
}

interface ReactionPickerProps {
    isVisible: boolean;
    onSelectEmoji: (emoji: string) => void;
    onDismiss: () => void;
    position?: PositionStyle;
}

const PREDEFINED_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

const AnimatedEmojiButton = ({emoji, onSelectEmoji}: { emoji: string, onSelectEmoji: (emoji: string) => void }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
        onSelectEmoji(emoji);
        Animated.sequence([
            Animated.timing(scaleAnim, {toValue: 1.4, duration: 100, useNativeDriver: true}),
            Animated.timing(scaleAnim, {toValue: 1, duration: 100, useNativeDriver: true}),
        ]).start();
    };

    return (
        <Animated.View style={{transform: [{scale: scaleAnim}]}}>
            <TouchableOpacity
                style={styles.emojiButton}
                onPress={handlePress}
                activeOpacity={0.7}
            >
                <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const ReactionPicker: React.FC<ReactionPickerProps> = ({
                                                           isVisible,
                                                           onSelectEmoji,
                                                           onDismiss,
                                                           position
                                                       }) => {
    const {colors} = useTheme();
    const containerScaleAnim = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (isVisible) {
            Animated.spring(containerScaleAnim, {
                toValue: 1,
                friction: 7,
                tension: 100,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(containerScaleAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible, containerScaleAnim]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    transform: [{scale: containerScaleAnim}],
                    opacity: containerScaleAnim,
                },
                position ? {...styles.positioned, ...position} : {}
            ]}
        >
            {PREDEFINED_EMOJIS.map((emoji) => (
                <AnimatedEmojiButton key={emoji} emoji={emoji} onSelectEmoji={onSelectEmoji}/>
            ))}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 3,
        alignSelf: 'flex-start',
    },
    positioned: {
        position: 'absolute',
    },
    emojiButton: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    emojiText: {
        fontSize: 20,
    },
});

export default ReactionPicker;
