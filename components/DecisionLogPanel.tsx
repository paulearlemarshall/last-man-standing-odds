
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import type { DecisionLogEntry } from '../types';
import CollapsibleSection from './CollapsibleSection';

interface DecisionLogPanelProps {
    logs: DecisionLogEntry[];
}

const DecisionLogPanel: React.FC<DecisionLogPanelProps> = ({ logs }) => {
    if (!logs || logs.length === 0) {
        return null; // Don't show if no logs (hasn't run yet)
    }

    const getTypeStyles = (type: DecisionLogEntry['type']) => {
        switch (type) {
            case 'success': return 'text-green-400 border-l-2 border-green-500 bg-green-900/10';
            case 'warning': return 'text-yellow-400 border-l-2 border-yellow-500 bg-yellow-900/10';
            case 'error': return 'text-red-400 border-l-2 border-red-500 bg-red-900/10';
            case 'process': return 'text-blue-300 border-l-2 border-blue-500 bg-blue-900/10';
            default: return 'text-gray-300 border-l-2 border-gray-500';
        }
    };

    return (
        <CollapsibleSection title="Pick Logic Trace" defaultOpen={false}>
            <div className="space-y-4">
                <p className="text-gray-400 text-sm mb-2">
                    Visual trace of the 'Suggest Picks' algorithm decision making process.
                </p>
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto">
                    {logs.map((log) => (
                        <div key={log.id} className={`mb-2 pl-3 py-1 ${getTypeStyles(log.type)}`}>
                            <div className="flex justify-between items-start">
                                <span className="font-semibold">{log.message}</span>
                                <span className="text-xs text-gray-600 ml-2 whitespace-nowrap">
                                    {(() => {
                                        const d = new Date(log.timestamp);
                                        return `${d.toLocaleTimeString(undefined, {
                                            hour12: false, 
                                            hour: "2-digit", 
                                            minute: "2-digit", 
                                            second: "2-digit"
                                        })}.${d.getMilliseconds().toString().padStart(3, '0')}`;
                                    })()}
                                </span>
                            </div>
                            {log.details && (
                                <div className="text-xs text-gray-500 mt-1 pl-1">
                                    {log.details}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default DecisionLogPanel;
