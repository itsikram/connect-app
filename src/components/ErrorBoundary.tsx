import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { themes } from '../theme/colors';

// This screen can render outside the ThemeProvider, so it uses the default
// (dark) palette directly; every pair here passes WCAG AA contrast.
const palette = themes.dark;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  private _isMounted: boolean = false;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this._isMounted = true;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Always log errors (even in production) to diagnose crashes
    console.error('ErrorBoundary caught an error:', {
      message: error?.message || String(error),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      name: error?.name
    });
    
    // Prevent state update if component is unmounting
    if (this._isMounted !== false) {
      this.setState({
        error,
        errorInfo,
      });
    }
  }
  
  componentDidMount() {
    this._isMounted = true;
  }
  
  componentWillUnmount() {
    this._isMounted = false;
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>!</Text>
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            Sorry, this screen hit an unexpected problem. Your data is safe. Try again, and if it keeps happening, restart the app.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorText}>
              Error: {this.state.error.toString()}
            </Text>
          )}
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry} accessibilityRole="button">
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: palette.background.primary,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    backgroundColor: palette.surface.secondary,
  },
  badgeText: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: palette.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    maxWidth: 360,
  },
  errorText: {
    fontSize: 12,
    color: palette.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: palette.surface.primary,
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  retryButtonText: {
    color: palette.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ErrorBoundary;
