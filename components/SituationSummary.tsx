

import React from 'react';
import { TagIcon } from './icons';

interface SituationSummary {
  situation: string;
  count: number;
}

interface SituationSummaryProps {
  summary: SituationSummary[];
}

export const SituationSummary: React.FC<SituationSummaryProps> = ({ summary }) => {
  if (summary.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6 animate-fade-in">
      <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-700 mb-4">
        <TagIcon className="h-5 w-5" />
        Resumen de Situaciones
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Situación
              </th>
              <th scope="col" className="w-24 px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Cantidad
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {summary.map(({ situation, count }) => (
              <tr key={situation}>
                <td className="px-4 py-3 text-sm text-slate-800 font-medium">{situation}</td>
                <td className="px-4 py-3 text-sm text-slate-600 font-bold text-right">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};