// utils/env.js
export const getBackendURL = () => {
    const isLocal = window.location.hostname === 'localhost'
    return isLocal
      ? 'http://localhost:4000'
      : import.meta.env.VITE_BACKEND_URL
  }
  