/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
    console.error('ErrorBoundary caught an unhandled application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 select-none">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-3xl p-8 shadow-2xl text-center space-y-4">
            <span className="text-4xl">🌱</span>
            <h2 className="text-xl font-bold font-['Space_Grotesk'] text-amber-300">
              Oddlings Engine Notice
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              A temporary interface hiccup occurred. Your saved creatures and custom biomes are safely stored.
            </p>
            <div className="pt-2">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-slate-950 font-bold font-mono text-xs shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                Reload Habitat
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
