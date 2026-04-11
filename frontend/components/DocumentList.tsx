"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader2, Clock } from "lucide-react";
import { getDocuments, deleteDocument, Document } from "@/lib/api";

interface DocumentListProps {
  refreshTrigger?: number;
  onSelectionChange?: (selectedIds: string[]) => void;
  selectable?: boolean;
}

export default function DocumentList({ refreshTrigger, onSelectionChange, selectable = false }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocuments(await getDocuments());
    } catch {
      setError("No se pudieron cargar los documentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments, refreshTrigger]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      onSelectionChange?.([...next]);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este documento?")) return;
    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); onSelectionChange?.([...next]); return next; });
    } catch {
      alert("No se pudo eliminar el documento.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-500">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      <span className="text-sm">Cargando documentos…</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-12 text-red-400">
      <AlertCircle className="w-8 h-8" />
      <p className="text-sm">{error}</p>
      <button onClick={fetchDocuments} className="flex items-center gap-1 text-sm text-indigo-400 hover:underline">
        <RefreshCw className="w-4 h-4" /> Reintentar
      </button>
    </div>
  );

  if (!documents.length) return (
    <div className="flex flex-col items-center gap-2 py-12 text-gray-600">
      <FileText className="w-10 h-10" />
      <p className="text-sm">No hay documentos cargados aún.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
          {documents.length} documento{documents.length !== 1 ? "s" : ""}
        </p>
        <button onClick={fetchDocuments} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id}
            className={`flex items-center gap-3 bg-gray-900 border rounded-lg px-4 py-3 transition-colors duration-150 ${
              selectable ? "cursor-pointer hover:border-indigo-500/50" : ""
            } ${selectedIds.has(doc.id) ? "border-indigo-500 bg-indigo-950/20" : "border-gray-800"}`}
            onClick={() => selectable && toggleSelect(doc.id)}>
            {selectable && (
              <input type="checkbox" checked={selectedIds.has(doc.id)}
                onChange={() => toggleSelect(doc.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 accent-indigo-500 shrink-0" />
            )}
            <FileText className="w-5 h-5 text-gray-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{doc.filename}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(doc.upload_date)}</span>
                {doc.chunk_count !== undefined && <><span>·</span><span>{doc.chunk_count} fragmentos</span></>}
              </div>
            </div>
            {doc.status === "ready" && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
            {doc.status === "processing" && <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />}
            {doc.status === "error" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            <button disabled={deletingId === doc.id}
              onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
              className="p-1.5 rounded hover:bg-red-950/40 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40">
              {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
