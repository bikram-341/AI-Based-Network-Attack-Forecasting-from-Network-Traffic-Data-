import React from 'react';
import { cn } from '../../utils/cn';
import { riskLevelFromScore } from '../../utils/formatters';

type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Safe' | 'Info' | 'Forecast' | 'Muted';

interface BadgeProps {
  severity?: Severity;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantMap: Record<Severity, string> = {
  Critical: 'badge-critical',
  High:     'badge-warning',
  Medium:   'badge-elevated',
  Low:      'badge-info',
  Safe:     'badge-safe',
  Info:     'badge-info',
  Forecast: 'badge-forecast',
  Muted:    'badge-muted',
};

const dotColor: Record<Severity, string> = {
  Critical: 'bg-critical',
  High:     'bg-warning',
  Medium:   'bg-elevated',
  Low:      'bg-info',
  Safe:     'bg-safe',
  Info:     'bg-info',
  Forecast: 'bg-forecast',
  Muted:    'bg-text-muted',
};

export function Badge({ severity = 'Muted', children, className, dot = false }: BadgeProps) {
  return (
    <span className={cn(variantMap[severity], className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor[severity])} />}
      {children}
    </span>
  );
}

export function RiskBadge({ score }: { score: number }) {
  const level = riskLevelFromScore(score);
  const severity: Severity =
    level === 'CRITICAL' ? 'Critical' :
    level === 'HIGH' ? 'High' :
    level === 'MEDIUM' ? 'Medium' :
    level === 'LOW' ? 'Low' : 'Safe';
  return <Badge severity={severity} dot>{level} · {score}%</Badge>;
}

export function StageBadge({ stage }: { stage: string }) {
  const isObserved = stage === 'observed';
  const isForecast = stage === 'forecast';
  return (
    <Badge severity={isForecast ? 'Forecast' : isObserved ? 'Safe' : 'Muted'}>
      {isForecast ? '◆ FORECAST' : isObserved ? '✓ OBSERVED' : stage}
    </Badge>
  );
}
