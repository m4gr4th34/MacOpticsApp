import '@testing-library/jest-dom'

// Polyfill ResizeObserver for react-zoom-pan-pinch in jsdom
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
