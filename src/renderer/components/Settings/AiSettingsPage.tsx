import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AI_MODEL_OPTIONS } from '@shared/ipc-types';
import type { AiModelTier } from '@shared/ipc-types';
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
