"""Unit tests for scripts/lib/llm_client.py — stdlib Anthropic Messages client."""
from __future__ import annotations

import json

import pytest

from scripts.lib import llm_client


class FakeTransport:
    def __init__(self, reply_text: str = 'restored text'):
        self.requests: list[dict] = []
        self.reply_text = reply_text

    def __call__(self, url: str, headers: dict, body: bytes) -> dict:
        self.requests.append({'url': url, 'headers': headers, 'body': json.loads(body)})
        return {'content': [{'type': 'text', 'text': self.reply_text}]}


def test_complete_sends_prompt_and_returns_text():
    transport = FakeTransport('cleaned page')
    client = llm_client.AnthropicClient(api_key='sk-test', transport=transport)
    result = client.complete('fix this text')
    assert result == 'cleaned page'
    req = transport.requests[0]
    assert req['url'] == 'https://api.anthropic.com/v1/messages'
    assert req['headers']['x-api-key'] == 'sk-test'
    assert req['body']['model'] == llm_client.DEFAULT_MODEL
    assert req['body']['messages'][0]['content'] == 'fix this text'


def test_missing_api_key_raises_clear_error():
    with pytest.raises(RuntimeError, match='ANTHROPIC_API_KEY'):
        llm_client.AnthropicClient(api_key='')


def test_escalation_model_used_when_requested():
    transport = FakeTransport()
    client = llm_client.AnthropicClient(api_key='sk-test', transport=transport)
    client.complete('hard page', escalate=True)
    assert transport.requests[0]['body']['model'] == llm_client.ESCALATION_MODEL


class TestLoadApiKey:
    def test_environment_variable_wins(self, tmp_path, monkeypatch):
        (tmp_path / '.anthropic_api_key').write_text('sk-from-file\n', encoding='utf-8')
        monkeypatch.setenv('ANTHROPIC_API_KEY', 'sk-from-env')
        assert llm_client.load_api_key(tmp_path) == 'sk-from-env'

    def test_falls_back_to_key_file_saved_by_the_app(self, tmp_path, monkeypatch):
        monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
        (tmp_path / '.anthropic_api_key').write_text('  sk-from-file\n', encoding='utf-8')
        assert llm_client.load_api_key(tmp_path) == 'sk-from-file'

    def test_returns_empty_when_neither_exists(self, tmp_path, monkeypatch):
        monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
        assert llm_client.load_api_key(tmp_path) == ''
