import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export interface Document {
  id: string;
  filename: string;
  file_size: number;
  upload_date: string;
  status: "processing" | "ready" | "error";
  chunk_count?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Source {
  document_id: string;
  filename: string;
  chunk_text: string;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface UploadResponse {
  document_id: string;
  filename: string;
  message: string;
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<UploadResponse>("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getDocuments(): Promise<Document[]> {
  const response = await api.get<Document[]>("/documents");
  return response.data;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await api.delete(`/documents/${documentId}`);
}

export async function sendChatMessage(
  message: string,
  documentIds?: string[],
  conversationHistory?: ChatMessage[]
): Promise<ChatResponse> {
  const response = await api.post<ChatResponse>("/chat", {
    message,
    document_ids: documentIds ?? [],
    conversation_history: conversationHistory ?? [],
  });
  return response.data;
}

export async function checkHealth(): Promise<{ status: string }> {
  const response = await api.get<{ status: string }>("/health");
  return response.data;
}
