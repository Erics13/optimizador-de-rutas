
import React, { useEffect } from 'react';
import { XMarkIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true"></div>
      
      <div className="relative w-11/12 max-w-6xl h-5/6 bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-2 text-slate-500 hover:text-slate-800 bg-white/50 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Cerrar modal"
        >
            <XMarkIcon className="h-6 w-6" />
        </button>
        {children}
      </div>
    </div>
  );
};
