/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 border-4 border-green-400 border-solid border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-lg text-gray-300">Fetching latest odds...</p>
    </div>
  );
};

export default LoadingSpinner;