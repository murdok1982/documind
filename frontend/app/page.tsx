import Link from "next/link";
import { Bot, Upload, Search, Zap, ArrowRight } from "lucide-react";

const FEATURES = [
  { icon: <Upload className="w-6 h-6 text-indigo-400" />, title: "Carga documentos", description: "PDF y TXT. Procesados y fragmentados automáticamente en segundos." },
  { icon: <Search className="w-6 h-6 text-indigo-400" />, title: "Búsqueda semántica", description: "Búsqueda vectorial que entiende el contexto real de tu pregunta." },
  { icon: <Bot className="w-6 h-6 text-indigo-400" />, title: "Chat con IA", description: "Preguntas en lenguaje natural, respuestas precisas con fuentes citadas." },
  { icon: <Zap className="w-6 h-6 text-indigo-400" />, title: "Respuestas rápidas", description: "GPT-4o + ChromaDB = resultados relevantes en menos de 3 segundos." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-7 h-7 text-indigo-400" />
          <span className="font-bold text-lg">Docu<span className="text-indigo-400">Mind</span></span>
        </div>
        <Link href="/app" className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150">
          Abrir la app <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <span className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800/50 text-indigo-300 text-sm px-4 py-1.5 rounded-full mb-8">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
          RAG Demo en producción
        </span>
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight mb-6 bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
          AI Document Intelligence que realmente funciona
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          Sube tus archivos, haz preguntas en lenguaje natural y obtén respuestas precisas
          con fuentes citadas, extraídas directamente de tus documentos.
        </p>
        <Link href="/app" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-150 hover:shadow-xl">
          Empezar ahora <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.map(({ icon, title, description }) => (
          <div key={title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3 hover:border-gray-700 transition-colors">
            <div className="w-11 h-11 rounded-xl bg-indigo-950 flex items-center justify-center">{icon}</div>
            <h3 className="font-semibold text-gray-100">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
          </div>
        ))}
      </section>

      <footer className="text-center pb-8 text-xs text-gray-600">
        DocuMind — Next.js · FastAPI · LangChain · ChromaDB · GPT-4o
      </footer>
    </div>
  );
}
