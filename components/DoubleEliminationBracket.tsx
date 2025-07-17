//components/DoubleEliminationBracket.tsx
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Player, TournamentMatch} from '@/backend/types';
import {colors} from '@/constants/colors';
import TournamentBracket from '@/components/TournamentBracket';

interface DoubleEliminationBracketProps {
    matches: TournamentMatch[];
    participants: Player[];
    onMatchPress: (match: TournamentMatch) => void;
}

const DoubleEliminationBracket: React.FC<DoubleEliminationBracketProps> = ({matches, participants, onMatchPress}) => {

    const winnerBracketMatches = matches.filter(m => m.bracket === 'winner');
    const loserBracketMatches = matches.filter(m => m.bracket === 'loser');
    const finalMatches = matches.filter(m => m.bracket === 'final');

    return (
        <ScrollView>
            <View style={styles.container}>
                <Text style={styles.bracketTitle}>Winner's Bracket</Text>
                <TournamentBracket matches={winnerBracketMatches} onMatchPress={onMatchPress}/>

                {loserBracketMatches.length > 0 && (
                    <>
                        <Text style={styles.bracketTitle}>Loser's Bracket</Text>
                        <TournamentBracket matches={loserBracketMatches} onMatchPress={onMatchPress}/>
                    </>
                )}

                {finalMatches.length > 0 && (
                    <>
                        <Text style={styles.bracketTitle}>Grand Final</Text>
                        <TournamentBracket matches={finalMatches} onMatchPress={onMatchPress}/>
                    </>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 10,
    },
    bracketTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
        marginTop: 20,
        textAlign: 'center',
    },
});

export default DoubleEliminationBracket;
