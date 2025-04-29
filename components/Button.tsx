import React from "react";
import {ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle,} from "react-native";
import {colors} from "@/constants/colors";

type ButtonProps = {
    title: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "outline" | "text";
    size?: "small" | "medium" | "large";
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle | ViewStyle[];
    textStyle?: TextStyle | TextStyle[];
    icon?: React.ReactNode;
};

export default function Button({
                                   title,
                                   onPress,
                                   variant = "primary",
                                   size = "medium",
                                   disabled = false,
                                   loading = false,
                                   style,
                                   textStyle,
                                   icon,
                               }: ButtonProps) {

    const getContainerStyle = (): Array<ViewStyle> => {
        const baseStyle: Array<ViewStyle> = [styles.container];

        switch (size) {
            case "small":
                baseStyle.push(styles.smallContainer);
                break;
            case "large":
                baseStyle.push(styles.largeContainer);
                break;
        }

        switch (variant) {
            case "primary":
                baseStyle.push(styles.primaryContainer);
                break;
            case "secondary":
                baseStyle.push(styles.secondaryContainer);
                break;
            case "outline":
                baseStyle.push(styles.outlineContainer);
                break;
            case "text":
                baseStyle.push(styles.textContainer);
                break;
        }

        if (disabled || loading) {
            baseStyle.push(styles.disabledContainer);
        }

        return baseStyle;
    };

    const getTextStyle = (): Array<TextStyle> => {
        const baseStyle: Array<TextStyle> = [styles.text];

        switch (size) {
            case "small":
                baseStyle.push(styles.smallText);
                break;
            case "large":
                baseStyle.push(styles.largeText);
                break;
        }

        switch (variant) {
            case "primary":
                baseStyle.push(styles.primaryText);
                break;
            case "secondary":
                baseStyle.push(styles.secondaryText);
                break;
            case "outline":
                baseStyle.push(styles.outlineText);
                break;
            case "text":
                baseStyle.push(styles.textOnlyText);
                break;
        }
        return baseStyle;
    };

    const combinedContainerStyle = [
        ...getContainerStyle(),
        ...(Array.isArray(style) ? style : [style])
    ].filter(Boolean);

    const combinedTextStyle = [
        ...getTextStyle(),
        icon ? styles.textWithIcon : {},
        ...(Array.isArray(textStyle) ? textStyle : [textStyle])
    ].filter(Boolean);

    return (
        <TouchableOpacity
            style={combinedContainerStyle}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator
                    testID="button-loading-indicator"
                    color={variant === "outline" || variant === "text" ? colors.primary : "#fff"}
                    size="small"
                />
            ) : (
                <>
                    {icon}
                    <Text style={combinedTextStyle}>
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    smallContainer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
    },
    largeContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 10,
    },
    primaryContainer: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    secondaryContainer: {
        backgroundColor: colors.secondary,
        borderColor: colors.secondary,
    },
    outlineContainer: {
        backgroundColor: "transparent",
        borderColor: colors.primary,
    },
    textContainer: {
        backgroundColor: "transparent",
        borderColor: 'transparent',
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderWidth: 0,
    },
    disabledContainer: {
        opacity: 0.6,
    },

    text: {
        fontWeight: "600",
        fontSize: 16,
        textAlign: "center",
    },
    textWithIcon: {
        marginLeft: 8,
    },
    smallText: {
        fontSize: 14,
    },
    largeText: {
        fontSize: 18,
    },
    primaryText: {
        color: "#fff",
    },
    secondaryText: {
        color: "#fff",
    },
    outlineText: {
        color: colors.primary,
    },
    textOnlyText: {
        color: colors.primary,
    },
});
