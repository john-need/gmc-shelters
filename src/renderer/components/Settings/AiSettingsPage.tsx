import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AI_MODEL_OPTIONS } from '@shared/ipc-types';
import type { AiModelTier, McpConnectionInfo } from '@shared/ipc-types';
import { isValidAnthropicKey } from '@shared/anthropic-key';
import { apiKeyChanged } from '../../store/aiSettingsSlice';

export default function AiSettingsPage() {
    return (
        <>
            <div className="settings-page-head">
                <div>
                    <div
                        className="settings-page-title"
                        dangerouslySetInnerHTML={{ __html: 'AI Settings <em>· model &amp; api key</em>' }}
                    />
                    <div className="settings-page-sub">§ Settings / AI Settings</div>
                </div>
            </div>

            <div className="settings-body">
                <ApiKeyCard/>
                <ModelCard/>
                <McpSettingsCard/>
            </div>
        </>
    );
}

function ModelCard() {
    const [tier, setTier] = useState<AiModelTier>('default');

    useEffect(() => {
        window.api.ai.getModel().then(setTier);
    }, []);

    return (
        <div className="settings-card">
            <h3>Model <em>· which Claude model runs AI processing</em></h3>
            <div className="desc">
                Applies to OCR cleanup and photo captioning. Takes effect on the next run.
            </div>
            <div style={{display: 'flex', gap: 8, alignItems: 'center', marginTop: 12}}>
                <label htmlFor="ai-model" className="label" style={{minWidth: 130}}>
                    Model
                </label>
                <select
                    id="ai-model"
                    className="input"
                    style={{flex: 1}}
                    value={tier}
                    onChange={(e) => {
                        const next = e.target.value as AiModelTier;
                        setTier(next);
                        window.api.ai.setModel(next);
                    }}
                >
                    {AI_MODEL_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function ApiKeyCard() {
    const dispatch = useDispatch();
    const [saved, setSaved] = useState('');
    const [draft, setDraft] = useState('');
    const [reveal, setReveal] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        window.api.ai.getApiKey().then((key) => {
            setSaved(key);
            setDraft(key);
            dispatch(apiKeyChanged(key));
        });
    }, [dispatch]);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 1600);
    };

    const save = async () => {
        const key = draft.trim();
        if (key && !isValidAnthropicKey(key)) {
            setError('That does not look like an Anthropic key — it should start with sk-ant-.');
            return;
        }
        setError(null);
        await window.api.ai.setApiKey(key);
        setSaved(key);
        setDraft(key);
        dispatch(apiKeyChanged(key));
        flash(key ? 'API key saved' : 'API key removed');
    };

    const remove = async () => {
        setError(null);
        await window.api.ai.setApiKey('');
        setSaved('');
        setDraft('');
        dispatch(apiKeyChanged(''));
        flash('API key removed');
    };

    return (
        <div className="settings-card">
            <h3>Anthropic API key <em>· OCR cleanup &amp; photo captions</em></h3>
            <div className="desc">
                Used by the clean-up runs on the Collections page. Stored locally in{' '}
                <code style={{fontFamily: 'var(--font-mono)'}}>.anthropic_api_key</code> at the
                repository root — gitignored, owner-readable only, and never leaves this machine
                except in requests to the Anthropic API. An{' '}
                <code style={{fontFamily: 'var(--font-mono)'}}>ANTHROPIC_API_KEY</code> environment
                variable, when set, takes precedence.
            </div>

            <div style={{display: 'flex', gap: 8, alignItems: 'center', marginTop: 12}}>
                <label htmlFor="anthropic-api-key" className="label" style={{minWidth: 130}}>
                    Anthropic API key
                </label>
                <input
                    id="anthropic-api-key"
                    className="input"
                    style={{flex: 1, fontFamily: 'var(--font-mono)'}}
                    type={reveal ? 'text' : 'password'}
                    placeholder="sk-ant-…"
                    value={draft}
                    onChange={(e) => {
                        setError(null);
                        setDraft(e.target.value);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                />
                <button className="btn" type="button" onClick={() => setReveal((r) => !r)}>
                    {reveal ? 'Hide' : 'Show'}
                </button>
            </div>

            {error && (
                <div style={{marginTop: 8, fontSize: 12, color: 'var(--danger, #c0392b)'}}>{error}</div>
            )}

            <div style={{display: 'flex', gap: 8, marginTop: 14}}>
                <button
                    className="btn primary"
                    type="button"
                    onClick={save}
                    disabled={draft.trim() === saved}
                >
                    Save
                </button>
                {saved && (
                    <button className="btn" type="button" onClick={remove}>
                        Remove key
                    </button>
                )}
                {toast && (
                    <span style={{alignSelf: 'center', fontSize: 12, color: 'var(--ink-3)'}}>{toast}</span>
                )}
            </div>
        </div>
    );
}

function McpSettingsCard() {
    const [enabled, setEnabled] = useState(false);
    const [info, setInfo] = useState<McpConnectionInfo | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        window.api.mcp.getEnabled().then(setEnabled);
        window.api.mcp.getConnectionInfo().then(setInfo);
    }, []);

    const toggle = async (next: boolean) => {
        setEnabled(next);
        await window.api.mcp.setEnabled(next);
    };

    // Claude Desktop's mcpServers config only launches local stdio commands (no "url" field
    // in its schema) — mcp-remote is the standard community bridge: a stdio process Desktop
    // spawns via npx that connects out to a remote/HTTP MCP server on the process's behalf.
    const configSnippet = info ? JSON.stringify({
        mcpServers: {
            [info.serverName]: {
                command: 'npx',
                args: ['-y', 'mcp-remote', info.url],
            },
        },
    }, null, 2) : '';

    const copyConfig = () => {
        navigator.clipboard.writeText(configSnippet).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
    };

    return (
        <div className="settings-card">
            <h3>MCP server <em>· connect AI clients like Claude Desktop</em></h3>
            <div className="desc">
                Exposes read-only search and download over this app&apos;s wiki collections to any
                MCP-compatible client, over a local-only HTTP server (127.0.0.1) — never reachable
                from the network.
            </div>

            <div style={{display: 'flex', gap: 8, alignItems: 'center', marginTop: 12}}>
                <label className="toggle-switch" title="Enable MCP server">
                    <input
                        type="checkbox"
                        checked={enabled}
                        aria-label="Enable MCP server"
                        onChange={(e) => toggle(e.target.checked)}
                    />
                    <span className="toggle-track"/>
                </label>
                <span className="label">{enabled ? 'Enabled' : 'Disabled'}</span>
            </div>

            {enabled && info && (
                <>
                    <div style={{display: 'flex', gap: 8, alignItems: 'center', marginTop: 14}}>
                        <span className="label" style={{minWidth: 130}}>Server URL</span>
                        <code style={{fontFamily: 'var(--font-mono)'}}>{info.url}</code>
                    </div>

                    <div style={{marginTop: 14}}>
                        <div className="desc" style={{marginBottom: 6}}>
                            Add to Claude Desktop&apos;s config (Settings → Developer → Edit Config).
                            Desktop only launches local commands, so this runs the{' '}
                            <code style={{fontFamily: 'var(--font-mono)'}}>mcp-remote</code> bridge via npx
                            (requires Node.js) to reach the server above:
                        </div>
                        <pre
                            data-testid="mcp-config-snippet"
                            style={{
                                fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-2)',
                                padding: 12, borderRadius: 6, overflowX: 'auto',
                            }}
                        >{configSnippet}</pre>
                        <button className="btn" type="button" onClick={copyConfig} style={{marginTop: 6}}>
                            {copied ? 'Copied' : 'Copy config'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
