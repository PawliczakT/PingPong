# Double Elimination Tournament Format

## Overview

The double elimination tournament format gives participants a second chance after their first loss. Unlike single elimination (knockout) tournaments where players are immediately eliminated after losing once, double elimination allows players to continue competing in a "losers bracket" after their first defeat.

## Structure

The tournament consists of three main parts:

1. **Winners Bracket**: All participants start here. Winners advance within this bracket.
2. **Losers Bracket**: Players who lose in the winners bracket move here. They can continue advancing until they lose a second time.
3. **Finals**: The winner of the winners bracket faces the winner of the losers bracket.

## Tournament Flow

1. **Initial Rounds**: All players start in the winners bracket.
2. **Progression**:
   - Players who win in the winners bracket continue advancing in that bracket.
   - Players who lose in the winners bracket move to the losers bracket.
   - Players who lose in the losers bracket are eliminated from the tournament.
3. **Finals**:
   - The winner of the winners bracket faces the winner of the losers bracket in the grand final.
   - If the winners bracket champion wins, the tournament ends.
   - If the losers bracket champion wins, a "true final" match is played to determine the overall champion (since the winners bracket player has only lost once).

## Implementation Details

### Data Structure

- Each match has a `bracket` field indicating whether it belongs to the 'winners', 'losers', or 'final' bracket.
- Matches have connections to both the next match (for winners) and the next loser match (for losers).
- The tournament structure is represented as a directed graph where players move between matches based on results.

### Match Progression

1. When a match is completed:
   - The winner advances to the next match in the same bracket.
   - In the winners bracket, the loser moves to a corresponding match in the losers bracket.
2. For the grand final:
   - If the winners bracket champion wins, they are the tournament champion.
   - If the losers bracket champion wins, a true final match is played.
3. The winner of the true final (if needed) becomes the tournament champion.

## UI Representation

The tournament is displayed in three sections:
- Winners bracket at the top
- Grand finals in the middle
- Losers bracket at the bottom

Each match is color-coded to indicate which bracket it belongs to, and shows the players, scores, and match status.

## Requirements

- For optimal bracket balance, the number of players should be a power of 2 (4, 8, 16, etc.).
- The application will handle odd numbers of players by adding byes as needed.

## Benefits

- More fair than single elimination as players get a second chance.
- More matches than single elimination, giving players more playing time.
- Still more efficient than round-robin for large tournaments.
- Creates exciting storylines as players can make comebacks through the losers bracket.
