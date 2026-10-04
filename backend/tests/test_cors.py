"""CORS comes from CORS_ORIGINS and CORS_ORIGIN_REGEX (so phones and tunnels can reach the API)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.main import app, cors_settings


def _client(monkeypatch, origins=None, regex=None) -> TestClient:
    for name, value in (("CORS_ORIGINS", origins), ("CORS_ORIGIN_REGEX", regex)):
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    mini = FastAPI()
    mini.add_middleware(CORSMiddleware, **cors_settings(), allow_methods=["*"], allow_headers=["*"])

    @mini.get("/ping")
    def ping():
        return {"ok": True}

    return TestClient(mini)


def _allowed(client: TestClient, origin: str):
    return client.get("/ping", headers={"Origin": origin}).headers.get("access-control-allow-origin")


def test_default_origins(monkeypatch):
    c = _client(monkeypatch)
    assert _allowed(c, "http://localhost:5173") == "http://localhost:5173"
    assert _allowed(c, "http://127.0.0.1:5173") == "http://127.0.0.1:5173"
    assert _allowed(c, "https://evil.example") is None


def test_extra_origins_from_env(monkeypatch):
    c = _client(monkeypatch, origins="https://app.example.com, http://192.168.1.20:5173/")
    assert _allowed(c, "https://app.example.com") == "https://app.example.com"
    assert _allowed(c, "http://192.168.1.20:5173") == "http://192.168.1.20:5173"
    assert _allowed(c, "https://other.example.com") is None


def test_regex_for_tunnels(monkeypatch):
    c = _client(monkeypatch, regex=r"https://.*\.trycloudflare\.com")
    origin = "https://random-words-here.trycloudflare.com"
    assert _allowed(c, origin) == origin
    assert _allowed(c, "http://localhost:5173") == "http://localhost:5173"
    assert _allowed(c, "https://trycloudflare.com.evil.example") is None


def test_unlisted_origin_gets_no_header(monkeypatch):
    c = _client(monkeypatch, origins="https://app.example.com", regex=r"https://.*\.trycloudflare\.com")
    assert _allowed(c, "https://attacker.example") is None


def test_real_app_default_allows_localhost():
    res = TestClient(app).get("/health", headers={"Origin": "http://localhost:5173"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
