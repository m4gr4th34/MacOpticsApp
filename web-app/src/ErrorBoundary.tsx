import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 p-8 font-mono">
          <h1 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h1>
          <pre className="text-sm overflow-auto bg-black/30 p-4 rounded-lg">
            {this.state.error.toString()}
          </pre>
          <p className="mt-4 text-slate-400 text-sm">
            Check the browser console for more details.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
