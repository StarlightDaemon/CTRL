import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-primary text-text-primary text-center">
                    <div className="text-4xl mb-4">😵</div>
                    <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                    <p className="text-sm text-text-secondary mb-6 max-w-xs">
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-accent text-white px-4 py-2 rounded hover:bg-accent-hover transition-colors"
                    >
                        Reload Extension
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
