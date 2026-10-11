import React from 'react';

const LoadingState = ({ label = 'Loading your data...' }) => (
  <div className="loading-state" role="status" aria-live="polite">
    <span className="loading-spinner" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

export default LoadingState;
