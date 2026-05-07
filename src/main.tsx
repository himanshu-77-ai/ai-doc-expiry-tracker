import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error?.message || "Unknown error" };
  }
  componentDidCatch(error: any, info: any) {
    console.error("[App Error]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#f8fafc", fontFamily: "Arial, sans-serif", padding: "2rem"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2 style={{ color: "#1e293b", marginBottom: "0.5rem" }}>Something went wrong</h2>
          <p style={{ color: "#64748b", marginBottom: "1.5rem", textAlign: "center" }}>
            The app encountered an error. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#2563eb", color: "white", border: "none",
              padding: "0.75rem 2rem", borderRadius: "0.75rem",
              fontSize: "1rem", cursor: "pointer", fontWeight: "bold"
            }}
          >
            🔄 Refresh Page
          </button>
          <p style={{ color: "#94a3b8", marginTop: "1rem", fontSize: "0.8rem" }}>
            Error: {this.state.error}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
