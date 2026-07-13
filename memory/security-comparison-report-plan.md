---
name: security-comparison-report-plan
description: Plan for implementing security comparison report in Reports page
metadata:
  type: project
---

# Security Comparison Report Implementation Plan

## Overview
Add a new "Security Comparison Report" view to the Reports page that displays period-over-period comparison data with tables and charts.

## Data Source
The comparison data will be computed from the existing `checkpoint_events` table in the database.

## Implementation Steps

### 1. Backend - New API Endpoint
- **File**: `backend/routes/reportsRoute.js`
- **New Endpoint**: `GET /api/reports/comparison?prevStart=...&prevEnd=...&currStart=...&currEnd=...`
- **Functionality**: Query checkpoint_events for two periods and compute:
  - Total events, DLP, Phishing, Malware counts per period
  - Severity distribution
  - Top senders
  - Monthly breakdowns
  - Remediation rates

### 2. Frontend - New Report Type
- **File**: `frontend/src/pages/Reports.jsx`
- **Changes**:
  - Add "security-comparison" as a new report type
  - When this type is selected, show comparison UI instead of form

### 3. Frontend - Comparison Components (new file)
- **File**: `frontend/src/components/SecurityComparisonReport.jsx`
- **Components**:
  - `SummaryMetricsTable` - Previous vs Current period metrics with % change
  - `MonthlyTrendChart` - Line chart showing monthly DLP/Phishing/Malware/Total
  - `EventTypeBreakdown` - Pie/Bar chart showing event type distribution
  - `SeverityDistribution` - Donut chart showing severity levels
  - `TopPhishingSenders` - Horizontal bar chart of top malicious senders
  - `TopDlpMailboxes` - Horizontal bar chart of top DLP source mailboxes
  - `RecommendationsList` - List of actionable recommendations

### 4. Integration
- Fetch comparison data when Reports page loads or when security-comparison type is selected
- Pass data to the SecurityComparisonReport component
- Handle loading and error states

## UI Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Security Posture Report — Checkpoint Email & Collab       │
├─────────────────────────────────────────────────────────────┤
│  Period Selector (or use default periods)                  │
├───────────────────────┬─────────────────────────────────────┤
│  Summary Metrics     │  Executive Summary Card             │
│  (Table with Δ%)     │  (Key insights)                      │
├───────────────────────┴─────────────────────────────────────┤
│  Monthly Event Trend (Line Chart)                           │
├───────────────────────────┬─────────────────────────────────┤
│  Event Type Breakdown    │  Severity Distribution           │
│  (Pie Chart)             │  (Donut Chart)                   │
├───────────────────────────┴─────────────────────────────────┤
│  Top Phishing Senders (Bar Chart)                          │
├───────────────────────────┬─────────────────────────────────┤
│  Top DLP Mailboxes        │  Recommendations                │
│  (Bar Chart)              │  (Action items)                 │
└───────────────────────────┴─────────────────────────────────┘
```

## Key Design Decisions
- Use existing recharts library (already installed)
- Follow existing widget patterns from CheckpointDashboard
- Default to the periods mentioned in the report:
  - Previous: 26 Sep 2025 – 31 Jan 2026
  - Current: 1 Feb 2026 – 10 Jun 2026
- Make period selector configurable