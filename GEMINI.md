# Gemini Project Configuration

This file helps Gemini understand your project's conventions and settings.

## Project Overview

*   **Name:** PingPong
*   **Description:** A mobile application for tracking ping pong matches and tournaments.
*   **Frameworks:** React Native, Expo
*   **UI:** React Native components, with a custom color scheme defined in `constants/colors.ts`.
*   **Routing:** `expo-router` for file-based routing.
*   **State Management:** Zustand for global state management (e.g., `playerStore`, `matchStore`).
*   **Data Fetching & API:**
    *   tRPC for type-safe client-server communication.
    *   `@tanstack/react-query` for server state management.
*   **Backend:**
    *   tRPC backend.
    *   Supabase for the database (PostgreSQL) and authentication.
    *   Supabase real-time subscriptions for live data updates.
*   **Testing:** Jest for unit/integration tests, Detox for e2e tests.

## Key Architectural Patterns

*   **State Management:** Global state is managed in Zustand stores (`/store`). Stores are responsible for fetching data from Supabase and handling real-time updates.
*   **Data Flow:**
    1.  UI components trigger actions in Zustand stores.
    2.  Zustand stores interact with the Supabase backend (via `supabase-js` client or tRPC).
    3.  tRPC routers on the backend (`/backend/server/trpc/routers`) contain the API logic.
    4.  Supabase real-time subscriptions push data changes to the client, which then updates the Zustand stores.
*   **Custom Hooks:** Custom hooks (`/hooks`) are used to encapsulate reusable logic, such as fetching the current user's profile (`usePlayerProfile`).

## Conventions

*   **Code Style:** Follow existing code style. Use Prettier for formatting.
*   **Commit Messages:** Use conventional commit messages (e.g., `feat: add new feature`, `fix: fix a bug`).
*   **Branching:** Use `feature/` for new features, `bugfix/` for bug fixes.
*   **File Naming:**
    *   Components: `PascalCase.tsx`
    *   Stores: `camelCaseStore.ts`
    *   Screens: `kebab-case.tsx` or `[id].tsx` for dynamic routes.

## Important Commands

*   **Run tests:** `npm test`
*   **Run linter:** `npm run lint`
*   **Start development server:** `npm start`

## Problems
1.  Mam problem z moja aplikacja. podczas dodawania meczu w ramach turnieju dodawanie meczu trwa bardzo długo oraz mecz nie pojawia się zbyt szybko w UI. Kiedy jeden zawodnik na swoim urzadzeniu doda mecz w ramach turnieju to inny uzytkownik na swoim telefonie widzi ten mecz z duzym opoznieniem, pomino tego ze dla tej tabeli w supabase mam wlaczaną opcję realtime on. Zoptymalizuj to i przyspiesz.
Spróbuj zastosowac takie rozwiązania:
a) Realtime updates - mecze pojawiają się natychmiast u wszystkich
b) Optymistic UI - immediate feedback dla użytkownika
c) Batch operations - mniej database calls
d) Concurrent operations - Promise.allSettled zamiast sequential await
e) Removed delays - brak setTimeout opóźnień
f) Better error handling - rollback przy błędach
g) Debounced fetching - mniej zbędnych refresh calls
