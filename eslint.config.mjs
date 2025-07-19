import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            '**/dist/**',
            '**/build/**',
            '**/node_modules/**',
            '**/.expo/**',
            '**/android/**',
            '**/ios/**',
            '**/coverage/**',
            '**/*.d.ts',
            '**/assets/**',
            '**/public/**',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                __DEV__: 'readonly',
                global: 'readonly',
                console: 'readonly',
                process: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',

            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/prefer-const': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            'prefer-const': 'off',
            'no-console': 'off',
            'no-empty': 'off',
            'no-undef': 'off',
            'react/react-in-jsx-scope': 'off',
        },
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-var-requires': 'off',
        },
    },
    {
        files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    }
);
