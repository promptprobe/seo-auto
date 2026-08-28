export interface SearchMetricRow {
  clicks: number;
  impressions: number;
  position: number;
}

export interface SearchMetricTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export interface SearchMetricComparison {
  current: SearchMetricTotals;
  previous: SearchMetricTotals;
  absolute: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number | null;
  };
  relative: {
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    position: number | null;
  };
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function aggregateSearchMetrics(rows: readonly SearchMetricRow[]): SearchMetricTotals {
  const clicks = rows.reduce((sum, row) => sum + Math.max(0, safeNumber(row.clicks)), 0);
  const impressions = rows.reduce((sum, row) => sum + Math.max(0, safeNumber(row.impressions)), 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + Math.max(0, safeNumber(row.impressions)) * Math.max(0, safeNumber(row.position)),
    0,
  );
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : null,
  };
}

export function relativeChangePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function compareSearchMetrics(
  currentRows: readonly SearchMetricRow[],
  previousRows: readonly SearchMetricRow[],
): SearchMetricComparison {
  const current = aggregateSearchMetrics(currentRows);
  const previous = aggregateSearchMetrics(previousRows);
  const positionDelta = current.position !== null && previous.position !== null
    ? current.position - previous.position
    : null;
  return {
    current,
    previous,
    absolute: {
      clicks: current.clicks - previous.clicks,
      impressions: current.impressions - previous.impressions,
      ctr: current.ctr - previous.ctr,
      position: positionDelta,
    },
    relative: {
      clicks: relativeChangePercent(current.clicks, previous.clicks),
      impressions: relativeChangePercent(current.impressions, previous.impressions),
      ctr: relativeChangePercent(current.ctr, previous.ctr),
      position: relativeChangePercent(current.position, previous.position),
    },
  };
}

export function classifyAveragePosition(position: number | null): 'top10' | 'top20' | 'outside20' | 'unobserved' {
  if (position === null) return 'unobserved';
  if (position <= 10) return 'top10';
  if (position <= 20) return 'top20';
  return 'outside20';
}
