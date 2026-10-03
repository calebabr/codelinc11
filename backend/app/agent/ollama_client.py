"""Thin Ollama HTTP client. Never required: every failure becomes OllamaUnavailable."""
from __future__ import annotations

import os

import httpx
from dotenv import load_dotenv

load_dotenv()


class OllamaUnavailable(Exception):
    """Ollama is not running, timed out, or returned something unusable."""


class OllamaClient:
    def __init__(self, url: str | None = None, model: str | None = None,
                 timeout: float | None = None) -> None:
        self.url = (url or os.getenv("OLLAMA_URL", "http://localhost:11434")).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2:3b")
        try:
            self.timeout = float(timeout if timeout is not None else os.getenv("OLLAMA_TIMEOUT", "60"))
        except ValueError:
            self.timeout = 60.0

    def is_available(self) -> bool:
        try:
            r = httpx.get(f"{self.url}/api/tags", timeout=1.5)
            return r.status_code == 200
        except Exception:  # noqa: BLE001
            return False

    def chat(self, messages: list[dict], tools: list[dict] | None = None) -> dict:
        payload: dict = {"model": self.model, "messages": messages, "stream": False}
        if tools:
            payload["tools"] = tools
        try:
            r = httpx.post(f"{self.url}/api/chat", json=payload, timeout=self.timeout)
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            raise OllamaUnavailable(str(exc)) from exc
        if not isinstance(data, dict) or "message" not in data:
            raise OllamaUnavailable("Unexpected response from Ollama")
        return data
