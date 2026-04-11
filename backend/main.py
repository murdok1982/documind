"""
DocuMind — AI Document Intelligence
FastAPI application entry point.
"""

import os
import re
import uuid
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv

from rag_engine import RAGEngine

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/tmp/documind_uploads"))
UPLOAD_DIR.mkdir(parents=True, mode=0o700, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".txt"}
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))

# FIX alta #5: CORS configurable por entorno, métodos explícitos
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
ENV = os.getenv("ENV", "development")

# Patrones de prompt injection para validación de preguntas (FIX media #9)
_INJECTION_PATTERNS = re.compile(
    r"ignore\s+(previous|all|above)\s+instructions?|"
    r"you\s+are\s+now\s+a|forget\s+everything|"
    r"system\s*prompt|jailbreak|do\s+anything\s+now",
    re.IGNORECASE,
)

rag: RAGEngine


# FIX alta #5: security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        if ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY environment variable is not set.")
    rag = RAGEngine(persist_dir=os.getenv("CHROMA_DIR", "./chroma_db"))
    logger.info("RAGEngine initialised.")
    yield
    logger.info("Shutting down DocuMind.")


app = FastAPI(
    title="DocuMind — AI Document Intelligence",
    description="Upload documents, ask questions, get cited answers.",
    version="1.0.0",
    lifespan=lifespan,
    # Deshabilitar docs en producción
    docs_url=None if ENV == "production" else "/docs",
    redoc_url=None if ENV == "production" else "/redoc",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],   # FIX alta #5: solo métodos necesarios
    allow_headers=["Content-Type", "Authorization"],
)


# ── Modelos ──────────────────────────────────────────────────────────────────

class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    chunks: int


class UploadResponse(BaseModel):
    message: str
    document: DocumentInfo


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    doc_ids: list[str] = Field(default_factory=list)

    # FIX media #9: validar formato de doc_ids y contenido de la pregunta
    @field_validator("doc_ids", mode="before")
    @classmethod
    def validate_doc_ids(cls, v: list) -> list[str]:
        for doc_id in v:
            try:
                UUID(str(doc_id))
            except (ValueError, AttributeError):
                raise ValueError(f"Invalid document ID format: {doc_id}")
        return v

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        if _INJECTION_PATTERNS.search(v):
            raise ValueError("Question contains potentially unsafe content.")
        return v.strip()


class SourceReference(BaseModel):
    doc_id: str
    filename: str
    page: int
    relevance_score: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceReference]


class DeleteResponse(BaseModel):
    message: str
    doc_id: str


class HealthResponse(BaseModel):
    status: str
    version: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    return {"status": "ok", "version": app.version}


@app.post(
    "/documents/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Documents"],
)
async def upload_document(file: Annotated[UploadFile, File(description="PDF or TXT file")]):
    # FIX alta #6: validar extensión y que no haya múltiples sufijos sospechosos
    filename_path = Path(file.filename)
    suffix = filename_path.suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{suffix}'. Allowed: {list(ALLOWED_EXTENSIONS)}",
        )

    if len(filename_path.suffixes) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Files with multiple extensions are not allowed.",
        )

    doc_id = str(uuid.uuid4())
    dest_path = UPLOAD_DIR / f"{doc_id}{suffix}"

    # FIX crítico #2: verificar que el path destino no escapa del UPLOAD_DIR
    try:
        dest_path.resolve().relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        logger.critical("Path traversal attempt blocked for doc_id=%s", doc_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path.")

    error_ref = str(uuid.uuid4())[:8]

    try:
        content = await file.read()

        if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds {MAX_FILE_SIZE_MB} MB limit.",
            )

        with dest_path.open("wb") as buf:
            buf.write(content)

        result = await rag.process_document(
            file_path=str(dest_path),
            doc_id=doc_id,
            filename=file.filename,
        )
    except HTTPException:
        dest_path.unlink(missing_ok=True)
        raise
    except ValueError as exc:
        dest_path.unlink(missing_ok=True)
        # FIX alta #4: log interno sin exponer detalles al cliente
        logger.warning("Invalid document [ref=%s]: %s", error_ref, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Document could not be processed. Ref: {error_ref}",
        )
    except Exception:
        dest_path.unlink(missing_ok=True)
        logger.exception("Upload failed [ref=%s]", error_ref)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed. Ref: {error_ref}",
        )

    return {"message": "Document uploaded and processed successfully.", "document": result}


@app.get("/documents", response_model=list[DocumentInfo], tags=["Documents"])
async def list_documents():
    return rag.list_documents()


@app.delete("/documents/{doc_id}", response_model=DeleteResponse, tags=["Documents"])
async def delete_document(doc_id: str):
    # FIX crítico #2: validar que doc_id es un UUID antes de cualquier operación
    try:
        UUID(doc_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID format.",
        )

    deleted = rag.delete_document(doc_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",  # FIX alta #4: no exponer el doc_id en el error
        )

    for suffix in ALLOWED_EXTENSIONS:
        candidate = UPLOAD_DIR / f"{doc_id}{suffix}"
        # Verificar path antes de eliminar
        try:
            candidate.resolve().relative_to(UPLOAD_DIR.resolve())
            candidate.unlink(missing_ok=True)
        except ValueError:
            logger.critical("Path traversal blocked during delete: %s", candidate)

    return {"message": "Document deleted successfully.", "doc_id": doc_id}


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: ChatRequest):
    error_ref = str(uuid.uuid4())[:8]
    try:
        result = await rag.query(question=request.question, doc_ids=request.doc_ids)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception:
        logger.exception("Chat query failed [ref=%s]", error_ref)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query processing failed. Ref: {error_ref}",
        )
    return result
