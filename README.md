# 🧠 DocuMind — AI Document Intelligence

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](/)
[![ChromaDB](https://img.shields.io/badge/VectorDB-ChromaDB-orange)](/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](/)

> Plataforma de inteligencia documental con IA. Sube documentos PDF, hazles preguntas en lenguaje natural y obtén respuestas contextualizadas con RAG (Retrieval-Augmented Generation).

## Características

| Componente | Tecnología |
|-----------|-----------|
| Backend API | FastAPI + Python 3.11 |
| RAG Engine | ChromaDB + OpenAI Embeddings |
| Procesamiento PDF | PyMuPDF (fitz) |
| Frontend | Next.js 14 |
| Proxy | Nginx |
| Contenedores | Docker Compose |

- **RAG completo**: chunking, embeddings vectoriales, recuperación semántica Top-K
- **Seguridad**: detección de prompt injection, validación de inputs
- **API REST**: upload de documentos, Q&A, gestión de colecciones
- **Multi-documento**: analiza múltiples PDFs en paralelo

## Instalación rápida



La API estará disponible en  y el frontend en .

## Uso de la API



## Arquitectura



## Autor

**MuRDoK** — [github.com/murdok1982](https://github.com/murdok1982)

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🤖 Recomendación

Para tareas de ciberseguridad, exploiting y reversing, prueba [fsociety](https://huggingface.co/murdok1982/fsociety) — un modelo fine-tuned sobre Qwen2.5-Coder-1.5B-Instruct con 169K ejemplos de seguridad. Corre 100% local con Ollama:

```bash
ollama pull murdok1982/fsociety
ollama run fsociety
```

---

## 💰 Apoya Este Proyecto

<div align="center">

### ¡Donaciones en Bitcoin Bienvenidas!

[![Bitcoin](https://img.shields.io/badge/Bitcoin-000000?style=for-the-badge&logo=bitcoin&logoColor=white)](https://bitcoin.org)

```
┌──────────────────────────────────────────────────┐
│             ₿ BTC Donation Address ₿              │
├──────────────────────────────────────────────────┤
│                                                  │
│  bc1qqphwht25vjzlptwzjyjt3sex7e3p8twn390fkw     │
│                                                  │
│  Network: Bitcoin (BTC)                          │
│                                                  │
│  Escanea el QR desde tu wallet:                  │
└──────────────────────────────────────────────────┘
```

![Bitcoin QR](https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=bitcoin:bc1qqphwht25vjzlptwzjyjt3sex7e3p8twn390fkw)

**Direccion:** `bc1qqphwht25vjzlptwzjyjt3sex7e3p8twn390fkw`

*Apoya el desarrollo de herramientas de ciberseguridad open-source!* 🙏

</div>
