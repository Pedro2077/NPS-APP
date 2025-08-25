import React, { useState, useMemo } from 'react';
import {
  Upload,
  FileText,
  BarChart3,
  TrendingUp,
  Users,
  AlertCircle,
  Award,
  Target,
  Download,
  Lightbulb,
  Activity,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

const NPSSystem = () => {
  const [csvData, setCsvData] = useState([]);
  const [npsResults, setNpsResults] = useState(null);
  const [npsResultsByPlan, setNpsResultsByPlan] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Cores por plano
  const planColors = {
    FREE: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', chart: '#6B7280' },
    LITE: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', chart: '#3B82F6' },
    PRO: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', chart: '#8B5CF6' },
  };

  // Simulação de dados de histórico por plano (exemplo)
  const mockHistoryByPlan = useMemo(
    () => [
      { date: '2024-12-25', FREE: 22, LITE: 40, PRO: 59 },
      { date: '2025-01-01', FREE: 28, LITE: 38, PRO: 62 },
      { date: '2025-01-08', FREE: 30, LITE: 42, PRO: 68 },
      { date: '2025-01-15', FREE: 25, LITE: 45, PRO: 65 },
    ],
    []
  );

  // ---- Upload & Parse CSV ----
  const processCSV = (file) => {
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target.result;
      const normalized = text.replace(/\r/g, ''); // normaliza CRLF
      const lines = normalized.split('\n').filter((line) => line.trim());
      if (lines.length === 0) {
        setIsProcessing(false);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      const data = lines
        .slice(1)
        .map((line) => {
          const values = line.split(',');
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index]?.trim();
          });
          return obj;
        })
        .filter(
          (row) =>
            row.nota && !isNaN(Number(row.nota)) && row.plano && Number(row.nota) >= 0 && Number(row.nota) <= 10
        );

      setCsvData(data);
      calculateNPS(data);
      calculateNPSByPlan(data);
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  // ---- Cálculos NPS ----
  const calculateNPS = (data) => {
    const scores = data.map((row) => Number(row.nota));
    const total = scores.length;
    const promoters = scores.filter((score) => score >= 9).length;
    const passives = scores.filter((score) => score >= 7 && score <= 8).length;
    const detractors = scores.filter((score) => score <= 6).length;

    const promoterPercentage = (promoters / total) * 100;
    const detractorPercentage = (detractors / total) * 100;
    const nps = Math.round(promoterPercentage - detractorPercentage);
    const averageScore = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;

    const results = {
      nps,
      total,
      promoters,
      passives,
      detractors,
      promoterPercentage: Math.round(promoterPercentage),
      passivePercentage: Math.round((passives / total) * 100),
      detractorPercentage: Math.round(detractorPercentage),
      averageScore: averageScore.toFixed(1),
    };

    setNpsResults(results);

    // Histórico de uploads (salva o resumo do upload atual)
    setUploadHistory((prev) => [
      {
        date: new Date().toISOString().split('T')[0],
        nps,
        total,
        id: Date.now(),
      },
      ...prev,
    ]);
  };

  const calculateNPSByPlan = (data) => {
    const plans = ['FREE', 'LITE', 'PRO'];
    const resultsByPlan = {};

    plans.forEach((plan) => {
      const planData = data.filter((row) => row.plano?.toUpperCase() === plan);
      const scores = planData.map((row) => Number(row.nota));
      const total = scores.length;

      if (total > 0) {
        const promoters = scores.filter((score) => score >= 9).length;
        const passives = scores.filter((score) => score >= 7 && score <= 8).length;
        const detractors = scores.filter((score) => score <= 6).length;

        const promoterPercentage = (promoters / total) * 100;
        const detractorPercentage = (detractors / total) * 100;
        const nps = Math.round(promoterPercentage - detractorPercentage);
        const averageScore = scores.reduce((a, b) => a + b, 0) / total;

        resultsByPlan[plan] = {
          nps,
          total,
          promoters,
          passives,
          detractors,
          promoterPercentage: Math.round(promoterPercentage),
          passivePercentage: Math.round((passives / total) * 100),
          detractorPercentage: Math.round(detractorPercentage),
          averageScore: averageScore.toFixed(1),
        };
      }
    });

    setNpsResultsByPlan(resultsByPlan);
  };

  // ---- Derivados/Métricas ----
  const scoreDistributionData = useMemo(() => {
    if (!csvData.length) return [];
    const distribution = {};
    for (let i = 0; i <= 10; i++) distribution[i] = 0;
    csvData.forEach((row) => {
      const score = Number(row.nota);
      if (!Number.isNaN(score)) distribution[score]++;
    });
    return Object.entries(distribution).map(([score, count]) => ({
      score: Number(score),
      count,
      percentage: ((count / csvData.length) * 100).toFixed(1),
    }));
  }, [csvData]);

  const planPercentages = useMemo(() => {
    if (!csvData.length) return {};
    const validPlans = ['FREE', 'LITE', 'PRO'];
    const planCounts = { FREE: 0, LITE: 0, PRO: 0 };

    csvData.forEach((row) => {
      const plan = row.plano?.toUpperCase();
      if (validPlans.includes(plan)) planCounts[plan]++;
    });

    const percentages = {};
    validPlans.forEach((plan) => {
      const count = planCounts[plan];
      if (count > 0) {
        percentages[plan] = {
          count,
          percentage: ((count / csvData.length) * 100).toFixed(1),
        };
      }
    });

    return percentages;
  }, [csvData]);

  const insights = useMemo(() => {
    if (!npsResults || Object.keys(npsResultsByPlan).length === 0) return [];
    const all = Object.entries(npsResultsByPlan);
    const bestPlan = all.reduce((a, b) => (a[1].nps > b[1].nps ? a : b));
    const worstPlan = all.reduce((a, b) => (a[1].nps < b[1].nps ? a : b));

    const out = [
      {
        type: 'success',
        icon: '🚀',
        message: `O plano ${bestPlan[0]} teve o melhor NPS (${bestPlan[1].nps})`,
      },
    ];

    if (worstPlan[1].nps < 30) {
      out.push({
        type: 'warning',
        icon: '⚠️',
        message: `O plano ${worstPlan[0]} precisa de atenção (NPS ${worstPlan[1].nps})`,
      });
    }

    if (npsResults.detractorPercentage > 30) {
      out.push({
        type: 'error',
        icon: '🔴',
        message: `Alto percentual de detratores (${npsResults.detractorPercentage}%) - requer ação imediata`,
      });
    }

    if (npsResults.promoterPercentage > 60) {
      out.push({
        type: 'success',
        icon: '✨',
        message: `Excelente base de promotores (${npsResults.promoterPercentage}%) - oportunidade de crescimento orgânico`,
      });
    }

    return out;
  }, [npsResults, npsResultsByPlan]);

  // ---- Export CSV ----
  const exportData = () => {
    if (!csvData.length) return;
    const headers = ['data', 'cliente', 'usuario', 'nota', 'comentario', 'plano', 'categoria'];
    const csvContent = [
      headers.join(','),
      ...csvData.map((row) => {
        const nota = Number(row.nota);
        const categoria = nota >= 9 ? 'Promotor' : nota >= 7 ? 'Neutro' : 'Detrator';
        return [row.data || '', row.cliente || '', row.usuario || '', row.nota || '', row.comentario || '', row.plano || '', categoria].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `nps_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---- Helpers de UI ----
  const getNPSColor = (nps) => {
    if (nps >= 70) return 'text-green-600';
    if (nps >= 50) return 'text-yellow-600';
    if (nps >= 0) return 'text-orange-600';
    return 'text-red-600';
  };

  const getNPSGradient = (nps) => {
    if (nps >= 70) return 'bg-gradient-to-br from-green-500 to-green-600';
    if (nps >= 50) return 'bg-gradient-to-br from-yellow-500 to-yellow-600';
    if (nps >= 0) return 'bg-gradient-to-br from-orange-500 to-orange-600';
    return 'bg-gradient-to-br from-red-500 to-red-600';
  };

  const getNPSLabel = (nps) => {
    if (nps >= 70) return 'Excelente';
    if (nps >= 50) return 'Muito Bom';
    if (nps >= 0) return 'Razoável';
    return 'Crítico';
  };

  // ---- Dados para gráficos ----
  const pieData = npsResults
    ? [
        { name: 'Promotores', value: npsResults.promoters, color: '#10B981' },
        { name: 'Neutros', value: npsResults.passives, color: '#F59E0B' },
        { name: 'Detratores', value: npsResults.detractors, color: '#EF4444' },
      ]
    : [];

  const planDistributionData = Object.keys(npsResultsByPlan).map((plan) => ({
    plano: plan,
    usuarios: npsResultsByPlan[plan].total,
    nps: npsResultsByPlan[plan].nps,
    color: planColors[plan].chart,
  }));

  const planNPSData = Object.keys(npsResultsByPlan).map((plan) => ({
    plano: plan,
    nps: npsResultsByPlan[plan].nps,
    fill: planColors[plan].chart,
  }));

  // Tooltip customizada para distribuição de notas
  const ScoreTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const { count, percentage } = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl shadow border text-gray-700 text-sm">
          <div className="font-semibold">Nota {label}</div>
          <div>
            {count} respostas ({percentage}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center py-12 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl text-white shadow-2xl">
          <div className="flex justify-center items-center gap-3 mb-4">
            <Target className="h-12 w-12" />
            <h1 className="text-5xl font-bold">Sistema NPS</h1>
          </div>
          <p className="text-xl opacity-90">Net Promoter Score - Análise Avançada de Satisfação</p>
          <div className="flex justify-center gap-6 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span>FREE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <span>LITE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
              <span>PRO</span>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold flex items-center gap-3 text-gray-800">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Upload className="text-blue-600 h-8 w-8" />
              </div>
              Upload do Arquivo CSV
            </h2>
            {csvData.length > 0 && (
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-lg hover:from-green-600 hover:to-green-700 transition-all"
              >
                <Download className="h-5 w-5" />
                Exportar CSV
              </button>
            )}
          </div>

          <div className="border-2 border-dashed border-blue-200 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-300 group">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => processCSV(e.target.files[0])}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <div className="p-4 bg-blue-100 rounded-full w-24 h-24 mx-auto mb-6 group-hover:bg-blue-200 transition-colors flex items-center justify-center">
                <FileText className="h-12 w-12 text-blue-600" />
              </div>
              <p className="text-2xl font-semibold text-gray-700 mb-2">Clique para selecionar o arquivo CSV</p>
              <p className="text-gray-500 text-lg">Formato: data, cliente, usuario, nota, comentario, plano</p>
            </label>
          </div>

          {isProcessing && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl shadow-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Processando arquivo...
              </div>
            </div>
          )}
        </div>

        {/* Insights Automáticos */}
        {insights.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Lightbulb className="text-yellow-600 h-6 w-6" />
              </div>
              Insights Automáticos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border-l-4 ${
                    insight.type === 'success'
                      ? 'bg-green-50 border-green-400'
                      : insight.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-400'
                      : 'bg-red-50 border-red-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{insight.icon}</span>
                    <p className="text-sm font-medium text-gray-800">{insight.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NPS Score Principal */}
        {npsResults && (
          <div className="flex justify-center mb-8">
            <div className={`${getNPSGradient(npsResults.nps)} rounded-full p-8 shadow-2xl transform hover:scale-105 transition-transform`}>
              <div className="bg-white rounded-full p-12 text-center min-w-[300px]">
                <div className="text-6xl font-black text-gray-800 mb-2">{npsResults.nps}</div>
                <div className="text-2xl font-semibold text-gray-600 mb-2">NPS Geral</div>
                <div className={`text-xl font-bold ${getNPSColor(npsResults.nps)}`}>{getNPSLabel(npsResults.nps)}</div>
                <div className="text-gray-500 mt-3 text-lg">{npsResults.total} avaliações</div>
                <div className="text-gray-600 text-sm mt-2">Média: {npsResults.averageScore}/10</div>
              </div>
            </div>
          </div>
        )}

        {/* Métricas por Plano + Média */}
        {npsResults && Object.keys(planPercentages).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Activity className="h-8 w-8" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{npsResults.averageScore}</div>
                  <div className="text-indigo-100">Média Geral</div>
                </div>
              </div>
              <div className="text-indigo-100 text-lg">Nota média das avaliações</div>
            </div>

            {Object.entries(planPercentages).map(([plan, data]) => (
              <div key={plan} className={`${planColors[plan].bg} rounded-2xl shadow-xl p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 ${planColors[plan].bg} rounded-xl`}>
                    <Users className={`h-8 w-8 ${planColors[plan].text}`} />
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${planColors[plan].text}`}>{data.percentage}%</div>
                    <div className={`${planColors[plan].text} opacity-80`}>Plano {plan}</div>
                  </div>
                </div>
                <div className={`${planColors[plan].text} opacity-80 text-lg`}>{data.count} usuários</div>
              </div>
            ))}
          </div>
        )}

        {/* Cards de Métricas Gerais */}
        {npsResults && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <TrendingUp className="h-8 w-8" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{npsResults.promoters}</div>
                  <div className="text-green-100">Promotores</div>
                </div>
              </div>
              <div className="text-green-100 text-lg">{npsResults.promoterPercentage}% do total</div>
              <div className="text-sm text-green-200 mt-2">Notas 9-10</div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Users className="h-8 w-8" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{npsResults.passives}</div>
                  <div className="text-yellow-100">Neutros</div>
                </div>
              </div>
              <div className="text-yellow-100 text-lg">{npsResults.passivePercentage}% do total</div>
              <div className="text-sm text-yellow-200 mt-2">Notas 7-8</div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{npsResults.detractors}</div>
                  <div className="text-red-100">Detratores</div>
                </div>
              </div>
              <div className="text-red-100 text-lg">{npsResults.detractorPercentage}% do total</div>
              <div className="text-sm text-red-200 mt-2">Notas 0-6</div>
            </div>
          </div>
        )}

        {/* Cards NPS por Plano */}
        {Object.keys(npsResultsByPlan).length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-3xl font-bold mb-6 flex items-center gap-3 text-gray-800">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Award className="text-purple-600 h-8 w-8" />
              </div>
              NPS por Plano
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.keys(npsResultsByPlan).map((plan) => {
                const data = npsResultsByPlan[plan];
                const colors = planColors[plan];
                return (
                  <div key={plan} className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-6 hover:scale-105 transition-transform shadow-lg`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`${colors.text} ${colors.bg} px-4 py-2 rounded-full text-sm font-bold border ${colors.border}`}>
                        {plan}
                      </span>
                      <div className="text-right">
                        <div className={`text-3xl font-black ${colors.text}`}>{data.nps}</div>
                        <div className="text-gray-600 text-sm">{data.total} usuários</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Média:</span>
                        <span className="font-semibold text-gray-700">{data.averageScore}/10</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Promotores:</span>
                        <span className="font-semibold text-green-600">{data.promoters}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Neutros:</span>
                        <span className="font-semibold text-yellow-600">{data.passives}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Detratores:</span>
                        <span className="font-semibold text-red-600">{data.detractors}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gráficos */}
        {npsResults && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Distribuição de Notas */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                <div className="p-3 bg-cyan-100 rounded-xl">
                  <BarChart3 className="text-cyan-600 h-6 w-6" />
                </div>
                Distribuição de Notas (0-10)
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={scoreDistributionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="score" />
                  <YAxis />
                  <Tooltip content={<ScoreTooltip />} />
                  <Bar dataKey="count" fill="#06B6D4" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pizza Geral */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                <div className="p-3 bg-green-100 rounded-xl">
                  <BarChart3 className="text-green-600 h-6 w-6" />
                </div>
                Distribuição Geral
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* NPS por Plano (Barras) */}
            {planNPSData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <BarChart3 className="text-blue-600 h-6 w-6" />
                  </div>
                  NPS por Plano
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={planNPSData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="plano" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="nps" radius={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Usuários por Plano (Pizza) */}
            {planDistributionData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Users className="text-purple-600 h-6 w-6" />
                  </div>
                  Usuários por Plano
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={planDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ plano, usuarios }) => `${plano}\n${usuarios} usuários`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="usuarios"
                    >
                      {planDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Evolução Temporal */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                  <div className="p-3 bg-pink-100 rounded-xl">
                    <TrendingUp className="text-pink-600 h-6 w-6" />
                  </div>
                  Evolução Temporal do NPS (mock)
                </h3>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-gray-700 bg-white"
                >
                  <option value="all">Todo o período</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={mockHistoryByPlan} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="FREE" stroke={planColors['FREE'].chart} strokeWidth={3} />
                  <Line type="monotone" dataKey="LITE" stroke={planColors['LITE'].chart} strokeWidth={3} />
                  <Line type="monotone" dataKey="PRO" stroke={planColors['PRO'].chart} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-2">*Dados de exemplo para visualização da tendência.</p>
            </div>
          </div>
        )}

        {/* Formato CSV Esperado */}
        {csvData.length === 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-xl p-8 border-2 border-amber-200">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-amber-800">
              <div className="p-3 bg-amber-200 rounded-xl">
                <AlertCircle className="text-amber-700 h-6 w-6" />
              </div>
              Formato CSV Esperado
            </h3>

            <div className="bg-white/70 rounded-xl p-6 border border-amber-300 mb-4">
              <div className="font-mono text-lg text-gray-800 text-center">
                <div className="font-semibold text-amber-800 text-xl mb-2">Cabeçalho do arquivo:</div>
                <div className="bg-amber-100 p-4 rounded-lg border border-amber-300">data,cliente,usuario,nota,comentario,plano</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-amber-100 rounded-lg border border-amber-300">
                <p className="text-amber-800 font-medium mb-2">
                  <strong>Campos obrigatórios:</strong>
                </p>
                <ul className="text-amber-700 text-sm space-y-1">
                  <li>• <strong>data:</strong> Data da avaliação</li>
                  <li>• <strong>cliente:</strong> ID do cliente</li>
                  <li>• <strong>usuario:</strong> Nome/ID do usuário</li>
                  <li>• <strong>nota:</strong> Nota de 0 a 10</li>
                  <li>• <strong>plano:</strong> FREE, LITE ou PRO</li>
                </ul>
              </div>

              <div className="p-4 bg-amber-100 rounded-lg border border-amber-300">
                <p className="text-amber-800 font-medium mb-2">
                  <strong>Campo opcional:</strong>
                </p>
                <ul className="text-amber-700 text-sm space-y-1">
                  <li>• <strong>comentario:</strong> Feedback do usuário</li>
                </ul>
                <p className="text-amber-700 text-sm mt-2">
                  <strong>Dica:</strong> Notas entre 0-10 e planos em maiúsculas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Dados */}
        {csvData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <FileText className="text-indigo-600 h-6 w-6" />
              </div>
              Dados Processados ({csvData.length} registros)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Usuário</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Nota</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Plano</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Categoria</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvData.slice(0, 15).map((row, index) => {
                    const nota = Number(row.nota);
                    const categoria = nota >= 9 ? 'Promotor' : nota >= 7 ? 'Neutro' : 'Detrator';
                    const corCategoria =
                      nota >= 9 ? 'text-green-600 bg-green-50' : nota >= 7 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
                    const plano = row.plano?.toUpperCase() || 'N/A';
                    const planColor = planColors[plano] || planColors.FREE;

                    return (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.data?.split(' ')[0] || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.cliente}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.usuario}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-bold text-gray-900">{row.nota}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`${planColor.bg} ${planColor.text} px-3 py-1 rounded-full text-xs font-bold border ${planColor.border}`}>
                            {plano}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${corCategoria}`}>{categoria}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {csvData.length > 15 && (
                <p className="text-gray-500 text-sm mt-4 text-center bg-gray-50 py-3 rounded-lg">
                  Mostrando 15 de {csvData.length} registros
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-gray-600">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="h-5 w-5" />
            <span className="font-medium">Sistema NPS Avançado</span>
          </div>
          <p className="text-sm">Análise completa de Net Promoter Score com insights automáticos e visualizações interativas</p>
        </div>
      </div>
    </div>
  );
};

export default NPSSystem;
