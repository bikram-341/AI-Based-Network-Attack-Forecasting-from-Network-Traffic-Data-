import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export interface SystemSettings {
  primaryModel: string;
  rolloutHorizon: number;
  discountFactor: number;
  criticalThreshold: number;
  highThreshold: number;
  predictiveAlerting: boolean;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  primaryModel: 'gru',
  rolloutHorizon: 8,
  discountFactor: 0.85,
  criticalThreshold: 80,
  highThreshold: 65,
  predictiveAlerting: true,
};

interface SettingsContextValue {
  settings: SystemSettings;
  updateSettings: (partial: Partial<SystemSettings>) => void;
  saveSettings: (newSettings?: SystemSettings) => Promise<boolean>;
  resetSettings: () => void;
  isSaving: boolean;
  getRiskLevel: (score: number) => 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  getRiskColorClass: (score: number) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const stored = localStorage.getItem('omnisentinel_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse stored settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Sync settings from backend on mount or when token is present
  useEffect(() => {
    let isMounted = true;
    async function fetchBackendSettings() {
      try {
        const token = localStorage.getItem('omnisentinel_token');
        if (!token) return;
        const res = await client.get('/api/settings');
        if (res.data && isMounted) {
          const s = res.data;
          const merged: SystemSettings = {
            primaryModel: s.primary_model ?? DEFAULT_SETTINGS.primaryModel,
            rolloutHorizon: s.rollout_horizon ?? DEFAULT_SETTINGS.rolloutHorizon,
            discountFactor: s.discount_factor ?? DEFAULT_SETTINGS.discountFactor,
            criticalThreshold: s.critical_threshold ?? DEFAULT_SETTINGS.criticalThreshold,
            highThreshold: s.high_threshold ?? DEFAULT_SETTINGS.highThreshold,
            predictiveAlerting: s.predictive_alerting ?? DEFAULT_SETTINGS.predictiveAlerting,
          };
          setSettings(merged);
          localStorage.setItem('omnisentinel_settings', JSON.stringify(merged));
        }
      } catch (err) {
        // Fallback to local settings
      }
    }
    fetchBackendSettings();
    return () => { isMounted = false; };
  }, []);

  const updateSettings = useCallback((partial: Partial<SystemSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...partial };
      localStorage.setItem('omnisentinel_settings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const saveSettings = useCallback(async (newSettings?: SystemSettings): Promise<boolean> => {
    const toSave = newSettings || settings;
    setIsSaving(true);
    try {
      localStorage.setItem('omnisentinel_settings', JSON.stringify(toSave));
      setSettings(toSave);

      const token = localStorage.getItem('omnisentinel_token');
      if (token) {
        await client.post('/api/settings', {
          primary_model: toSave.primaryModel,
          rollout_horizon: toSave.rolloutHorizon,
          discount_factor: toSave.discountFactor,
          critical_threshold: toSave.criticalThreshold,
          high_threshold: toSave.highThreshold,
          predictive_alerting: toSave.predictiveAlerting,
        });
      }
      return true;
    } catch (err) {
      console.error('Failed to sync settings with backend:', err);
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('omnisentinel_settings', JSON.stringify(DEFAULT_SETTINGS));
  }, []);

  const getRiskLevel = useCallback((score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE' => {
    if (score >= settings.criticalThreshold) return 'CRITICAL';
    if (score >= settings.highThreshold) return 'HIGH';
    if (score >= 45) return 'MEDIUM';
    if (score >= 25) return 'LOW';
    return 'SAFE';
  }, [settings.criticalThreshold, settings.highThreshold]);

  const getRiskColorClass = useCallback((score: number): string => {
    if (score >= settings.criticalThreshold) return 'text-critical';
    if (score >= settings.highThreshold) return 'text-warning';
    if (score >= 45) return 'text-elevated';
    if (score >= 25) return 'text-info';
    return 'text-safe';
  }, [settings.criticalThreshold, settings.highThreshold]);

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      saveSettings,
      resetSettings,
      isSaving,
      getRiskLevel,
      getRiskColorClass,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
