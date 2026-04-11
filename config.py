import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY")
NVIDIA_API_KEY   = os.getenv("NVIDIA_API_KEY")

# Modelo por defecto para cada proveedor
OPENAI_MODEL  = "gpt-4o"
GEMINI_MODEL  = "gemini-1.5-pro"
NVIDIA_MODEL  = "meta/llama-3.1-70b-instruct"   # disponible en NVIDIA NIM

# Proveedor activo (openai | gemini | nvidia)
DEFAULT_PROVIDER = "openai"

# ChromaDB path
CHROMA_PATH = "./memory/chroma_db"
