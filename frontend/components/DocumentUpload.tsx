"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { uploadDocument, UploadResponse } from "@/lib/api";

interface UploadedFile {
  file: File;
  status: "uploading" | "success" | "error";
  message?: string;
}

interface DocumentUploadProps {
  onUploadSuccess?: (response: UploadResponse) => void;
}

export default function DocumentUpload({ onUploadSuccess }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = ["application/pdf", "text/plain"];

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (!fileArray.length) return;

    const newEntries: UploadedFile[] = fileArray.map((file) => ({ file, status: "uploading" }));
    setUploadedFiles((prev) => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      try {
        const response = await uploadDocument(entry.file);
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.file === entry.file ? { ...f, status: "success", message: response.message } : f
          )
        );
        onUploadSuccess?.(response);
      } catch {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.file === entry.file ? { ...f, status: "error", message: "Error al subir" } : f
          )
        );
      }
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="w-full space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors duration-200 ${
          isDragging ? "border-indigo-500 bg-indigo-950/20" : "border-gray-700 hover:border-indigo-500 hover:bg-indigo-950/10"
        }`}
      >
        <UploadCloud className={`w-10 h-10 ${isDragging ? "text-indigo-400" : "text-gray-500"}`} />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-300">
            Arrastra archivos aquí o{" "}
            <span className="text-indigo-400 underline">selecciona desde tu equipo</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">PDF, TXT — máx. 50 MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {uploadedFiles.length > 0 && (
        <ul className="space-y-2">
          {uploadedFiles.map(({ file, status, message }) => (
            <li key={file.name + file.lastModified}
              className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
              <FileText className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatSize(file.size)}{message && ` — ${message}`}</p>
              </div>
              {status === "uploading" && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
              {status === "success" && <CheckCircle className="w-5 h-5 text-emerald-400" />}
              {status === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
              <button onClick={(e) => { e.stopPropagation(); setUploadedFiles((p) => p.filter((f) => f.file !== file)); }}
                className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
