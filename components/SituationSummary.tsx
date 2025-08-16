
import React from 'react';
import { CogIcon, TagIcon } from './icons';

interface SituationSummary {
  situation: string;
  count: number;
}

interface SituationSummaryProps {
  summary: SituationSummary[];
  onGenerateForSituation: (situation: string) => void;
}

export const SituationSummary: React.FC<SituationSummaryProps> = ({ summary, onGenerateForSituation }) => {
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
               <th scope="col" className="w-40 px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {summary.map(({ situation, count }) => (
              <tr key={situation}>
                <td className="px-4 py-3 text-sm text-slate-800 font-medium">{situation}</td>
                <td className="px-4 py-3 text-sm text-slate-600 font-bold text-right">{count}</td>
                <td className="px-4 py-3 text-sm text-center">
                    <button
                        onClick={() => onGenerateForSituation(situation)}
                        className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        title={`Generar rutas solo para "${situation}"`}
                    >
                        <CogIcon className="h-4 w-4" />
                        Generar Ruta
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
