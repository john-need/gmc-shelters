"""Unit tests for scripts/clean_quote.py — the quote clean-up CLI."""
from __future__ import annotations

from pathlib import Path

from scripts import clean_quote


class FakeClient:
    """Stands in for AnthropicClient so tests never touch the network."""
    def __init__(self, api_key: str, primary_model: str):
        self.api_key = api_key
        self.primary_model = primary_model

    def complete(self, prompt: str) -> str:
        return 'CLEANED: ' + prompt


class TestCleanQuoteCli:
    def test_prints_cleaned_text_and_exits_0(self, tmp_path: Path, monkeypatch, capsys):
        (tmp_path / '.anthropic_api_key').write_text('sk-ant-test\n', encoding='utf-8')
        monkeypatch.setattr(clean_quote, 'REPO', tmp_path)
        monkeypatch.setattr(clean_quote, 'AnthropicClient', FakeClient)

        code = clean_quote.main(['a messy quote'])

        assert code == 0
        out = capsys.readouterr()
        assert out.out.strip().startswith('CLEANED: ')
        assert 'a messy quote' in out.out
        assert out.err == ''
        # never writes any file
        assert list(tmp_path.iterdir()) == [tmp_path / '.anthropic_api_key']

    def test_missing_key_prints_error_and_exits_nonzero(self, tmp_path: Path, monkeypatch, capsys):
        monkeypatch.setattr(clean_quote, 'REPO', tmp_path)

        code = clean_quote.main(['a messy quote'])

        assert code != 0
        out = capsys.readouterr()
        assert out.out == ''
        assert out.err.strip() != ''
        assert list(tmp_path.iterdir()) == []
