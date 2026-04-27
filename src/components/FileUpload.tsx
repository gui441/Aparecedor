import React, { useCallback, useState } from 'react';
import { Upload, X, ImageIcon, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    onFileSelect(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearPreview = () => {
    setPreview(null);
  };

  return (
    <div className="w-full space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-inner p-10 text-center transition-all duration-200 cursor-pointer ${
          isDragging
            ? 'border-primary bg-blue-50/50'
            : 'border-border-base bg-slate-50 hover:border-primary hover:bg-blue-50/30'
        } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center">
          <span className="text-3xl mb-3 block">📤</span>
          <p className="text-sm font-bold text-text-base">Arraste sua imagem</p>
          <p className="text-xs text-text-muted mt-1 leading-tight">
            PNG, JPG ou JPEG (Máx 5MB)
          </p>
          {isLoading && (
            <div className="mt-4 flex items-center gap-2 text-primary font-bold text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>PROCESSANDO...</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">
                Visualização
              </h3>
              <button
                onClick={clearPreview}
                className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-bold hover:bg-red-100 transition-colors"
              >
                REMOVER
              </button>
            </div>
            
            <div className="w-full h-80 bg-slate-200 rounded-lg overflow-hidden relative shadow-inner">
              <img src={preview} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              <div className="absolute inset-x-0 bottom-0 h-10 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                <p className="text-[10px] text-white font-bold tracking-widest px-4 truncate">
                  {preview.substring(0, 50)}...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
