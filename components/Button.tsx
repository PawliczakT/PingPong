import React from "react";
import {ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle} from "react-native";
import {colors} from "@/constants/colors";

type ButtonProps = {
    title: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "outline" | "text";
    size?: "small" | "medium" | "large";
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle | ViewStyle[] | Array<ViewStyle>;
    textStyle?: TextStyle | TextStyle[] | Array<TextStyle>;
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
                                   icon
                               }: ButtonProps) {
    const getContainerStyle = () => {
        const baseStyle = [styles.container];

        // Add size style
        switch (size) {
            case "small":
                baseStyle.push(styles.smallContainer);
                break;
            case "large":
                baseStyle.push(styles.largeContainer);
                break;
        }

        // Add variant style
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

        // Add disabled style
        if (disabled || loading) {
            baseStyle.push(styles.disabledContainer);
        }

        return baseStyle;
    };

    const getTextStyle = () => {
        const baseStyle = [styles.text];

        // Add size style
        switch (size) {
            case "small":
                baseStyle.push(styles.smallText);
                break;
            case "large":
                baseStyle.push(styles.largeText);
                break;
        }

        // Add variant style
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

        // Add disabled style
        if (disabled || loading) {
            baseStyle.push(styles.disabledText);
        }

        return baseStyle;
    };

    return (
        <TouchableOpacity
            style={[...getContainerStyle(), style]}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === "outline" || variant === "text" ? colors.primary : "#fff"}
                    size="small"
                />
            ) : (
                <>
                    {icon && icon}
                    <Text style={[...getTextStyle(), icon ? {marginLeft: 8} : {}, textStyle]}>
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
    },
    smallContainer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    largeContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    primaryContainer: {
        backgroundColor: colors.primary,
    },
    secondaryContainer: {
        backgroundColor: colors.secondary,
    },
    outlineContainer: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.primary,
    },
    textContainer: {
        backgroundColor: "transparent",
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    disabledContainer: {
        opacity: 0.6,
    },
    text: {
        fontWeight: "600",
        textAlign: "center",
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
    disabledText: {
        opacity: 0.8,
    },
});
