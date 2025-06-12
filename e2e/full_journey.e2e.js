const {device, element, by, expect, waitFor} = require('detox');

describe('Pełny cykl życia użytkownika w aplikacji PingPong', () => {
    // Unikalne nazwy dla graczy i turnieju, aby unikać konfliktów przy kolejnych uruchomieniach
    const timestamp = Date.now();
    const playerName1 = `Zawodnik E2E A ${timestamp}`;
    const playerNickname1 = `E2EA`;
    const playerName2 = `Zawodnik E2E B ${timestamp}`;
    const playerNickname2 = `E2EB`;
    const tournamentName = `Turniej E2E ${timestamp}`;

    // Uruchomienie aplikacji raz, przed wszystkimi testami w tym pliku.
    beforeAll(async () => {
        // Używamy najprostszej konfiguracji uruchomienia, aby zdiagnozować problem.
        await device.launchApp({ newInstance: true });
    });

    // Zamykamy i czyścimy zasoby po wszystkich testach.
    afterAll(async () => {
        await detox.cleanup();
    });


    describe('Sekcja 1: Tworzenie Graczy i Meczu', () => {
        // Ważne: Po usunięciu beforeEach, każdy test kontynuuje od miejsca,
        // w którym zakończył się poprzedni. Testy muszą być napisane w logicznej kolejności.

        it('powinien pomyślnie utworzyć dwóch nowych graczy', async () => {
            // Przejdź do ekranu graczy
            await element(by.text('Players')).tap();

            // Utwórz pierwszego gracza
            await element(by.text('Add Player')).tap();
            await expect(element(by.text('Add New Player'))).toBeVisible();
            await element(by.id('player-name-input')).typeText(playerName1);
            await element(by.id('player-nickname-input')).typeText(playerNickname1);
            await element(by.id('save-player-button')).tap();

            // Poczekaj na powrót do listy graczy i sprawdź, czy nowy gracz jest widoczny
            await waitFor(element(by.text(playerName1))).toBeVisible().withTimeout(5000);

            // Utwórz drugiego gracza
            await element(by.text('Add Player')).tap();
            await expect(element(by.text('Add New Player'))).toBeVisible();
            await element(by.id('player-name-input')).typeText(playerName2);
            await element(by.id('player-nickname-input')).typeText(playerNickname2);
            await element(by.id('save-player-button')).tap();

            // Sprawdź, czy obaj gracze są na liście
            await waitFor(element(by.text(playerName2))).toBeVisible().withTimeout(5000);
            await expect(element(by.text(playerName1))).toBeVisible();
        });

        it('powinien pomyślnie zarejestrować mecz pomiędzy nowymi graczami', async () => {
            // Przejdź do ekranu dodawania meczu
            await element(by.text('Add Match')).tap();
            await expect(element(by.text('Record New Match'))).toBeVisible();

            // Wybierz graczy
            await element(by.id('player-selector-1')).tap();
            await element(by.text(playerName1)).tap();

            await element(by.id('player-selector-2')).tap();
            await element(by.text(playerName2)).tap();

            // Wprowadź wyniki setów
            await element(by.id('set-1-player1-score')).typeText('11');
            await element(by.id('set-1-player2-score')).typeText('5');
            await element(by.id('add-set-button')).tap();
            await element(by.id('set-2-player1-score')).typeText('8');
            await element(by.id('set-2-player2-score')).typeText('11');
            await element(by.id('add-set-button')).tap();
            await element(by.id('set-3-player1-score')).typeText('11');
            await element(by.id('set-3-player2-score')).typeText('9');

            // Zapisz mecz
            await element(by.id('record-match-button')).tap();

            // Przejdź do ekranu głównego i zweryfikuj ostatni mecz
            await element(by.text('Home')).tap();
            await waitFor(element(by.text('Recent Matches'))).toBeVisible().withTimeout(5000);

            const matchCard = element(by.id(`match-card-vs-${playerName1}-${playerName2}`));
            await expect(matchCard).toBeVisible();
            await expect(element(by.text('2 - 1')).ancestor(by.id(matchCard.id))).toBeVisible();
        });
    });

    describe('Sekcja 2: Zarządzanie Turniejem', () => {
        it('powinien utworzyć turniej i dodać do niego graczy', async () => {
            await element(by.text('Tournaments')).tap();
            await element(by.id('create-tournament-button')).tap();

            await expect(element(by.text('Create Tournament'))).toBeVisible();
            await element(by.id('tournament-name-input')).typeText(tournamentName);

            // Wybierz graczy
            await element(by.text(playerName1)).tap();
            await element(by.text(playerName2)).tap();

            await element(by.id('submit-tournament-button')).tap();

            await waitFor(element(by.text(tournamentName))).toBeVisible().withTimeout(5000);
            await expect(element(by.text('Upcoming'))).toBeVisible();
        });

        it('powinien rozpocząć turniej i zarejestrować wynik meczu', async () => {
            // Test kontynuuje na ekranie listy turniejów
            await element(by.text(tournamentName)).tap();

            // Rozpocznij turniej
            await element(by.id('start-tournament-button')).tap();
            await waitFor(element(by.text('In Progress'))).toBeVisible().withTimeout(5000);

            // Przejdź do zakładki z meczami
            await element(by.text('Matches')).tap();

            const firstMatch = element(by.id('record-tournament-match-button')).atIndex(0);
            await waitFor(firstMatch).toBeVisible().withTimeout(5000);
            await firstMatch.tap();

            // Zarejestruj wynik
            await expect(element(by.text('Record Tournament Match'))).toBeVisible();
            await element(by.id('set-1-player1-score')).typeText('11');
            await element(by.id('set-1-player2-score')).typeText('7');
            await element(by.id('add-set-button')).tap();
            await element(by.id('set-2-player1-score')).typeText('11');
            await element(by.id('set-2-player2-score')).typeText('8');

            await element(by.id('record-match-button')).tap();

            // Poczekaj na powrót do szczegółów turnieju i zweryfikuj wynik
            await waitFor(element(by.text(tournamentName))).toBeVisible().withTimeout(10000);
            await element(by.text('Matches')).tap();
            await expect(element(by.text('2-0'))).toBeVisible();
        });

        it('powinien zakończyć turniej i zweryfikować zwycięzcę', async () => {
            // Przejdź z powrotem do listy turniejów
            await element(by.text('Tournaments')).tap();
            await element(by.text(tournamentName)).tap();

            await element(by.id('complete-tournament-button')).tap();

            await waitFor(element(by.text('Select Tournament Winner'))).toBeVisible().withTimeout(2000);
            await element(by.id(`select-winner-${playerName1}`)).tap();
            await element(by.id('confirm-winner-button')).tap();

            await waitFor(element(by.text('Completed'))).toBeVisible().withTimeout(5000);
            await expect(element(by.id('tournament-winner-name'))).toHaveText(playerName1);
        });
    });

    describe('Sekcja 3: Weryfikacja Danych i Statystyk', () => {
        it('powinien zweryfikować zaktualizowane statystyki gracza', async () => {
            await element(by.text('Players')).tap();
            await element(by.text(playerName1)).tap();

            await waitFor(element(by.id('player-profile-name'))).toHaveText(playerName1).withTimeout(5000);

            await expect(element(by.id('player-stats-wins'))).toHaveText('1');
            await expect(element(by.id('player-stats-losses'))).toHaveText('0');

            await element(by.text('Achievements')).tap();
            await expect(element(by.text('First Win'))).toBeVisible();
            await expect(element(by.text('Tournament Victory'))).toBeVisible();
        });

        it('powinien wylogować użytkownika', async () => {
            await element(by.text('Profile')).tap();
            await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(2000);

            await element(by.id('sign-out-button')).tap();
            await element(by.text('Sign Out')).atIndex(1).tap();

            await waitFor(element(by.id('login-screen'))).toBeVisible().withTimeout(10000);
        });
    });
});
