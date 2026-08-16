import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetData = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear storage', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-rose-500/30">
              ⚠️
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-tight">Ndodhi një gabim gjatë ngarkimit</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikacioni hasi një pengesë të papritur. Mund ta rifreskoni faqen ose të pastroni memorien e ruajtur lokale.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-left overflow-auto max-h-32 text-[11px] font-mono text-rose-300">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                Rifresko Faqen
              </button>
              <button
                type="button"
                onClick={this.handleResetData}
                className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Rivendos të Dhënat
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
