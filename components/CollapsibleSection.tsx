/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sectionId = `section-content-${title.replace(/\s+/g, '-')}`;
  const titleId = `section-title-${title.replace(/\s+/g, '-')}`;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl">
      <header
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={sectionId}
      >
        <h2 id={titleId} className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-6 w-6 text-gray-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </header>
      {isOpen && (
        <div id={sectionId} className="p-4 sm:p-6 border-t border-gray-700" role="region" aria-labelledby={titleId}>
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;