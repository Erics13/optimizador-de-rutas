import React from 'react';
import { CheckCircleIcon, CogIcon } from './icons';

interface FileUploadButtonProps {
  id: string;
  label: string;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isLoaded: boolean;
  isLoading: boolean;
  icon: React.ReactNode;
}

export const FileUploadButton: React.FC<FileUploadButtonProps> = ({ id, label, onFileChange, isLoaded, isLoading, icon }) => {
  const isDisabled = isLoading || isLoaded;
  
  return (
    <label
      htmlFor={id}
      className={`relative w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg transition-colors duration-200 ${
        isLoaded 
          ? 'border-green-400 bg-green-50 text-green-800 cursor-default' 
          : isLoading
          ? 'border-slate-300 bg-slate-100 text-slate-500 cursor-wait'
          : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer'
      }`}
    >
      {isLoaded ? (
        <CheckCircleIcon className="h-6 w-6 text-green-500" />
      ) : isLoading ? (
        <CogIcon className="h-6 w-6 animate-spin" />
      ) : (
        <div className="h-6 w-6">{icon}</div>
      )}

      <span className="font-semibold">
        {isLoaded ? 'Archivo Cargado' : isLoading ? 'Procesando...' : label}
      </span>
      
      <input
        id={id}
        type="file"
        className="hidden"
        onChange={onFileChange}
        accept=".csv,.xlsx"
        disabled={isDisabled}
      />
    </label>
  );
};