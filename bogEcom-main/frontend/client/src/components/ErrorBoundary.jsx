"use client";

import { Button } from "@mui/material";
import { Component } from "react";
import { IoWarningOutline } from "react-icons/io5";

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs errors, and displays a fallback UI.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 * Or with custom fallback:
 *   <ErrorBoundary fallback={<CustomErrorUI />}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console (in production, send to error tracking service)
    console.error("Error Boundary caught an error:", error, errorInfo);

    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // In production, you could send this to an error tracking service
    // Example: sendToErrorTrackingService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
          <IoWarningOutline className="text-6xl text-red-500 mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-6 text-center max-w-md">
            We're sorry, but something unexpected happened. Please try again or
            refresh the page.
          </p>
          <div className="flex gap-4">
            <Button
              variant="outlined"
              onClick={this.handleReset}
              className="!border-gray-400 !text-gray-700"
            >
              Try Again
            </Button>
            <Button
              variant="contained"
              onClick={this.handleReload}
              className="!bg-primary !text-white"
            >
              Refresh Page
            </Button>
          </div>

          {/* Show error details in development */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-6 w-full max-w-2xl">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                View Error Details (Development Only)
              </summary>
              <div className="mt-2 p-4 bg-red-50 rounded-md overflow-auto">
                <p className="text-red-700 font-mono text-sm">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
