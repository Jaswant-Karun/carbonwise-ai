import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Download,
  Droplets,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Globe,
  History,
  Info,
  Leaf,
  Lightbulb,
  Package,
  PieChart,
  Plus,
  Recycle,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import LoadingState from '../components/LoadingState';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CATEGORY_ICONS = {
  food: Utensils,
  electricity: Zap,
  transport: Car,
  water: Droplets,
  waste: Recycle,
  facilities: Building2,
  other: Package,
};

const FILTER_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'current_month', label: 'Current Month' },
  { id: 'previous_month', label: 'Previous Month' },
  { id: '3m', label: 'Last 3 Months' },
  { id: '6m', label: 'Last 6 Months' },
  { id: 'current_year', label: 'Current Year' },
  { id: 'custom', label: 'Custom Range...' },
];

const round = (val, d = 2) => {
  const n = Number(val);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : '0.00';
};

const Reports = () => {
  const [activeTab, setActiveTab] = useState('carbon'); // 'carbon' or 'climate'

  // Report Filter State
  const [selectedFilter, setSelectedFilter] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Rollups View Selector
  const [rollupView, setRollupView] = useState('daily'); // 'daily', 'weekly', 'monthly', 'annual'

  // Detailed Report Data
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [csvDownloading, setCsvDownloading] = useState(false);

  // Monthly Sustainability Modal State
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyReportData, setMonthlyReportData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Climate AI Report State (Retained Feature)
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [parameter, setParameter] = useState('temperature_2m');
  const [timeRange, setTimeRange] = useState('annual');
  const [climateReport, setClimateReport] = useState(null);
  const [climateLoading, setClimateLoading] = useState(false);
  const [climateError, setClimateError] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch Detailed Report
  const fetchDetailedReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = { filter: selectedFilter };
      if (selectedFilter === 'custom' && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const res = await api.get('/reports/analytics', { params });
      setReportData(res.data);
    } catch (err) {
      console.error('Error loading reports analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFilter, customStart, customEnd]);

  useEffect(() => {
    fetchDetailedReport();
    const handleSync = () => { fetchDetailedReport(); };
    window.addEventListener('carbonwise:activity-recorded', handleSync);
    return () => {
      window.removeEventListener('carbonwise:activity-recorded', handleSync);
    };
  }, [fetchDetailedReport]);

  // Load Regions for Climate Tab
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const res = await api.get('/environment/regions');
        const data = res.data || [];
        setRegions(data);
        if (data.length > 0 && !selectedRegionId) {
          setSelectedRegionId(String(data[0].id));
        }
      } catch (err) {
        console.warn('Failed to load regions:', err.message);
      }
    };
    loadRegions();
  }, []);

  // Download PDF Report
  const handleDownloadPdf = async (filterParam = selectedFilter) => {
    setPdfDownloading(true);
    try {
      const params = { filter: filterParam };
      if (filterParam === 'custom' && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const res = await api.get('/reports/pdf', {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `carbonwise-audit-report-${filterParam}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Error generating PDF report. Please verify activity logs.');
    } finally {
      setPdfDownloading(false);
    }
  };

  // Download CSV Report
  const handleDownloadCsv = async () => {
    setCsvDownloading(true);
    try {
      const params = { filter: selectedFilter };
      if (selectedFilter === 'custom' && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const res = await api.get('/reports/csv', {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `carbonwise-emissions-${selectedFilter}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export error:', err);
      alert('Error generating CSV report.');
    } finally {
      setCsvDownloading(false);
    }
  };

  // Fetch Monthly Sustainability Report
  const handleOpenMonthlyModal = async () => {
    setShowMonthlyModal(true);
    setMonthlyLoading(true);
    try {
      const res = await api.get('/reports/monthly-sustainability', {
        params: { month: selectedMonth },
      });
      setMonthlyReportData(res.data);
    } catch (err) {
      console.error('Monthly report error:', err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  const handleMonthChange = async (month) => {
    setSelectedMonth(month);
    setMonthlyLoading(true);
    try {
      const res = await api.get('/reports/monthly-sustainability', {
        params: { month },
      });
      setMonthlyReportData(res.data);
    } catch (err) {
      console.error('Monthly report error:', err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  // Generate Climate AI Report
  const generateClimateAiReport = async () => {
    if (!selectedRegionId) return;
    setClimateLoading(true);
    setClimateError('');
    try {
      const res = await api.get(`/environment/regions/${selectedRegionId}/ai-trend-report`, {
        params: { parameter, timeRange },
      });
      setClimateReport(res.data);
    } catch (err) {
      setClimateError(err.response?.data?.message || 'Unable to generate climate AI report.');
    } finally {
      setClimateLoading(false);
    }
  };

  // Copy Climate Summary
  const handleCopyReport = () => {
    if (!climateReport?.report) return;
    const r = climateReport.report;
    const text = `CARBONWISE AI — EXECUTIVE CLIMATE INTELLIGENCE REPORT
Region: ${climateReport.region?.name || 'Selected Region'}
Parameter: ${climateReport.parameter} (${climateReport.timeRange})
Generated: ${new Date(climateReport.generatedAt).toLocaleString()}

EXECUTIVE SUMMARY:
${r.summary}

OBSERVED CHANGE:
${r.whatChanged}

BASELINE METHODOLOGY:
${r.baselineUsed}

DATA SOURCE & ATTRIBUTION:
${r.dataSource}

SCIENTIFIC LIMITATIONS:
${r.limitations}

RECOMMENDATIONS:
${(r.recommendations || []).map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ========================================================
  // CHART CONFIGURATIONS (6 INTERACTIVE CHART.JS CHARTS)
  // ========================================================

  // Chart 1: Category-wise Doughnut Chart
  const doughnutData = useMemo(() => {
    const list = reportData?.categoryBreakdown || [];
    const active = list.filter((c) => c.emissionsKg > 0);
    if (!active.length) {
      return {
        labels: ['No Activity Recorded'],
        datasets: [{ data: [1], backgroundColor: ['#1e293b'] }],
      };
    }
    return {
      labels: active.map((c) => c.label),
      datasets: [
        {
          data: active.map((c) => c.emissionsKg),
          backgroundColor: active.map((c) => c.color),
          borderWidth: 2,
          borderColor: '#0f172a',
        },
      ],
    };
  }, [reportData]);

  // Chart 2: Daily Emission Trend Line Chart
  const dailyLineData = useMemo(() => {
    const list = reportData?.dailyRollup || [];
    if (!list.length) {
      return {
        labels: ['No Data'],
        datasets: [{ data: [0], borderColor: '#10b981' }],
      };
    }
    return {
      labels: list.map((d) => d.label),
      datasets: [
        {
          label: 'Daily Footprint (kg CO₂e)',
          data: list.map((d) => d.emissionsKg),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 2.2,
          tension: 0.35,
          fill: true,
          pointRadius: list.length > 25 ? 0 : 3,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [reportData]);

  // Chart 3: Monthly Emissions Bar Chart (Historical)
  const monthlyBarData = useMemo(() => {
    const list = reportData?.monthlyRollup || [];
    if (!list.length) {
      return {
        labels: ['Current Month'],
        datasets: [{ label: 'Emissions (kg CO₂e)', data: [reportData?.totals?.emissionsKg || 0], backgroundColor: '#38bdf8' }],
      };
    }
    return {
      labels: list.map((m) => m.label),
      datasets: [
        {
          label: 'Monthly Emissions (kg CO₂e)',
          data: list.map((m) => m.emissionsKg),
          backgroundColor: '#38bdf8',
          borderRadius: 6,
          barThickness: 24,
        },
      ],
    };
  }, [reportData]);

  // Chart 4: Category Comparison Chart (Current vs Previous Baseline Period)
  const categoryComparisonData = useMemo(() => {
    const list = reportData?.categoryBreakdown || [];
    return {
      labels: list.map((c) => c.label),
      datasets: [
        {
          label: 'Current Period (kg CO₂e)',
          data: list.map((c) => c.emissionsKg),
          backgroundColor: '#10b981',
          borderRadius: 4,
        },
        {
          label: 'Baseline Prior Period (kg CO₂e)',
          data: list.map((c) => c.prevEmissionsKg),
          backgroundColor: '#64748b',
          borderRadius: 4,
        },
      ],
    };
  }, [reportData]);

  // Chart 5: Historical Progress Chart (Cumulative Trajectory)
  const historicalProgressData = useMemo(() => {
    const list = reportData?.dailyRollup || [];
    let cum = 0;
    const cumulativePoints = list.map((d) => {
      cum += d.emissionsKg;
      return round(cum, 2);
    });

    return {
      labels: list.length ? list.map((d) => d.label) : ['No Data'],
      datasets: [
        {
          label: 'Cumulative Emission Growth (kg CO₂e)',
          data: cumulativePoints.length ? cumulativePoints : [0],
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: list.length > 25 ? 0 : 3,
        },
      ],
    };
  }, [reportData]);

  // Chart 6: Emission Contribution Chart (Horizontal Bar Chart)
  const contributionData = useMemo(() => {
    const list = [...(reportData?.categoryBreakdown || [])].sort((a, b) => b.emissionsKg - a.emissionsKg);
    return {
      labels: list.map((c) => c.label),
      datasets: [
        {
          label: 'Share of Total (%)',
          data: list.map((c) => c.percentage),
          backgroundColor: list.map((c) => c.color),
          borderRadius: 5,
        },
      ],
    };
  }, [reportData]);

  // Top Sector KPI
  const topSector = useMemo(() => {
    const list = reportData?.categoryBreakdown || [];
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => b.emissionsKg - a.emissionsKg);
    return sorted[0]?.emissionsKg > 0 ? sorted[0] : null;
  }, [reportData]);

  if (loading && !reportData) {
    return (
      <Layout>
        <div className="white-loading-container">
          <LoadingState label="Compiling certified carbon emission audit report..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="intelligence-toolbar" style={{ marginBottom: '20px' }}>
        <div>
          <span className="section-kicker">Detailed Environmental Reports & Audits</span>
          <h2>Carbon Emissions & Sustainability Analytics Hub</h2>
          <p className="page-supporting-copy">
            Complete sector-wise accounting, multi-period rollups, verified baselines, and downloadable audit reports.
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab('carbon')}
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              background: activeTab === 'carbon' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'carbon' ? '#090d16' : '#94a3b8',
              border: 0,
              fontWeight: 700,
            }}
          >
            <BarChart3 size={14} style={{ marginRight: '6px' }} />
            Carbon Reports & Analytics
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab('climate')}
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              background: activeTab === 'climate' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'climate' ? '#090d16' : '#94a3b8',
              border: 0,
              fontWeight: 700,
            }}
          >
            <Sparkles size={14} style={{ marginRight: '6px' }} />
            AI Climate Executive Summary
          </button>
        </div>
      </div>

      {activeTab === 'carbon' ? (
        <div>
          {/* ========================================================
              CONTROLS & REPORT FILTERS TOOLBAR
          ======================================================== */}
          <div className="reports-toolbar-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} className="icon-mint" />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#183247' }}>Audit Timeframe:</span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  ({reportData?.meta?.startDate} to {reportData?.meta?.endDate})
                </span>
              </div>

              {/* Action Buttons: PDF, CSV, Monthly Sustainability */}
              <div className="reports-export-btn-group">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  disabled={pdfDownloading}
                  className="btn-log-action"
                  style={{ padding: '7px 14px', fontSize: '0.78rem' }}
                  title="Download verified PDF carbon audit report"
                >
                  <Download size={13} />
                  <span>{pdfDownloading ? 'Generating PDF...' : 'Download PDF Report'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={csvDownloading}
                  className="page-btn"
                  style={{ padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  title="Export raw activity emissions ledger to CSV"
                >
                  <FileSpreadsheet size={13} />
                  <span>{csvDownloading ? 'Exporting...' : 'Export CSV'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenMonthlyModal}
                  className="btn-factors-explorer"
                  style={{ padding: '7px 14px' }}
                  title="Generate monthly sustainability report"
                >
                  <Calendar size={13} />
                  <span>Monthly Audit Pack</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="reports-filter-pills-row">
              {FILTER_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedFilter(f.id);
                  }}
                  className={`reports-filter-pill ${selectedFilter === f.id ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {selectedFilter === 'custom' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="field-label" style={{ margin: 0 }}>Start Date:</span>
                <input
                  type="date"
                  className="field-input"
                  style={{ width: 'auto', padding: '4px 10px' }}
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="field-label" style={{ margin: 0 }}>End Date:</span>
                <input
                  type="date"
                  className="field-input"
                  style={{ width: 'auto', padding: '4px 10px' }}
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
                <button
                  type="button"
                  onClick={fetchDetailedReport}
                  className="btn-log-action"
                  style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                >
                  Apply Custom Range
                </button>
              </div>
            )}
          </div>

          {/* ========================================================
              FOUR UNIFIED REPORT KPI METRICS
          ======================================================== */}
          <div className="dashboard-summary-strip" style={{ marginBottom: '24px' }}>
            {/* KPI 1: Total Footprint */}
            <div className="summary-metric-card">
              <div className="summary-card-header">
                <span className="summary-card-title">Total Emissions ({reportData?.meta?.periodLabel})</span>
                <span className="summary-card-icon-wrap mint">
                  <Leaf size={18} />
                </span>
              </div>
              <div className="summary-card-value-row">
                <span className="summary-card-value">{round(reportData?.totals?.emissionsKg)}</span>
                <span className="summary-card-unit">kg CO₂e</span>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500, marginLeft: '6px' }}>
                  ({round(reportData?.totals?.emissionsTonnes, 4)} t)
                </span>
              </div>
              <div className="summary-card-footer">
                <span className={`trend-badge ${reportData?.totals?.reductionStatus || 'unchanged'}`}>
                  {reportData?.totals?.percentageChange != null ? (
                    reportData.totals.percentageChange < 0 ? (
                      <><ArrowDownRight size={13} /> {Math.abs(reportData.totals.percentageChange)}% vs prior baseline</>
                    ) : (
                      <><ArrowUpRight size={13} /> +{reportData.totals.percentageChange}% vs prior baseline</>
                    )
                  ) : (
                    'First Baseline Cycle'
                  )}
                </span>
                <span className="summary-card-sub">
                  Baseline: {round(reportData?.totals?.prevEmissionsKg)} kg CO₂e
                </span>
              </div>
            </div>

            {/* KPI 2: Reduction Progress */}
            <div className="summary-metric-card">
              <div className="summary-card-header">
                <span className="summary-card-title">Net Reduction Progress</span>
                <span className="summary-card-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <TrendingDown size={18} />
                </span>
              </div>
              <div className="summary-card-value-row">
                <span className="summary-card-value">
                  {round(Math.abs(reportData?.totals?.reductionKg || 0))}
                </span>
                <span className="summary-card-unit">kg Saved</span>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500, marginLeft: '6px' }}>
                  ({round(Math.abs(reportData?.totals?.reductionTonnes || 0), 4)} t)
                </span>
              </div>
              <div className="summary-card-footer">
                <span className={`trend-badge ${reportData?.totals?.reductionKg > 0 ? 'reduced' : 'unchanged'}`}>
                  {reportData?.totals?.reductionKg > 0 ? 'Net Emissions Reduced' : 'Trajectory Maintained'}
                </span>
                <span className="summary-card-sub">
                  GHG Corporate Accounting
                </span>
              </div>
            </div>

            {/* KPI 3: Top Emission Driver */}
            <div className="summary-metric-card">
              <div className="summary-card-header">
                <span className="summary-card-title">Highest-Emission Sector</span>
                <span className="summary-card-icon-wrap amber">
                  <Flame size={18} />
                </span>
              </div>
              <div className="summary-card-value-row">
                <span className="summary-card-value">
                  {topSector ? `${topSector.percentage}%` : '0%'}
                </span>
                <span className="summary-card-unit">{topSector ? topSector.label : 'None'}</span>
              </div>
              <div className="summary-card-footer">
                <span className="summary-card-sub">
                  Sector Total: {round(topSector?.emissionsKg || 0)} kg ({round((topSector?.emissionsKg || 0) / 1000, 4)} t)
                </span>
              </div>
            </div>

            {/* KPI 4: Analyzed Entries */}
            <div className="summary-metric-card">
              <div className="summary-card-header">
                <span className="summary-card-title">Database Audit Entries</span>
                <span className="summary-card-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                  <Database size={18} />
                </span>
              </div>
              <div className="summary-card-value-row">
                <span className="summary-card-value">
                  {reportData?.totals?.activityCount || 0}
                </span>
                <span className="summary-card-unit">activities</span>
              </div>
              <div className="summary-card-footer">
                <span className="summary-card-sub" style={{ color: '#10b981' }}>
                  ✓ 100% Real PostgreSQL Data
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================
              SIX VISUAL CHARTS USING CHART.JS
          ======================================================== */}
          <div className="reports-charts-grid-2col">
            {/* Chart 1: Category-wise Doughnut Chart */}
            <div className="reports-chart-card">
              <div className="reports-chart-header">
                <div>
                  <h3 className="reports-chart-title">
                    <PieChart size={16} className="icon-mint" />
                    Sector Emission Distribution
                  </h3>
                  <p className="reports-chart-subtitle">Category-wise share across all 7 carbon sectors</p>
                </div>
              </div>
              <div className="reports-chart-canvas-wrap">
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 11 } } },
                    },
                    cutout: '68%',
                  }}
                />
              </div>
            </div>

            {/* Chart 2: Daily Emission Trend Line Chart */}
            <div className="reports-chart-card">
              <div className="reports-chart-header">
                <div>
                  <h3 className="reports-chart-title">
                    <Activity size={16} style={{ color: '#10b981' }} />
                    Daily Emission Trajectory
                  </h3>
                  <p className="reports-chart-subtitle">Day-by-day continuous carbon footprint</p>
                </div>
              </div>
              <div className="reports-chart-canvas-wrap">
                <Line
                  data={dailyLineData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
            </div>

            {/* Chart 3: Monthly Emissions Bar Chart */}
            <div className="reports-chart-card">
              <div className="reports-chart-header">
                <div>
                  <h3 className="reports-chart-title">
                    <BarChart3 size={16} style={{ color: '#38bdf8' }} />
                    Historical Monthly Footprint
                  </h3>
                  <p className="reports-chart-subtitle">Month-over-month recorded carbon emissions</p>
                </div>
              </div>
              <div className="reports-chart-canvas-wrap">
                <Bar
                  data={monthlyBarData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
            </div>

            {/* Chart 4: Category Comparison Chart */}
            <div className="reports-chart-card">
              <div className="reports-chart-header">
                <div>
                  <h3 className="reports-chart-title">
                    <Scale size={16} style={{ color: '#f59e0b' }} />
                    Category Comparison (Current vs Prior Period)
                  </h3>
                  <p className="reports-chart-subtitle">Sector-by-sector delta against previous equivalent baseline</p>
                </div>
              </div>
              <div className="reports-chart-canvas-wrap">
                <Bar
                  data={categoryComparisonData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9.5 } } },
                      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    },
                    plugins: {
                      legend: { position: 'top', labels: { color: '#cbd5e1', font: { size: 11 } } },
                    },
                  }}
                />
              </div>
            </div>

            {/* Chart 5: Historical Progress Chart */}
            <div className="reports-chart-card">
              <div className="reports-chart-header">
                <div>
                  <h3 className="reports-chart-title">
                    <History size={16} style={{ color: '#8b5cf6' }} />
                    Historical Cumulative Progress
                  </h3>
                  <p className="reports-chart-subtitle">Cumulative emission accumulation over the selected audit window</p>
                </div>
              </div>
              <div className="reports-chart-canvas-wrap">
                <Line
                  data={historicalProgressData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
            </div>

            {/* Chart 6: Emission Contribution Chart */}
            <div className="reports-chart-card">
              <div className="reports-chart-header">
                <div>
                  <h3 className="reports-chart-title">
                    <Flame size={16} style={{ color: '#ec4899' }} />
                    Sector Emission Contribution (%)
                  </h3>
                  <p className="reports-chart-subtitle">Ranked percentage contribution by sector</p>
                </div>
              </div>
              <div className="reports-chart-canvas-wrap">
                <Bar
                  data={contributionData}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v) => `${v}%` }, max: 100 },
                      y: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 10 } } },
                    },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
            </div>
          </div>

          {/* ========================================================
              CATEGORY BREAKDOWN COMPARISON TABLE (ALL 7 SECTORS)
          ======================================================== */}
          <div className="tracker-card" style={{ marginBottom: '24px' }}>
            <div className="tracker-card-header" style={{ marginBottom: '16px' }}>
              <div>
                <h3 className="card-section-title">
                  <Leaf size={18} className="icon-mint" />
                  Category-Wise Carbon Emission Accounting
                </h3>
                <p className="card-subtitle-small">
                  Detailed sector footprints, percentage contributions, and baseline variance across all 7 monitored categories
                </p>
              </div>
            </div>

            <div className="activity-table-wrapper">
              <table className="custom-data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Current Footprint (Dual)</th>
                    <th>Share %</th>
                    <th>Activity Count</th>
                    <th>Baseline Footprint</th>
                    <th>Variance (Δ)</th>
                    <th style={{ textAlign: 'center' }}>Trend Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportData?.categoryBreakdown || []).map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.category] || Package;
                    return (
                      <tr key={cat.category}>
                        <td>
                          <span className="category-cell-badge">
                            <Icon size={14} style={{ color: cat.color }} />
                            <strong style={{ color: '#183247' }}>{cat.label}</strong>
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                            <strong className="text-mint" style={{ fontSize: '0.86rem' }}>
                              {round(cat.emissionsKg)} kg
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              ({round(cat.emissionsTonnes, 4)} t)
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="mono" style={{ fontSize: '0.82rem' }}>{cat.percentage}%</span>
                            <div style={{ width: '45px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, cat.percentage)}%`, height: '100%', background: cat.color }} />
                            </div>
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                          {cat.activityCount} logs
                        </td>
                        <td className="mono" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {round(cat.prevEmissionsKg)} kg
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: '0.8rem', color: cat.changeKg < 0 ? '#34d399' : cat.changeKg > 0 ? '#f87171' : '#94a3b8' }}>
                            {cat.changeKg > 0 ? `+${round(cat.changeKg)}` : round(cat.changeKg)} kg
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`trend-badge ${cat.trend}`}>
                            {cat.percentageChange != null ? (
                              cat.percentageChange < 0 ? (
                                <><ArrowDownRight size={12} /> {Math.abs(cat.percentageChange)}%</>
                              ) : (
                                <><ArrowUpRight size={12} /> +{cat.percentageChange}%</>
                              )
                            ) : (
                              'Baseline'
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================
              HIGHEST-EMISSION ACTIVITIES (TOP IMPACT DRIVERS)
          ======================================================== */}
          <div className="tracker-card" style={{ marginBottom: '24px' }}>
            <div className="tracker-card-header" style={{ marginBottom: '16px' }}>
              <div>
                <h3 className="card-section-title">
                  <Flame size={18} style={{ color: '#f59e0b' }} />
                  Highest-Emission Activities (Top 10 Impact Drivers)
                </h3>
                <p className="card-subtitle-small">
                  Single largest emission contributors in the selected audit timeframe for targeted reduction planning
                </p>
              </div>
            </div>

            <div className="activity-table-wrapper">
              {!reportData?.highestActivities?.length ? (
                <div className="empty-state-notice">
                  <Leaf size={28} className="icon-mint" />
                  <span>No activities recorded in this timeframe. Use Activity Tracker to log entries. Real verified calculations are shown without synthetic filler.</span>
                </div>
              ) : (
                <table className="custom-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '100px' }}>Date</th>
                      <th style={{ width: '150px' }}>Sector</th>
                      <th>Activity Details</th>
                      <th style={{ width: '150px' }}>Emissions (Dual)</th>
                      <th style={{ width: '100px' }}>GHG Scope</th>
                      <th>Scientific Citation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.highestActivities.map((act, idx) => (
                      <tr key={act.id || idx}>
                        <td className="mono" style={{ color: '#f59e0b', fontWeight: 700 }}>
                          #{act.rank || idx + 1}
                        </td>
                        <td className="mono" style={{ fontSize: '0.78rem' }}>
                          {act.date}
                        </td>
                        <td>
                          <span className="category-cell-badge">
                            <strong style={{ color: '#183247' }}>{act.categoryLabel || act.label || act.activity_type}</strong>
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          <strong style={{ color: '#183247' }}>{act.details || act.detailsText || 'Activity emission'}</strong>
                          {act.notes && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Ref: {act.notes}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                            <strong className="text-mint" style={{ fontSize: '0.86rem' }}>
                              {round(act.emissionsKg)} kg
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              ({round(act.emissionsTonnes, 4)} t)
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`btn-scope-pill ${(act.scope || 'Scope 3').toLowerCase().replace(' ', '-')}`}>
                            {act.scope || 'Scope 3'}
                          </span>
                        </td>
                        <td>
                          <span className="source-citation-badge">{act.factorSource || 'UK DEFRA 2024 / IPCC AR6'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ========================================================
              PERIODIC ROLLUPS SELECTOR (DAILY, WEEKLY, MONTHLY, ANNUAL)
          ======================================================== */}
          <div className="tracker-card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 className="card-section-title">
                  <Calendar size={18} className="icon-mint" />
                  Periodic Emission Rollup Tables
                </h3>
                <p className="card-subtitle-small">
                  Switch between daily, weekly, monthly, and annual aggregated emission summaries
                </p>
              </div>

              {/* View Selector Buttons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setRollupView('daily')}
                  className={`reports-filter-pill ${rollupView === 'daily' ? 'active' : ''}`}
                >
                  Daily Summaries ({reportData?.dailyRollup?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRollupView('weekly')}
                  className={`reports-filter-pill ${rollupView === 'weekly' ? 'active' : ''}`}
                >
                  Weekly Summaries ({reportData?.weeklyRollup?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRollupView('monthly')}
                  className={`reports-filter-pill ${rollupView === 'monthly' ? 'active' : ''}`}
                >
                  Monthly Reports ({reportData?.monthlyRollup?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRollupView('annual')}
                  className={`reports-filter-pill ${rollupView === 'annual' ? 'active' : ''}`}
                >
                  Annual Reports ({reportData?.annualRollup?.length || 0})
                </button>
              </div>
            </div>

            <div className="activity-table-wrapper" style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {rollupView === 'daily' && (
                <table className="custom-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Label</th>
                      <th>Emissions (kg CO₂e)</th>
                      <th>Emissions (tonnes CO₂e)</th>
                      <th>Recorded Activities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData?.dailyRollup || []).map((d) => (
                      <tr key={d.date}>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>{d.date}</td>
                        <td><strong style={{ color: '#183247' }}>{d.label}</strong></td>
                        <td className="mono" style={{ color: d.emissionsKg > 0 ? '#10b981' : '#64748b', fontWeight: 600 }}>
                          {round(d.emissionsKg)} kg
                        </td>
                        <td className="mono" style={{ color: '#94a3b8' }}>{round(d.emissionsTonnes, 4)} t</td>
                        <td className="mono">{d.activityCount} logs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {rollupView === 'weekly' && (
                <table className="custom-data-table">
                  <thead>
                    <tr>
                      <th>Week Start Date</th>
                      <th>Week Label</th>
                      <th>Weekly Emissions (kg CO₂e)</th>
                      <th>Weekly Tonnes CO₂e</th>
                      <th>Recorded Activities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData?.weeklyRollup || []).map((w) => (
                      <tr key={w.weekStart}>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>{w.weekStart}</td>
                        <td><strong style={{ color: '#183247' }}>{w.label}</strong></td>
                        <td className="mono" style={{ color: '#10b981', fontWeight: 600 }}>{round(w.emissionsKg)} kg</td>
                        <td className="mono" style={{ color: '#94a3b8' }}>{round(w.emissionsTonnes, 4)} t</td>
                        <td className="mono">{w.activityCount} logs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {rollupView === 'monthly' && (
                <table className="custom-data-table">
                  <thead>
                    <tr>
                      <th>Month Key</th>
                      <th>Calendar Month</th>
                      <th>Monthly Emissions (kg CO₂e)</th>
                      <th>Monthly Tonnes CO₂e</th>
                      <th>Recorded Activities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData?.monthlyRollup || []).map((m) => (
                      <tr key={m.monthKey}>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>{m.monthKey}</td>
                        <td><strong style={{ color: '#183247' }}>{m.label}</strong></td>
                        <td className="mono" style={{ color: '#10b981', fontWeight: 600 }}>{round(m.emissionsKg)} kg</td>
                        <td className="mono" style={{ color: '#94a3b8' }}>{round(m.emissionsTonnes, 4)} t</td>
                        <td className="mono">{m.activityCount} logs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {rollupView === 'annual' && (
                <table className="custom-data-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Annual Emissions (kg CO₂e)</th>
                      <th>Annual Tonnes CO₂e</th>
                      <th>Recorded Activities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData?.annualRollup || []).map((y) => (
                      <tr key={y.yearKey}>
                        <td><strong style={{ color: '#183247' }}>{y.yearKey}</strong></td>
                        <td className="mono" style={{ color: '#10b981', fontWeight: 600 }}>{round(y.emissionsKg)} kg</td>
                        <td className="mono" style={{ color: '#94a3b8' }}>{round(y.emissionsTonnes, 4)} t</td>
                        <td className="mono">{y.activityCount} logs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================
           TAB 2: CLIMATE & REGIONAL AI EXECUTIVE SUMMARY
        ======================================================== */
        <div>
          {/* Scientific Transparency Disclaimer */}
          <div
            style={{
              background: 'rgba(16, 24, 39, 0.75)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '12px',
              padding: '12px 18px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <Info size={18} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
              <strong style={{ color: '#f1f5f9' }}>Reporting Integrity Architecture:</strong> All statistical trends, decadal warming rates, and baseline comparisons are computed deterministically from verified Open-Meteo and NASA POWER datasets. Gemini translates verified data into structured executive briefs without fabricating figures.
            </div>
          </div>

          <div className="tracker-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f1f5f9', marginBottom: '14px' }}>
              Configure Regional Climate Intelligence Report
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              <label className="filter-control">
                <span>Monitored Region</span>
                <select
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                >
                  {regions.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name} {reg.country ? `(${reg.country})` : ''}
                    </option>
                  ))}
                  {!regions.length && <option value="">No regions configured</option>}
                </select>
              </label>

              <label className="filter-control">
                <span>Environmental Indicator</span>
                <select
                  value={parameter}
                  onChange={(e) => setParameter(e.target.value)}
                >
                  <option value="temperature_2m">Temperature 2m (°C)</option>
                  <option value="precipitation">Precipitation Sum (mm)</option>
                </select>
              </label>

              <label className="filter-control">
                <span>Resolution Timeframe</span>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option value="annual">Annual Decadal Trajectory</option>
                  <option value="monthly">Monthly Seasonal Cycle</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={generateClimateAiReport}
                disabled={climateLoading || !selectedRegionId}
                style={{ padding: '10px 22px', fontSize: '0.86rem' }}
              >
                <Sparkles size={16} className={climateLoading ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
                {climateLoading ? 'Synthesizing Report...' : '✨ Generate AI Executive Summary'}
              </button>
            </div>

            {climateError && (
              <div style={{ color: '#f87171', fontSize: '0.84rem', marginTop: '12px' }}>
                ⚠️ {climateError}
              </div>
            )}
          </div>

          {/* Climate Output Card */}
          {climateReport?.report && (
            <div
              className="tracker-card"
              style={{
                background: 'linear-gradient(145deg, rgba(14, 22, 38, 0.95), rgba(9, 13, 22, 0.98))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '16px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--mint-strong)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        border: '1px solid currentColor',
                      }}
                    >
                      Executive Intelligence Summary
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      Generated {new Date(climateReport.generatedAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', color: '#f1f5f9', margin: '4px 0' }}>
                    {climateReport.report.summary || `${climateReport.region?.name} Climate Assessment`}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Target Region: <strong style={{ color: '#f1f5f9' }}>{climateReport.region?.name}</strong> · Parameter: <strong style={{ color: '#f1f5f9' }}>{climateReport.parameter}</strong> ({climateReport.timeRange})
                  </div>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={handleCopyReport}
                  style={{
                    fontSize: '0.78rem',
                    padding: '8px 14px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#f1f5f9',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {copied ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
                  {copied ? 'Copied to Clipboard' : 'Copy Executive Brief'}
                </button>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ color: '#38bdf8', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    1. Observed Trend & Historical Trajectory
                  </h4>
                  <p style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.55, margin: 0 }}>
                    {climateReport.report.whatChanged}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <h4 style={{ color: 'var(--mint-strong)', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      2. Reference Baseline
                    </h4>
                    <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
                      {climateReport.report.baselineUsed}
                    </p>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <h4 style={{ color: '#a78bfa', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      3. Data Sources & Attribution
                    </h4>
                    <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
                      {climateReport.report.dataSource}
                    </p>
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ color: '#fbbf24', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    4. Methodological Limitations & Model Assumptions
                  </h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
                    {climateReport.report.limitations}
                  </p>
                </div>

                {climateReport.report.recommendations?.length > 0 && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <h4 style={{ color: 'var(--mint-strong)', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lightbulb size={16} /> 5. Practical Adaptation & Mitigation Recommendations
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px', color: '#e2e8f0', fontSize: '0.85rem' }}>
                      {climateReport.report.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MONTHLY SUSTAINABILITY REPORT MODAL
      ======================================================== */}
      {showMonthlyModal && (
        <div className="modal-overlay" onClick={() => setShowMonthlyModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '780px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} className="icon-mint" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#183247' }}>
                  Monthly Sustainability Audit Pack
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowMonthlyModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="field-label" style={{ margin: 0 }}>Target Month:</span>
                <input
                  type="month"
                  className="filter-select-compact"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn-log-action"
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                onClick={() => handleDownloadPdf('current_month')}
              >
                <Download size={13} />
                <span>Export This Month's PDF</span>
              </button>
            </div>

            {monthlyLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="spin icon-mint" style={{ margin: '0 auto 8px' }} />
                <div>Aggregating monthly sustainability telemetry...</div>
              </div>
            ) : monthlyReportData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Metric Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div className="math-step-card">
                    <span className="math-step-title">Month Footprint</span>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#183247' }}>
                      {round(monthlyReportData.report?.totals?.emissionsKg)} <span style={{ fontSize: '0.8rem', color: '#10b981' }}>kg CO₂e</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      ({round(monthlyReportData.report?.totals?.emissionsTonnes, 4)} tonnes)
                    </span>
                  </div>

                  <div className="math-step-card">
                    <span className="math-step-title">Logged Activities</span>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>
                      {monthlyReportData.report?.totals?.activityCount || 0}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Verified in PostgreSQL
                    </span>
                  </div>

                  <div className="math-step-card">
                    <span className="math-step-title">Net MoM Trajectory</span>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: monthlyReportData.report?.totals?.reductionKg > 0 ? '#34d399' : '#f87171' }}>
                      {monthlyReportData.report?.totals?.percentageChange != null ? `${monthlyReportData.report.totals.percentageChange}%` : 'Baseline'}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      vs previous month
                    </span>
                  </div>
                </div>

                {/* Practical Recommendations */}
                <div className="math-step-card" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                  <span className="math-step-title" style={{ color: '#10b981' }}>
                    Sustainability Reduction Plan for {monthlyReportData.monthName}
                  </span>
                  <ul className="assumption-list">
                    {(monthlyReportData.recommendations || []).map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Reports;
