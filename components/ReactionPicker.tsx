import React, { useRef } from 'react'; // Import useRef
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@react-navigation/native';

interface ReactionPickerProps {
  isVisible: boolean;
  onSelectEmoji: (emoji: string) => void;
  onDismiss: () => void; // Optional: if clicking outside or a dismiss button is added
  position?: { top?: number; left?: number; right?: number; bottom?: number }; // For absolute positioning
}

const PREDEFINED_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢']; // Example set

// Sub-component for individual animated emoji button
const AnimatedEmojiButton = ({ emoji, onSelectEmoji }: { emoji: string, onSelectEmoji: (emoji: string) => void }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    onSelectEmoji(emoji);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
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
  const { colors } = useTheme();
  const containerScaleAnim = useRef(new Animated.Value(0)).current; // For entry/exit of the container

  React.useEffect(() => {
    if (isVisible) {
      Animated.spring(containerScaleAnim, {
        toValue: 1,
        friction: 7, // Adjusted friction
        tension: 100, // Adjusted tension for a bit quicker spring
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

  // Optimization: If not visible and animation is complete, don't render
  // This requires checking if the animation value is actually 0.
  // A simpler way is to conditionally render based on isVisible and let animation handle visual appearance.
  // if (!isVisible && containerScaleAnim === new Animated.Value(0)) { // This comparison is tricky due to Animated.Value being an object.
  //    return null;
  // }
  // The effect of the above is that it will render one last time with scale 0.
  // For true unmounting, a wrapper component managing isVisible state for mounting/unmounting ReactionPicker can be used.

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          transform: [{ scale: containerScaleAnim }],
          opacity: containerScaleAnim, // Fade effect along with scale
        },
        position ? { ...styles.positioned, ...position } : {}
      ]}
      // pointerEvents={!isVisible ? 'none' : 'auto'} // Prevent interaction when invisible
    >
      {PREDEFINED_EMOJIS.map((emoji) => (
        <AnimatedEmojiButton key={emoji} emoji={emoji} onSelectEmoji={onSelectEmoji} />
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
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    alignSelf: 'flex-start', // So it doesn't take full width if not positioned
  },
  positioned: { // For when used with absolute positioning near a message item
    position: 'absolute',
    // Example: top: -40, left: 10 (adjust based on message item layout)
  },
  emojiButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emojiText: {
    fontSize: 20, // Larger emojis for easier tapping
  },
});

export default ReactionPicker;
