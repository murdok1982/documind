"use client";

import { useState } from "react";
import { Bot, LayoutPanelLeft, MessageSquare } from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import ChatInterface from "@/components/ChatInterface";
import { UploadResponse } from "@/lib/api";

type Tab = "documents" | "chat";

export default function AppPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("documents");

  const handleUploadSuccess = (_response: UploadResponse) => {
    setRefreshTrigger((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <Bot className="w-6 h-6 text-indigo-400" />
        <span className="font-bold text-white">Docu<span className="text-indigo-400">Mind</span></span>
        <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded-full font-medium ml-1">beta</span>

        <nav className="ml-auto flex sm:hidden gap-1 bg-gray-800 p-1 rounded-lg">
          {([
            { id: "documents" as Tab, label: "Docs", icon: <LayoutPanelLeft className="w-4 h-4" /> },
            { id: "chat" as Tab, label: "Chat", icon: <MessageSquare className="w-4 h-4" /> },
          ]).map(({ id, label, icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === id ? "bg-gray-700 text-indigo-300" : "text-gray-500 hover:text-gray-300"
              }`}>
              {icon} {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className={`w-full sm:w-[380px] lg:w-[420px] bg-gray-900 border-r border-gray-800 flex flex-col overflow-y-auto ${activeTab === "chat" ? "hidden sm:flex" : "flex"}`}>
          <div className="p-5 space-y-5">
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cargar documentos</h2>
              <DocumentUpload onUploadSuccess={handleUploadSuccess} />
            </section>

            <hr className="border-gray-800" />

            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mis documentos</h2>
              <DocumentList refreshTrigger={refreshTrigger} selectable onSelectionChange={setSelectedDocumentIds} />
            </section>
          </div>

          {selectedDocumentIds.length > 0 && (
            <div className="sm:hidden p-4 border-t border-gray-800 mt-auto">
              <button onClick={() => setActiveTab("chat")}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                <MessageSquare className="w-4 h-4" />
                Ir al chat ({selectedDocumentIds.length} doc{selectedDocumentIds.length !== 1 ? "s" : ""})
              </button>
            </div>
          )}
        </aside>

        <main className={`flex-1 flex flex-col p-4 sm:p-6 overflow-hidden ${activeTab === "documents" ? "hidden sm:flex" : "flex"}`}>
          <ChatInterface selectedDocumentIds={selectedDocumentIds} />
        </main>
      </div>
    </div>
  );
}
