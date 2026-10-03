"""Model providers behind one interface (decision D3: Anthropic first, Ollama as the local option).

The chat loop speaks a small neutral conversation format and each provider converts it:

  {"role": "user", "content": str, "documents": [{"media_type": str, "data": base64 str}]?}
  {"role": "assistant", "content": str, "tool_calls": [{"id", "name", "args"}]?}
  {"role": "tool", "results": [{"id", "name", "content": str}]}

`complete()` returns a `Reply` (text and/or tool calls). Any failure raises `ProviderError`, which
the loop turns into a plain "assistant unavailable" message. There is no scripted fallback.
The API key is read from the environment (backend/.env) and never logged or returned.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx
from dotenv import load_dotenv

from .ollama_client import OllamaClient

load_dotenv()

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5"


class ProviderError(Exception):
    """The model could not be reached or returned something unusable."""


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict


@dataclass
class Reply:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)


class Provider(Protocol):
    name: str
    supports_documents: bool

    def is_available(self) -> bool: ...

    def complete(self, system: str, turns: list[dict], tools: list[dict]) -> Reply: ...


def _function_schemas(tools: list[dict]) -> list[dict]:
    """TOOL_SCHEMAS use the function-calling shape; return the inner function dicts."""
    return [t["function"] for t in tools]


# ------------------------------------------------------------------ Anthropic

class AnthropicProvider:
    name = "anthropic"
    supports_documents = True

    def __init__(self, api_key: str | None = None, model: str | None = None,
                 timeout: float = 60.0, url: str = ANTHROPIC_URL) -> None:
        self._key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.model = model or os.environ.get("ANTHROPIC_MODEL") or DEFAULT_ANTHROPIC_MODEL
        self.timeout = timeout
        self.url = url

    def is_available(self) -> bool:
        return bool(self._key)

    @staticmethod
    def _convert(turns: list[dict]) -> list[dict]:
        out: list[dict] = []

        def push(role: str, blocks: list[dict]) -> None:
            if out and out[-1]["role"] == role:  # the API wants alternating roles
                out[-1]["content"].extend(blocks)
            else:
                out.append({"role": role, "content": blocks})

        for t in turns:
            role = t["role"]
            if role == "user":
                blocks: list[dict] = [
                    {"type": "document",
                     "source": {"type": "base64", "media_type": d["media_type"], "data": d["data"]}}
                    for d in t.get("documents", [])]
                blocks.append({"type": "text", "text": t["content"] or "(no text)"})
                push("user", blocks)
            elif role == "assistant":
                blocks = []
                if t.get("content"):
                    blocks.append({"type": "text", "text": t["content"]})
                for c in t.get("tool_calls", []):
                    blocks.append({"type": "tool_use", "id": c["id"], "name": c["name"],
                                   "input": c["args"]})
                if blocks:
                    push("assistant", blocks)
            elif role == "tool":
                push("user", [{"type": "tool_result", "tool_use_id": r["id"], "content": r["content"]}
                              for r in t["results"]])
        return out

    def complete(self, system: str, turns: list[dict], tools: list[dict]) -> Reply:
        if not self._key:
            raise ProviderError("no API key")
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": system,
            "messages": self._convert(turns),
            "tools": [{"name": f["name"], "description": f["description"],
                       "input_schema": f["parameters"]} for f in _function_schemas(tools)],
        }
        headers = {"x-api-key": self._key, "anthropic-version": ANTHROPIC_VERSION,
                   "content-type": "application/json"}
        try:
            r = httpx.post(self.url, json=payload, headers=headers, timeout=self.timeout)
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            raise ProviderError(f"Anthropic request failed: {type(exc).__name__}") from exc
        if not isinstance(data, dict) or not isinstance(data.get("content"), list):
            raise ProviderError("unexpected response from Anthropic")
        reply = Reply()
        for block in data["content"]:
            if block.get("type") == "text":
                reply.text += block.get("text", "")
            elif block.get("type") == "tool_use":
                args = block.get("input")
                reply.tool_calls.append(ToolCall(block.get("id", ""), block.get("name", ""),
                                                 args if isinstance(args, dict) else {}))
        reply.text = reply.text.strip()
        return reply


# ------------------------------------------------------------------ Ollama

class OllamaProvider:
    name = "ollama"
    supports_documents = False

    def __init__(self, client: Any = None) -> None:
        self.client = client if client is not None else OllamaClient()

    def is_available(self) -> bool:
        return bool(self.client.is_available())

    @staticmethod
    def _convert(system: str, turns: list[dict]) -> list[dict]:
        msgs: list[dict] = [{"role": "system", "content": system}]
        for t in turns:
            if t["role"] == "user":
                msgs.append({"role": "user", "content": t["content"]})
            elif t["role"] == "assistant":
                m: dict = {"role": "assistant", "content": t.get("content", "")}
                if t.get("tool_calls"):
                    m["tool_calls"] = [{"function": {"name": c["name"], "arguments": c["args"]}}
                                       for c in t["tool_calls"]]
                msgs.append(m)
            elif t["role"] == "tool":
                for r in t["results"]:
                    msgs.append({"role": "tool", "name": r["name"], "content": r["content"]})
        return msgs

    def complete(self, system: str, turns: list[dict], tools: list[dict]) -> Reply:
        try:
            resp = self.client.chat(self._convert(system, turns), tools)
        except Exception as exc:
            raise ProviderError(f"Ollama request failed: {type(exc).__name__}") from exc
        msg = resp.get("message") or {}
        reply = Reply(text=(msg.get("content") or "").strip())
        for n, call in enumerate(msg.get("tool_calls") or []):
            fn = call.get("function", {})
            args = fn.get("arguments")
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except ValueError:
                    args = {}
            reply.tool_calls.append(ToolCall(f"call_{n}", fn.get("name", ""),
                                             args if isinstance(args, dict) else {}))
        return reply


# ------------------------------------------------------------------ selection

def select_provider(env: dict | None = None) -> Provider | None:
    """Pick the provider. ASSISTANT_PROVIDER = auto (default) | anthropic | ollama | none.

    auto: an ANTHROPIC_API_KEY selects Anthropic; otherwise Ollama if it answers; otherwise None
    (the chat then says the assistant is unavailable).
    """
    env = os.environ if env is None else env
    choice = (env.get("ASSISTANT_PROVIDER") or "auto").strip().lower()
    if choice == "none":
        return None
    if choice in ("auto", "anthropic") and env.get("ANTHROPIC_API_KEY"):
        return AnthropicProvider(api_key=env["ANTHROPIC_API_KEY"], model=env.get("ANTHROPIC_MODEL"))
    if choice in ("auto", "ollama"):
        p = OllamaProvider()
        return p if p.is_available() else None
    return None
