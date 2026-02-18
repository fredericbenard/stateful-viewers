"""Utilities for loading and encoding images."""

from __future__ import annotations

import base64
import mimetypes
from pathlib import Path

import httpx


def load_image_as_base64(source: str) -> tuple[str, str]:
    """Load an image from a URL or local path and return (base64_data, mime_type).

    Raises ValueError if the source cannot be loaded or the MIME type is
    unrecognized.
    """
    if source.startswith(("http://", "https://")):
        return _fetch_url(source)
    return _read_local(source)


def _fetch_url(url: str) -> tuple[str, str]:
    response = httpx.get(url, follow_redirects=True, timeout=30.0)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    mime_type = content_type.split(";")[0].strip() or _guess_mime(url)
    if not mime_type.startswith("image/"):
        raise ValueError(f"URL did not return an image (content-type: {content_type})")

    encoded = base64.b64encode(response.content).decode("ascii")
    return encoded, mime_type


def _read_local(path_str: str) -> tuple[str, str]:
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        raise ValueError(f"File not found: {path}")

    mime_type = _guess_mime(str(path))
    if not mime_type.startswith("image/"):
        raise ValueError(f"Not a recognized image file: {path} (type: {mime_type})")

    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return encoded, mime_type


def _guess_mime(path_or_url: str) -> str:
    mt, _ = mimetypes.guess_type(path_or_url)
    return mt or "image/jpeg"
