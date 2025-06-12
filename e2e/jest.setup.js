// Ten plik jest przeznaczony dla testów E2E i celowo NIE mockuje
// bibliotek takich jak Supabase, aby testować pełną integrację.

// Zwiększamy domyślny timeout dla operacji asynchronicznych w Jest
jest.setTimeout(120000);

// Można tu dodać inne globalne konfiguracje dla testów E2E,
// np. funkcje pomocnicze do logowania się przed testami.

// Przykład funkcji pomocniczej, która mogłaby być tu zdefiniowana:
/*
global.loginAsTestUser = async () => {
  await element(by.id('login-email-input')).typeText('test@example.com');
  await element(by.id('login-password-input')).typeText('password123');
  await element(by.id('login-submit-button')).tap();
  await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);
};
*/

console.log('E2E Jest setup file loaded. Supabase and other services will NOT be mocked.');
