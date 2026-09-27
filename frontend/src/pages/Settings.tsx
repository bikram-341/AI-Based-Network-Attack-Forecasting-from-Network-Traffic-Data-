import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Card, CardHeader } from '../components/common/Card';
import { Settings as SettingsIcon, Shield, Zap, Globe, Save, RotateCcw, Check, AlertCircle } from 'lucide-react';
import { useSettings, DEFAULT_SETTINGS } from '../hooks/useSettings';

export default function Settings() {
  const { settings, saveSettings, resetSettings, isSaving } = useSettings();

  // Local form state
  const [primaryModel, setPrimaryModel]           = useState(settings.primaryModel);
  const [rolloutHorizon, setRolloutHorizon]       = useState(settings.rolloutHorizon);
  const [discountFactor, setDiscountFactor]       = useState(settings.discountFactor);
  const [criticalThreshold, setCriticalThreshold] = useState(settings.criticalThreshold);
  const [highThreshold, setHighThreshold]         = useState(settings.highThreshold);
  const [predictiveAlerting, setPredictiveAlerting] = useState(settings.predictiveAlerting);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync local form state if settings change (e.g. from backend fetch)
  useEffect(() => {
    setPrimaryModel(settings.primaryModel);
    setRolloutHorizon(settings.rolloutHorizon);
    setDiscountFactor(settings.discountFactor);
    setCriticalThreshold(settings.criticalThreshold);
    setHighThreshold(settings.highThreshold);
    setPredictiveAlerting(settings.predictiveAlerting);
  }, [settings]);

  async function handleSave() {
    setErrorMsg('');
    if (criticalThreshold <= highThreshold) {
      setErrorMsg('Critical Alert Risk Threshold must be greater than High Alert Risk Threshold.');
      return;
    }
    if (criticalThreshold < 1 || criticalThreshold > 100 || highThreshold < 1 || highThreshold > 100) {
      setErrorMsg('Threshold values must be between 1 and 100.');
      return;
    }

    const success = await saveSettings({
      primaryModel,
      rolloutHorizon,
      discountFactor,
      criticalThreshold,
      highThreshold,
      predictiveAlerting,
    });

    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  }

  function handleReset() {
    setPrimaryModel(DEFAULT_SETTINGS.primaryModel);
    setRolloutHorizon(DEFAULT_SETTINGS.rolloutHorizon);
    setDiscountFactor(DEFAULT_SETTINGS.discountFactor);
    setCriticalThreshold(DEFAULT_SETTINGS.criticalThreshold);
    setHighThreshold(DEFAULT_SETTINGS.highThreshold);
    setPredictiveAlerting(DEFAULT_SETTINGS.predictiveAlerting);
    resetSettings();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">System Settings</h2>
          <p className="text-sm text-text-muted mt-1">Configure OmniSentinel UI thresholds and AI Engine parameters.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary text-xs h-9 px-3 gap-1.5"
            title="Reset to recommended defaults"
          >
            <RotateCcw size={13} /> Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`btn text-xs h-9 px-4 gap-2 transition-all ${
              savedSuccess
                ? 'bg-safe text-white hover:bg-safe'
                : 'btn-primary'
            }`}
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Saving…
              </span>
            ) : savedSuccess ? (
              <span className="flex items-center gap-1.5 font-medium">
                <Check size={14} /> Saved!
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Save size={14} /> Save Changes
              </span>
            )}
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="mb-6 p-3 bg-safe-bg border border-safe-dim rounded-lg flex items-center gap-2 text-xs text-safe animate-fade-in">
          <Check size={15} />
          <span>Settings saved successfully! Risk thresholds and AI configurations have been updated.</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-3 bg-critical-bg border border-critical-dim rounded-lg flex items-center gap-2 text-xs text-critical animate-fade-in">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI FORECAST CONFIGURATION */}
        <Card>
          <CardHeader title="AI Forecast Configuration" icon={<Zap size={14} />} />
          <div className="p-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Primary World Model</label>
              <select
                className="select w-full"
                value={primaryModel}
                onChange={e => setPrimaryModel(e.target.value)}
              >
                <option value="gru">GRU World Model (Phase 8) - Recommended</option>
                <option value="lstm">LSTM World Model (Phase 9)</option>
                <option value="xgb" disabled>XGBoost (Static Baseline)</option>
              </select>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-text-secondary">Autoregressive Rollout Horizon (K-steps)</label>
                <span className="text-xs font-mono font-bold text-forecast px-2 py-0.5 rounded bg-forecast-dim border border-forecast-dim">
                  K = {rolloutHorizon} windows
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={rolloutHorizon}
                onChange={e => setRolloutHorizon(parseInt(e.target.value, 10))}
                className="w-full accent-forecast cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-1">
                <span>1 window</span>
                <span className={rolloutHorizon === 8 ? 'text-forecast font-bold' : ''}>8 windows (Default)</span>
                <span>10 windows</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Risk Score Discount Factor (γ)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={discountFactor}
                onChange={e => setDiscountFactor(parseFloat(e.target.value) || 0)}
                className="input font-mono w-full"
              />
              <p className="text-[10px] text-text-muted mt-1">Determines how much future predicted risk influences current risk score (Default: 0.85).</p>
            </div>
          </div>
        </Card>

        {/* ALERTING & THRESHOLDS */}
        <Card>
          <CardHeader title="Alerting & Risk Thresholds" icon={<Shield size={14} />} />
          <div className="p-5 space-y-5">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-text-secondary">Critical Alert Risk Threshold</label>
                <span className="text-xs font-mono font-bold text-critical px-2 py-0.5 rounded bg-critical-bg border border-critical-dim">
                  &ge; {criticalThreshold} pts
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="100"
                value={criticalThreshold}
                onChange={e => setCriticalThreshold(parseInt(e.target.value, 10) || 0)}
                className="input font-mono w-full border-critical-dim focus:border-critical"
              />
              <p className="text-[10px] text-text-muted mt-1">Scores at or above this threshold trigger Critical alerts and emergency escalation (Default: 80).</p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-text-secondary">High Alert Risk Threshold</label>
                <span className="text-xs font-mono font-bold text-warning px-2 py-0.5 rounded bg-warning-bg border border-warning-dim">
                  &ge; {highThreshold} pts
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="100"
                value={highThreshold}
                onChange={e => setHighThreshold(parseInt(e.target.value, 10) || 0)}
                className="input font-mono w-full border-warning-dim focus:border-warning"
              />
              <p className="text-[10px] text-text-muted mt-1">Scores between this and Critical trigger High severity alerts (Default: 65).</p>
            </div>

            {/* Threshold Bands Preview */}
            <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle space-y-2">
              <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Active Threshold Bands</div>
              <div className="flex h-3 w-full rounded overflow-hidden">
                <div style={{ width: `${highThreshold}%` }} className="bg-safe/60" title={`Safe/Low/Medium: 0 - ${highThreshold - 1}`} />
                <div style={{ width: `${criticalThreshold - highThreshold}%` }} className="bg-warning/80" title={`High: ${highThreshold} - ${criticalThreshold - 1}`} />
                <div style={{ width: `${100 - criticalThreshold}%` }} className="bg-critical" title={`Critical: ${criticalThreshold} - 100`} />
              </div>
              <div className="flex justify-between text-[10px] text-text-muted">
                <span className="text-safe">&lt; {highThreshold} (Safe/Low/Med)</span>
                <span className="text-warning">{highThreshold} - {criticalThreshold - 1} (High)</span>
                <span className="text-critical">&ge; {criticalThreshold} (Critical)</span>
              </div>
            </div>
            
            <div className="pt-2 border-t border-border-subtle">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={predictiveAlerting}
                  onChange={e => setPredictiveAlerting(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-3 border-border-default accent-warning"
                />
                <div>
                  <div className="text-sm font-medium text-text-primary">Predictive Alerting</div>
                  <div className="text-[10px] text-text-muted">Generate alerts based on AI forecast probability before attack occurs.</div>
                </div>
              </label>
            </div>
          </div>
        </Card>

        {/* API CONNECTION */}
        <Card>
          <CardHeader title="API Connection" icon={<Globe size={14} />} />
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Inference Server URL</label>
              <input
                type="text"
                value={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
                className="input font-mono w-full opacity-80 cursor-not-allowed"
                readOnly
              />
              <p className="text-[10px] text-text-muted mt-1">Configured via VITE_API_BASE_URL environment variable.</p>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-surface-3 rounded border border-border-subtle">
              <div className="text-xs text-text-primary">Connection Status</div>
              <div className="flex items-center gap-1.5 text-[11px] text-safe font-medium">
                <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
                Connected
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
