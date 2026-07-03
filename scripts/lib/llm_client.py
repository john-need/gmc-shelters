"""Minimal Anthropic Messages API client — stdlib only, no SDK dependency.

Used by the wiki conversion pipeline for OCR cleanup and illustration
captioning. The transport is injectable so tests never touch the network.
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path
from typing import Callable

# Written by the app's "AI Integration" settings page; gitignored, chmod 600
KEY_FILENAME = '.anthropic_api_key'

API_URL = 'https://api.anthropic.com/v1/messages'
API_VERSION = '2023-06-01'
DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
ESCALATION_MODEL = 'claude-sonnet-4-6'
MAX_TOKENS = 8192

Transport = Callable[[str, dict, bytes], dict]


def load_api_key(repo_root: Path) -> str:
    """ANTHROPIC_API_KEY env var, else the key file saved by the app's
    AI Integration settings page, else ''."""
    env = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if env:
        return env
    key_file = repo_root / KEY_FILENAME
    try:
        return key_file.read_text(encoding='utf-8').strip()
    except OSError:
        return ''


def _http_transport(url: str, headers: dict, body: bytes) -> dict:
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode('utf-8'))


class AnthropicClient:
    def __init__(self, api_key: str, transport: Transport = _http_transport):
        if not api_key:
            raise RuntimeError(
                'ANTHROPIC_API_KEY is not set — required for the OCR cleanup pass.'
            )
        self.api_key = api_key
        self.transport = transport

    def _call(self, content, *, escalate: bool) -> str:
        body = json.dumps({
            'model': ESCALATION_MODEL if escalate else DEFAULT_MODEL,
            'max_tokens': MAX_TOKENS,
            'messages': [{'role': 'user', 'content': content}],
        }).encode('utf-8')
        headers = {
            'x-api-key': self.api_key,
            'anthropic-version': API_VERSION,
            'content-type': 'application/json',
        }
        resp = self.transport(API_URL, headers, body)
        return ''.join(
            block['text'] for block in resp.get('content', [])
            if block.get('type') == 'text'
        )

    def complete(self, prompt: str, *, escalate: bool = False) -> str:
        return self._call(prompt, escalate=escalate)

    def caption_image(self, png_base64: str, prompt: str, *, escalate: bool = False) -> str:
        content = [
            {'type': 'image', 'source': {
                'type': 'base64', 'media_type': 'image/png', 'data': png_base64}},
            {'type': 'text', 'text': prompt},
        ]
        return self._call(content, escalate=escalate)
