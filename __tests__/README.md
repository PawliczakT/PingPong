# Testing Strategy for PingPong App

This document outlines the testing strategy for the PingPong App, including setup instructions, test organization, and best practices.

## Testing Setup

The project uses the following testing tools:

- **Jest**: JavaScript testing framework
- **React Native Testing Library**: For testing React Native components
- **Jest Expo**: Jest preset for Expo projects

## Running Tests

To run the tests, use the following npm scripts:

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Organization

Tests are organized in the `__tests__` directory with the following structure:

- `__tests__/components`: Tests for UI components
- `__tests__/screens`: Tests for screen components
- `__tests__/utils`: Tests for utility functions

## Writing Tests

### Component Tests

Component tests should verify:
- The component renders correctly
- User interactions work as expected
- Props are handled correctly

Example:
```jsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Some Text')).toBeTruthy();
  });

  it('handles user interaction', () => {
    const onPressMock = jest.fn();
    render(<MyComponent onPress={onPressMock} />);
    fireEvent.press(screen.getByText('Press Me'));
    expect(onPressMock).toHaveBeenCalled();
  });
});
```

### Utility Tests

Utility tests should verify:
- Functions return the expected output for various inputs
- Edge cases are handled correctly
- Error conditions are handled appropriately

Example:
```js
import { myUtilityFunction } from '@/utils/myUtility';

describe('myUtilityFunction', () => {
  it('returns expected output for valid input', () => {
    expect(myUtilityFunction(1, 2)).toBe(3);
  });

  it('handles edge cases', () => {
    expect(myUtilityFunction(0, 0)).toBe(0);
  });

  it('throws error for invalid input', () => {
    expect(() => myUtilityFunction(-1, 2)).toThrow();
  });
});
```

## Mocking

### Mocking Hooks

When testing components that use hooks, mock the hooks to return controlled test data:

```jsx
jest.mock('@/hooks/useMyHook', () => ({
  useMyHook: () => ({
    data: 'test data',
    loading: false,
    error: null,
  }),
}));
```

### Mocking Navigation

For components that use navigation:

```jsx
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));
```

## Coverage Goals

The project aims for the following code coverage:
- Statements: 70%
- Branches: 70%
- Functions: 70%
- Lines: 70%

## Future Enhancements

- **E2E Testing**: Implement end-to-end testing with Detox
- **Visual Regression Testing**: Add visual regression testing for UI components
- **Performance Testing**: Add performance testing for critical paths
