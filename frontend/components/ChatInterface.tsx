"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send, Bot, User, Loader2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { sendChatMessage, ChatMessage, Source } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  loading?: boolean;
}

function SourceCard({ source }: { source: Source }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden text-xs">
      <button onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 transition-colors text-left">
        <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="flex-1 font-medium text-gray-300 truncate">{source.filename}</span>
        <span className="text-gray-500 shrink-0">{Math.round(source.score * 100)}% relevancia</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 py-2 text-gray-400 leading-relaxed bg-gray-900 font-mono">
          {source.chunk_text}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        isUser ? "bg-indigo-600 text-white" : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[75%] space-y-2 flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-indigo-600 text-white rounded-tr-sm"
            : "bg-violet-950/30 border border-violet-800/30 text-gray-100 rounded-tl-sm"
        }`}>
          {message.loading ? (
            <span className="flex items-center gap-2 text-violet-400">
              <span className="flex gap-1">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
              </span>
              Pensando…
            </span>
          ) : message.content}
        </div>
        {!message.loading && message.sources && message.sources.length > 0 && (
          <div className="w-full space-y-1">
            <p className="text-xs text-gray-500 px-1">Fuentes:</p>
            {message.sources.map((source, i) => <SourceCard key={i} source={source} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatInterface({ selectedDocumentIds = [] }: { selectedDocumentIds?: string[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await sendChatMessage(trimmed, selectedDocumentIds, history);
      setMessages((prev) =>
        prev.map((m) => m.id === loadingMsg.id
          ? { ...m, content: response.answer, sources: response.sources, loading: false }
          : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === loadingMsg.id
          ? { ...m, content: "Error al procesar la consulta. Inténtalo de nuevo.", loading: false }
          : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
      <div className="px-5 py-3 bg-gray-900 border-b border-gray-800 flex items-center gap-2">
        <Bot className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold text-gray-200 text-sm">DocuMind Chat</span>
        {selectedDocumentIds.length > 0 && (
          <span className="ml-auto text-xs bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded-full">
            {selectedDocumentIds.length} doc{selectedDocumentIds.length !== 1 ? "s" : ""} activo{selectedDocumentIds.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 gap-3">
            <Bot className="w-12 h-12 text-gray-700" />
            <p className="text-sm font-medium text-gray-500">
              {selectedDocumentIds.length === 0 ? "Selecciona documentos y empieza a preguntar" : "Escribe tu primera pregunta"}
            </p>
            <p className="text-xs max-w-xs text-gray-600">Respondo basándome en el contenido de tus documentos.</p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-3 bg-gray-900 border-t border-gray-800 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Pregunta algo sobre tus documentos… ✨"
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 disabled:opacity-50 max-h-40 overflow-y-auto"
        />
        <button type="submit" disabled={!input.trim() || isLoading}
          className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
