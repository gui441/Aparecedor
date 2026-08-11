import React, { useCallback, useState } from 'react';
import { Upload, X, ImageIcon, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState<{ name: string; size: number } | null>(null);

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
    setSelectedFileInfo({
      name: file.name,
      size: file.size
    });
  };

  const clearFile = () => {
    setSelectedFileInfo(null);
  };

  return (
    <div className="w-full space-y-4">
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
        {selectedFileInfo && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center justify-between p-3.5 bg-slate-100 border border-slate-200 rounded-xl"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg">📄</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate max-w-[200px] sm:max-w-xs">
                  {selectedFileInfo.name}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold">
                  {(selectedFileInfo.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="text-[10px] font-bold text-slate-500 hover:text-red-650 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 transition-colors uppercase"
            >
              Limpar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
