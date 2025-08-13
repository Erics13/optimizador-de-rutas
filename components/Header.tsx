
import React from 'react';
import { RouteIcon } from './icons';

export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-6 md:px-8 flex items-center gap-4">
        <div className="bg-indigo-600 p-3 rounded-lg text-white">
          <RouteIcon className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Optimizador de Rutas de Alumbrado</h1>
          <p className="text-slate-500">Generación de rutas eficientes para cuadrillas de mantenimiento.</p>
        </div>
      </div>
    </header>
  );
};
