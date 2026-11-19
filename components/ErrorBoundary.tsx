import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado al renderizar la vista.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary capturó un fallo de renderizado:', error, info);
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm text-center space-y-4">
            <div className="size-12 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">error</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                No se pudo cargar esta sección
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Se detectó un problema con los datos de esta vista. Puedes volver a intentarlo sin perder tu sesión.
              </p>
              {this.state.errorMessage && (
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#121212] p-2 rounded-lg border border-gray-200 dark:border-gray-800 break-words mt-2">
                  {this.state.errorMessage}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleRecover}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                Reintentar vista
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
