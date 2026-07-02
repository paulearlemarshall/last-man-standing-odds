import React from 'react';

export const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
  <span className="group relative inline-flex items-center">
    <span
      tabIndex={0}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-500 text-[10px] text-gray-300 cursor-help"
      aria-label={text}
    >
      ?
    </span>
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-[11px] leading-snug text-gray-100 shadow-lg group-hover:block group-focus-within:block">
      {text}
    </span>
  </span>
);

export const MetricLabel: React.FC<{ label: string; help: string }> = ({ label, help }) => (
  <p className="text-xs text-gray-400 flex items-center">
    {label}
    <InfoTooltip text={help} />
  </p>
);

export const formatMetric = (value: number | null): string => (value === null ? 'n/a' : value.toFixed(4));
export const renderDelta = (value: number | null): string =>
  value === null ? 'n/a' : `${value > 0 ? '+' : ''}${value.toFixed(4)}`;
export const formatTimelineDate = (createdAt: string): string =>
  new Date(createdAt).toLocaleString('en-GB', { hour12: false, timeZone: 'Europe/London' });
