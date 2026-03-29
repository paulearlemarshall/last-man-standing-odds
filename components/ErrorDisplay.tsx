/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';

interface ErrorDisplayProps {
  message: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center bg-red-900/20 border border-red-500 rounded-lg p-8 my-10">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 className="text-xl font-semibold text-red-300">An Error Occurred</h3>
      <p className="mt-2 text-red-200 max-w-md">{message}</p>
    </div>
  );
};

export default ErrorDisplay;