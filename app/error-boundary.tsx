//app/error-boundary.tsx
import React from 'react';
import {Platform, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

interface Props {
    children: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    fallback?: React.ReactNode;
    resetOnRetry?: boolean;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    errorTimestamp: string | null;
    errorId: string;
}

const generateErrorId = () => {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const reportError = async (error: Error, errorInfo?: React.ErrorInfo, context: Record<string, any> = {}) => {
    const errorData = {
        id: generateErrorId(),
        message: error.message,
        name: error.name,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        userAgent: Platform.OS === 'web' ? window.navigator.userAgent : null,
        url: Platform.OS === 'web' ? window.location.href : null,
        ...context
    };

    if (process.env.NODE_ENV === 'production') {
        try {
        } catch (e) {
            console.error('Failed to report error:', e);
        }
    }

    return errorData;
};

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorTimestamp: null,
            errorId: ''
        };
    }

    static getDerivedStateFromError(error: Error) {
        return {
            hasError: true,
            error,
            errorTimestamp: new Date().toISOString(),
            errorId: generateErrorId()
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({errorInfo});
        reportError(error, errorInfo, {
            componentStack: errorInfo.componentStack
        }).then(({id}) => {
            this.setState({errorId: id});
        }).catch(console.error);

        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleReset = () => {
        if (this.props.resetOnRetry) {
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
                errorTimestamp: null,
                errorId: ''
            });
        } else {
            window.location.reload();
        }
    };

    renderErrorDetails = () => {
        if (process.env.NODE_ENV !== 'development') return null;

        return (
            <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>Error Details (Development Only)</Text>
                <Text style={styles.errorMessage}>{this.state.error?.toString()}</Text>
                <Text style={styles.errorStack}>{this.state.errorInfo?.componentStack}</Text>
                <Text style={styles.errorId}>Error ID: {this.state.errorId}</Text>
                <Text style={styles.errorTime}>{this.state.errorTimestamp}</Text>
            </View>
        );
    };

    renderFallback() {
        if (this.props.fallback) {
            return (
                <View style={styles.fallbackContainer}>
                    {this.props.fallback}
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={this.handleReset}
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.title}>Something went wrong</Text>
                    <Text style={styles.subtitle}>
                        We've encountered an unexpected error. Our team has been notified.
                    </Text>
                    <Text style={styles.errorId}>Error ID: {this.state.errorId}</Text>

                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={this.handleReset}
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>

                    {this.renderErrorDetails()}
                </View>
            </View>
        );
    }

    render() {
        if (this.state.hasError) {
            return this.renderFallback();
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    content: {
        maxWidth: 500,
        width: '100%',
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#dc3545',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 24,
        color: '#6c757d',
        textAlign: 'center',
    },
    errorId: {
        fontSize: 12,
        color: '#6c757d',
        marginTop: 16,
        textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    retryButton: {
        backgroundColor: '#007bff',
        padding: 12,
        borderRadius: 6,
        alignItems: 'center',
        marginTop: 16,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    errorDetails: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderLeftWidth: 4,
        borderLeftColor: '#dc3545',
    },
    errorDetailsTitle: {
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#dc3545',
    },
    errorMessage: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 8,
        fontSize: 14,
    },
    errorStack: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 12,
        color: '#6c757d',
    },
    errorTime: {
        fontSize: 12,
        color: '#6c757d',
        marginTop: 8,
        fontStyle: 'italic',
    },
    fallbackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ErrorBoundary;
