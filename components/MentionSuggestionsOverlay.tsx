import React from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '@react-navigation/native';
import PlayerAvatar from './PlayerAvatar';

interface MentionPlayer {
    id: string;
    nickname: string;
    avatar_url: string | null;
}

interface MentionSuggestionsOverlayProps {
    suggestions: MentionPlayer[];
    onSelectSuggestion: (nickname: string) => void;
    isVisible: boolean;
}

const MentionSuggestionsOverlay: React.FC<MentionSuggestionsOverlayProps> = ({
                                                                                 suggestions,
                                                                                 onSelectSuggestion,
                                                                                 isVisible,
                                                                             }) => {
    const {colors} = useTheme();

    if (!isVisible || suggestions.length === 0) {
        return null;
    }

    const renderItem = ({item}: { item: MentionPlayer }) => (
        <TouchableOpacity
            style={[styles.suggestionItem, {borderBottomColor: colors.border}]}
            onPress={() => onSelectSuggestion(item.nickname)}
            accessibilityLabel={`Select mention ${item.nickname}`}
            accessibilityRole="button"
        >
            <PlayerAvatar avatarUrl={item.avatar_url} name={item.nickname} size={24}/>
            <Text style={[styles.nicknameText, {color: colors.text}]}>{item.nickname}</Text>
        </TouchableOpacity>
    );

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                }
            ]}
        >
            <FlatList
                data={suggestions}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.list}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: '100%',
        left: 10,
        right: 10,
        maxHeight: 150,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        borderWidth: 1,
        borderBottomWidth: 0,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.1,
        shadowRadius: 2,
        overflow: 'hidden',
    },
    list: {
        flexGrow: 0,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
    },
    nicknameText: {
        marginLeft: 8,
        fontSize: 15,
    },
});

export default MentionSuggestionsOverlay;
