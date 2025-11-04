import React, { useState, useEffect, useMemo } from 'react';
import { 
  Upload, FileText, BarChart3, TrendingUp, Users, AlertCircle, 
  Award, Target, Download, Lightbulb, Activity, CheckCircle2,
  RefreshCw, Eye, EyeOff, Filter, ArrowUp, Loader, Calendar
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';

const NPSSystem = () => {
  const [csvData, setCsvData] = useState([]);
  const [npsResults, setNpsResults] = useState(null);
  const [npsResultsByPlan, setNpsResultsByPlan] = useState({});
  const [scoreDistributionData, setScoreDistributionData] = useState([]);
  const [planPercentages, setPlanPercentages] = useState({});
  const [insights, setInsights] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [showDataTable, setShowDataTable] = useState(false);
  const [filterPlan, setFilterPlan] = useState('all');
  const [error, setError] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [apiUrl] = useState('http://localhost:5000/api');
  const [npsHistoryData, setNpsHistoryData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [uniqueDatesCount, setUniqueDatesCount] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.pageYOffset > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Carregar histórico quando houver dados ou mudar período
  useEffect(() => {
    if (npsResults) {
      loadNPSHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cores por plano
  const planColors = {
    FREE: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', chart: '#6B7280' },
    LITE: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', chart: '#3B82F6' },
    PRO: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', chart: '#8B5CF6' },
  };

  // Função para carregar histórico do backend
  const loadNPSHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${apiUrl}/nps-history?period=${selectedPeriod}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      console.log('📊 Resposta do histórico:', result);

      if (result.success && result.data && result.data.length > 0) {
        // Formatar datas para exibição (DD/MM/YYYY)
        const formattedData = result.data.map(entry => ({
          ...entry,
          displayDate: formatDateForDisplay(entry.date)
        }));
        
        setNpsHistoryData(formattedData);
        console.log(`✅ Histórico carregado: ${result.data.length} registros`, formattedData);
      } else {
        setNpsHistoryData([]);
        console.log('⚠️ Nenhum histórico disponível no backend');
      }
    } catch (err) {
      console.error('❌ Erro ao carregar histórico:', err);
      setNpsHistoryData([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Função para formatar data para exibição
  const formatDateForDisplay = (dateString) => {
    try {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  // Reset function
  const resetData = () => {
    setCsvData([]);
    setNpsResults(null);
    setNpsResultsByPlan({});
    setScoreDistributionData([]);
    setPlanPercentages({});
    setInsights([]);
    setError(null);
    setShowDataTable(false);
    setFilterPlan('all');
    setNpsHistoryData([]);
    setUniqueDatesCount(0);
  };

  // Upload & Process CSV via API
  const processCSV = async (file) => {
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Por favor, selecione apenas arquivos CSV.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande. Limite máximo: 5MB.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch(`${apiUrl}/upload-csv`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro no processamento do arquivo');
      }

      const { data } = result;
      setCsvData(data.csvData);
      setNpsResults(data.npsResults);
      setNpsResultsByPlan(data.npsResultsByPlan);
      setScoreDistributionData(data.scoreDistributionData);
      setPlanPercentages(data.planPercentages);
      setInsights(data.insights);
      setShowDataTable(true);
      setUniqueDatesCount(data.uniqueDates || 0);
      
      setUploadHistory(prev => [{
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('pt-BR'),
        fileName: file.name,
        totalRecords: data.totalRecords,
        uniqueDates: data.uniqueDates || 0,
        id: Date.now(),
      }, ...prev.slice(0, 4)]);

      // Carregar histórico após upload bem-sucedido
      console.log('🔄 Carregando histórico após upload...');
      setTimeout(() => {
        loadNPSHistory();
      }, 1000);

    } catch (err) {
      console.error('Erro na API:', err);
      setError(err.message || 'Erro de conexão com o servidor');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportData = () => {
    if (!csvData.length) return;

    const headers = ['data', 'cliente', 'usuario', 'nota', 'comentario', 'plano', 'categoria', 'segmento_nps'];
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => {
        const nota = Number(row.nota);
        const categoria = nota >= 9 ? 'Promotor' : nota >= 7 ? 'Neutro' : 'Detrator';
        const segmento = nota >= 9 ? 'Promotores (9-10)' : nota >= 7 ? 'Neutros (7-8)' : 'Detratores (0-6)';
        return [
          row.data || '',
          row.cliente || '',
          row.usuario || '',
          row.nota || '',
          `"${row.comentario || ''}"`, 
          row.plano || '',
          categoria,
          segmento
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `nps_analise_completa_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helpers de UI
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

  // Dados para gráficos
  const pieData = npsResults ? [
    { name: 'Promotores', value: npsResults.promoters, color: '#10B981' },
    { name: 'Neutros', value: npsResults.passives, color: '#F59E0B' },
    { name: 'Detratores', value: npsResults.detractors, color: '#EF4444' },
  ] : [];

  const planDistributionData = Object.keys(npsResultsByPlan).map(plan => ({
    plano: plan,
    usuarios: npsResultsByPlan[plan].total,
    nps: npsResultsByPlan[plan].nps,
    color: planColors[plan].chart,
  }));

  const planNPSData = Object.keys(npsResultsByPlan).map(plan => ({
    plano: plan,
    nps: npsResultsByPlan[plan].nps,
    fill: planColors[plan].chart,
  }));

  const ScoreTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-200 text-gray-700">
          <div className="font-bold text-lg mb-2">Nota {label}</div>
          <div className="space-y-1">
            <div>{data.count} respostas ({data.percentage}%)</div>
            <div className="text-sm text-gray-500">Categoria: {data.category}</div>
          </div>
        </div>
      );
    }
    return null;
  };

  const HistoryTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Encontrar dados completos para esta data
      const dataEntry = npsHistoryData.find(entry => entry.displayDate === label);
      
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-200 text-gray-700">
          <div className="font-bold text-lg mb-3">{label}</div>
          {dataEntry && (
            <div className="text-sm text-gray-600 mb-2">
              {dataEntry.totalRecords} registro(s)
            </div>
          )}
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div key={index} style={{ color: entry.color }} className="font-semibold">
                {entry.name}: {entry.value}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Filtrar dados da tabela
  const filteredTableData = useMemo(() => {
    if (filterPlan === 'all') return csvData;
    return csvData.filter(row => row.plano?.toUpperCase() === filterPlan);
  }, [csvData, filterPlan]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center py-16 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-3xl text-white shadow-2xl">
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Target className="h-16 w-16" />
            </div>
            <h1 className="text-6xl font-black">Sistema NPS</h1>
          </div>
          <p className="text-2xl opacity-90 mb-8">Net Promoter Score - Análise Avançada de Satisfação</p>
          
          <div className="flex justify-center gap-8 text-lg font-semibold">
            <div className="flex items-center gap-3 bg-white/20 px-6 py-3 rounded-full backdrop-blur-sm">
              <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
              <span>FREE</span>
            </div>
            <div className="flex items-center gap-3 bg-white/20 px-6 py-3 rounded-full backdrop-blur-sm">
              <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
              <span>LITE</span>
            </div>
            <div className="flex items-center gap-3 bg-white/20 px-6 py-3 rounded-full backdrop-blur-sm">
              <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
              <span>PRO</span>
            </div>
          </div>

          {csvData.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-6">
              <div className="bg-white/25 backdrop-blur-sm px-6 py-3 rounded-xl">
                <CheckCircle2 className="h-6 w-6 inline mr-3" />
                <span className="text-xl font-semibold">{csvData.length} registros</span>
              </div>
              {uniqueDatesCount > 0 && (
                <div className="bg-white/25 backdrop-blur-sm px-6 py-3 rounded-xl">
                  <Calendar className="h-6 w-6 inline mr-3" />
                  <span className="text-xl font-semibold">{uniqueDatesCount} data(s) única(s)</span>
                </div>
              )}
              <div className="bg-white/25 backdrop-blur-sm px-6 py-3 rounded-xl">
                <Activity className="h-6 w-6 inline mr-3" />
                <span className="text-xl font-semibold">NPS: {npsResults?.nps || 0}</span>
              </div>
              <div className="bg-white/25 backdrop-blur-sm px-6 py-3 rounded-xl">
                <span className="text-xl font-semibold">Média: {npsResults?.averageScore || 0}/10</span>
              </div>
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-100">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 mb-8">
            <h2 className="text-4xl font-bold flex items-center gap-4 text-gray-800">
              <div className="p-4 bg-blue-100 rounded-2xl">
                <Upload className="text-blue-600 h-10 w-10" />
              </div>
              Upload do Arquivo CSV
            </h2>
            
            <div className="flex flex-wrap gap-3">
              {csvData.length > 0 && (
                <>
                  <button
                    onClick={resetData}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl shadow-lg hover:from-gray-600 hover:to-gray-700 transition-all hover:scale-105"
                  >
                    <RefreshCw className="h-5 w-5" />
                    Resetar
                  </button>
                  <button
                    onClick={exportData}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-lg hover:from-green-600 hover:to-green-700 transition-all hover:scale-105"
                  >
                    <Download className="h-5 w-5" />
                    Exportar Análise
                  </button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-500 mt-1 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-800 text-lg">Erro no processamento:</p>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="border-3 border-dashed border-blue-300 rounded-2xl p-16 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-300 group cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => processCSV(e.target.files[0])}
              className="hidden"
              id="csv-upload"
              disabled={isProcessing}
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <div className="p-6 bg-blue-100 rounded-full w-32 h-32 mx-auto mb-8 group-hover:bg-blue-200 transition-colors flex items-center justify-center">
                {isProcessing ? (
                  <Loader className="h-16 w-16 text-blue-600 animate-spin" />
                ) : (
                  <FileText className="h-16 w-16 text-blue-600" />
                )}
              </div>
              <p className="text-3xl font-bold text-gray-700 mb-4">
                {isProcessing ? 'Enviando e processando arquivo...' : 'Clique para selecionar o arquivo CSV'}
              </p>
              <p className="text-gray-500 text-xl">
                Formato obrigatório: nota, plano | Opcional: data, cliente, usuario, comentario
              </p>
              <div className="mt-4 text-lg text-gray-600 bg-gray-50 inline-block px-6 py-2 rounded-lg">
                Limite: 5MB | Formatos aceitos: .csv
              </div>
            </label>
          </div>
        </div>

        {/* Upload History */}
        {uploadHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="text-green-600 h-6 w-6" />
              </div>
              Histórico de Uploads
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {uploadHistory.map((upload) => (
                <div key={upload.id} className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border-2 border-gray-200 hover:scale-105 transition-transform">
                  <div className="text-sm text-gray-600 mb-2">{upload.date}</div>
                  <div className="text-xs text-gray-500 mb-3">{upload.time}</div>
                  <div className="font-bold text-2xl text-gray-800">{upload.totalRecords}</div>
                  <div className="text-sm text-gray-600">registros</div>
                  {upload.uniqueDates > 0 && (
                    <div className="text-xs text-blue-600 mt-2 font-semibold">
                      {upload.uniqueDates} data(s) única(s)
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2 truncate" title={upload.fileName}>
                    {upload.fileName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights Automáticos */}
        {insights.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-3xl font-bold mb-8 flex items-center gap-4 text-gray-800">
              <div className="p-4 bg-yellow-100 rounded-2xl">
                <Lightbulb className="text-yellow-600 h-8 w-8" />
              </div>
              Insights Automáticos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-6 rounded-2xl border-l-6 hover:scale-105 transition-transform ${
                    insight.type === 'success' 
                      ? 'bg-green-50 border-green-400'
                      : insight.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-400'
                      : 'bg-red-50 border-red-400'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{insight.icon}</span>
                    <p className="text-gray-800 font-semibold text-lg">{insight.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NPS Score Principal */}
        {npsResults && (
          <div className="flex justify-center mb-12">
            <div className={`${getNPSGradient(npsResults.nps)} rounded-full p-12 shadow-2xl transform hover:scale-105 transition-transform`}>
              <div className="bg-white rounded-full p-16 text-center min-w-[400px]">
                <div className="text-8xl font-black text-gray-800 mb-4">{npsResults.nps}</div>
                <div className="text-3xl font-bold text-gray-600 mb-4">NPS Geral</div>
                <div className={`text-2xl font-bold mb-4 ${getNPSColor(npsResults.nps)}`}>
                  {getNPSLabel(npsResults.nps)}
                </div>
                <div className="text-gray-500 text-xl mb-2">{npsResults.total} avaliações</div>
                <div className="text-gray-600 text-lg">Média: {npsResults.averageScore}/10</div>
                <div className="text-gray-600 text-lg">Mediana: {npsResults.median}</div>
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
              <div className="text-indigo-200 text-sm mt-2">Mediana: {npsResults.median}</div>
            </div>

            {Object.entries(planPercentages).map(([plan, data]) => (
              <div key={plan} className={`${planColors[plan].bg} rounded-2xl shadow-xl p-6 hover:scale-105 transition-transform`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 ${planColors[plan].bg} rounded-xl border-2 ${planColors[plan].border}`}>
                    <Users className={`h-8 w-8 ${planColors[plan].text}`} />
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${planColors[plan].text}`}>
                      {data.percentage}%
                    </div>
                    <div className={`${planColors[plan].text} opacity-80`}>Plano {plan}</div>
                  </div>
                </div>
                <div className={`${planColors[plan].text} opacity-80 text-lg font-semibold`}>
                  {data.count} usuários
                </div>
                {npsResultsByPlan[plan] && (
                  <div className={`${planColors[plan].text} opacity-70 text-sm mt-2`}>
                    NPS: {npsResultsByPlan[plan].nps}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Cards de Métricas Gerais */}
        {npsResults && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-8 text-white hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-white/20 rounded-xl">
                  <TrendingUp className="h-10 w-10" />
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">{npsResults.promoters}</div>
                  <div className="text-green-100 text-xl">Promotores</div>
                </div>
              </div>
              <div className="text-green-100 text-xl font-semibold">{npsResults.promoterPercentage}% do total</div>
              <div className="text-sm text-green-200 mt-2">Notas 9-10 • Recomendam ativamente</div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl shadow-xl p-8 text-white hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-white/20 rounded-xl">
                  <Users className="h-10 w-10" />
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">{npsResults.passives}</div>
                  <div className="text-yellow-100 text-xl">Neutros</div>
                </div>
              </div>
              <div className="text-yellow-100 text-xl font-semibold">{npsResults.passivePercentage}% do total</div>
              <div className="text-sm text-yellow-200 mt-2">Notas 7-8 • Satisfeitos mas passivos</div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-xl p-8 text-white hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-white/20 rounded-xl">
                  <AlertCircle className="h-10 w-10" />
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">{npsResults.detractors}</div>
                  <div className="text-red-100 text-xl">Detratores</div>
                </div>
              </div>
              <div className="text-red-100 text-xl font-semibold">{npsResults.detractorPercentage}% do total</div>
              <div className="text-sm text-red-200 mt-2">Notas 0-6 • Podem prejudicar a marca</div>
            </div>
          </div>
        )}

        {/* Cards NPS por Plano */}
        {Object.keys(npsResultsByPlan).length > 0 && (
          <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-100">
            <h3 className="text-4xl font-bold mb-8 flex items-center gap-4 text-gray-800">
              <div className="p-4 bg-purple-100 rounded-2xl">
                <Award className="text-purple-600 h-10 w-10" />
              </div>
              Análise Detalhada por Plano
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Object.keys(npsResultsByPlan).map((plan) => {
                const data = npsResultsByPlan[plan];
                const colors = planColors[plan];
                return (
                  <div
                    key={plan}
                    className={`${colors.bg} ${colors.border} border-3 rounded-3xl p-8 hover:scale-105 transition-all shadow-xl hover:shadow-2xl`}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <span className={`${colors.bg} ${colors.text} px-6 py-3 rounded-full text-lg font-bold border-2 ${colors.border}`}>
                        PLANO {plan}
                      </span>
                      <div className="text-right">
                        <div className={`text-4xl font-black ${colors.text}`}>{data.nps}</div>
                        <div className="text-gray-600 font-semibold">{data.total} usuários</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-lg">
                        <span className="font-semibold">Média:</span>
                        <span className="font-bold text-gray-700">{data.averageScore}/10</span>
                      </div>
                      <div className="bg-white/50 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between">
                          <span className="text-green-700 font-semibold">Promotores:</span>
                          <div className="text-right">
                            <span className="font-bold text-green-600">{data.promoters}</span>
                            <span className="text-green-600 text-sm ml-2">({data.promoterPercentage}%)</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-yellow-700 font-semibold">Neutros:</span>
                          <div className="text-right">
                            <span className="font-bold text-yellow-600">{data.passives}</span>
                            <span className="text-yellow-600 text-sm ml-2">({data.passivePercentage}%)</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-700 font-semibold">Detratores:</span>
                          <div className="text-right">
                            <span className="font-bold text-red-600">{data.detractors}</span>
                            <span className="text-red-600 text-sm ml-2">({data.detractorPercentage}%)</span>
                          </div>
                        </div>
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
                  <Bar dataKey="count" fill="#06B6D4" radius={6} />
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
                  Comparativo NPS por Plano
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
                  Distribuição de Usuários
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

            {/* Evolução Temporal - COM DATAS DO CSV */}
            {npsHistoryData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 lg:col-span-2">
                <div className="flex flex-col gap-4 mb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                      <div className="p-3 bg-pink-100 rounded-xl">
                        <TrendingUp className="text-pink-600 h-6 w-6" />
                      </div>
                      Evolução Temporal do NPS (Por Data do CSV)
                      {isLoadingHistory && (
                        <Loader className="h-5 w-5 text-blue-500 animate-spin ml-2" />
                      )}
                    </h3>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="px-4 py-2 border-2 rounded-xl text-gray-700 bg-white font-semibold hover:border-blue-400 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">Todo o período</option>
                      <option value="7d">Últimos 7 dias</option>
                      <option value="30d">Últimos 30 dias</option>
                      <option value="90d">Últimos 90 dias</option>
                    </select>
                  </div>
                  
                  {npsHistoryData.length > 20 && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                      <p className="text-blue-800 font-semibold">
                        💡 <strong>Dica:</strong> Com {npsHistoryData.length} pontos de dados, use os filtros de período acima para melhor visualização (7, 30 ou 90 dias).
                      </p>
                    </div>
                  )}
                </div>
                
                <ResponsiveContainer width="100%" height={450}>
                  <LineChart data={npsHistoryData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="displayDate" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={Math.max(0, Math.floor(npsHistoryData.length / 15))}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis 
                      domain={[-100, 100]}
                      ticks={[-100, -50, 0, 50, 100]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<HistoryTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="FREE" 
                      stroke={planColors['FREE'].chart} 
                      strokeWidth={3} 
                      name="FREE"
                      dot={npsHistoryData.length <= 30 ? { r: 4 } : false}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="LITE" 
                      stroke={planColors['LITE'].chart} 
                      strokeWidth={3}
                      name="LITE"
                      dot={npsHistoryData.length <= 30 ? { r: 4 } : false}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="PRO" 
                      stroke={planColors['PRO'].chart} 
                      strokeWidth={3}
                      name="PRO"
                      dot={npsHistoryData.length <= 30 ? { r: 4 } : false}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
                
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg border border-green-200">
                      <strong>✅ Usando datas do CSV:</strong> {npsHistoryData.length} ponto(s) de dados baseados nas datas reais das avaliações.
                    </p>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: planColors['FREE'].chart }}></div>
                        <span className="text-sm font-semibold">FREE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: planColors['LITE'].chart }}></div>
                        <span className="text-sm font-semibold">LITE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: planColors['PRO'].chart }}></div>
                        <span className="text-sm font-semibold">PRO</span>
                      </div>
                    </div>
                  </div>
                  
                  {npsHistoryData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">Primeira Data</p>
                        <p className="text-lg font-bold text-gray-800">{npsHistoryData[0].displayDate}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">Última Data</p>
                        <p className="text-lg font-bold text-gray-800">{npsHistoryData[npsHistoryData.length - 1].displayDate}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">Período Total</p>
                        <p className="text-lg font-bold text-gray-800">
                          {Math.ceil((new Date(npsHistoryData[npsHistoryData.length - 1].date) - new Date(npsHistoryData[0].date)) / (1000 * 60 * 60 * 24))} dias
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mensagem quando não há histórico */}
            {npsResults && npsHistoryData.length === 0 && !isLoadingHistory && (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                    <div className="p-3 bg-pink-100 rounded-xl">
                      <TrendingUp className="text-pink-600 h-6 w-6" />
                    </div>
                    Evolução Temporal do NPS
                  </h3>
                </div>
                <div className="text-center py-16">
                  <div className="p-6 bg-blue-50 rounded-full w-32 h-32 mx-auto mb-6 flex items-center justify-center">
                    <TrendingUp className="h-16 w-16 text-blue-400" />
                  </div>
                  <p className="text-xl text-gray-600 mb-2">Nenhum histórico disponível ainda</p>
                  <p className="text-gray-500">Faça uploads com campo "data" preenchido para visualizar a evolução temporal</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Formato CSV Esperado */}
        {csvData.length === 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-2xl p-10 border-3 border-amber-200">
            <h3 className="text-4xl font-bold mb-8 flex items-center gap-4 text-amber-800">
              <div className="p-4 bg-amber-200 rounded-2xl">
                <AlertCircle className="text-amber-700 h-10 w-10" />
              </div>
              Formato CSV Esperado
            </h3>
            <div className="bg-white/80 rounded-2xl p-8 border-2 border-amber-300 mb-6">
              <div className="font-mono text-xl text-gray-800 text-center">
                <div className="font-bold text-amber-800 text-2xl mb-4">Cabeçalho obrigatório:</div>
                <div className="bg-amber-100 p-6 rounded-xl border-2 border-amber-300 text-2xl">
                  nota,plano
                </div>
                <div className="font-bold text-amber-800 text-xl mt-6 mb-4">Cabeçalho completo (recomendado):</div>
                <div className="bg-amber-100 p-6 rounded-xl border-2 border-amber-300 text-lg">
                  data,cliente,usuario,nota,comentario,plano
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-amber-100 rounded-2xl border-2 border-amber-300">
                <p className="text-amber-800 font-bold mb-4 text-xl">
                  Campos obrigatórios:
                </p>
                <ul className="text-amber-700 space-y-2 text-lg">
                  <li>• <strong>nota:</strong> Valor de 0 a 10</li>
                  <li>• <strong>plano:</strong> FREE, LITE ou PRO</li>
                </ul>
              </div>
              <div className="p-6 bg-amber-100 rounded-2xl border-2 border-amber-300">
                <p className="text-amber-800 font-bold mb-4 text-xl">
                  Campos opcionais:
                </p>
                <ul className="text-amber-700 space-y-2 text-lg">
                  <li>• <strong>data:</strong> Data da avaliação (DD-MM-YYYY ou YYYY-MM-DD)</li>
                  <li>• <strong>cliente:</strong> ID do cliente</li>
                  <li>• <strong>usuario:</strong> Nome do usuário</li>
                  <li>• <strong>comentario:</strong> Feedback textual</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 p-6 bg-amber-200 rounded-2xl border-2 border-amber-400">
              <p className="text-amber-900 font-bold text-xl mb-2">Dicas importantes:</p>
              <ul className="text-amber-800 space-y-2">
                <li>• Notas devem estar entre 0 e 10 (números inteiros ou decimais)</li>
                <li>• Planos devem ser exatamente: FREE, LITE ou PRO (maiúsculas)</li>
                <li>• <strong>Campo "data":</strong> Use formato DD-MM-YYYY ou YYYY-MM-DD para melhor compatibilidade</li>
                <li>• <strong>Histórico temporal:</strong> Com o campo "data" preenchido, você pode ter múltiplos pontos no gráfico mesmo fazendo um único upload</li>
                <li>• Tamanho máximo do arquivo: 5MB</li>
                <li>• Codificação recomendada: UTF-8</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tabela de Dados */}
        {csvData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                <div className="p-3 bg-indigo-100 rounded-xl">
                  <FileText className="text-indigo-600 h-6 w-6" />
                </div>
                Dados Processados ({filteredTableData.length} registros)
                <button
                  onClick={() => setShowDataTable(!showDataTable)}
                  className="ml-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title={showDataTable ? 'Ocultar tabela' : 'Mostrar tabela'}
                >
                  {showDataTable ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </h3>
              
              <div className="flex items-center gap-3">
                <Filter className="h-5 w-5 text-gray-500" />
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="px-4 py-2 border-2 rounded-xl text-gray-700 bg-white font-semibold hover:border-blue-400 focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Todos os planos ({csvData.length})</option>
                  <option value="FREE">FREE ({csvData.filter(r => r.plano?.toUpperCase() === 'FREE').length})</option>
                  <option value="LITE">LITE ({csvData.filter(r => r.plano?.toUpperCase() === 'LITE').length})</option>
                  <option value="PRO">PRO ({csvData.filter(r => r.plano?.toUpperCase() === 'PRO').length})</option>
                </select>
              </div>
            </div>

            {showDataTable && (
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
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Comentário</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTableData.slice(0, 20).map((row, index) => {
                      const nota = Number(row.nota);
                      const categoria = nota >= 9 ? 'Promotor' : nota >= 7 ? 'Neutro' : 'Detrator';
                      const corCategoria = nota >= 9 ? 'text-green-600 bg-green-50 border-green-200' : nota >= 7 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200';
                      const plano = row.plano?.toUpperCase() || 'N/A';
                      const planColor = planColors[plano] || planColors.FREE;

                      return (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {row.data ? formatDateForDisplay(row.data) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {row.cliente || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {row.usuario || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-xl font-bold text-gray-900">{row.nota}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`${planColor.bg} ${planColor.text} px-3 py-1 rounded-full text-sm font-bold border-2 ${planColor.border}`}>
                              {plano}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${corCategoria}`}>
                              {categoria}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                            <div className="truncate" title={row.comentario}>
                              {row.comentario || 'Sem comentário'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredTableData.length > 20 && (
                  <div className="text-gray-500 text-center bg-gray-50 py-4 rounded-lg mt-4">
                    <p className="font-semibold">Mostrando 20 de {filteredTableData.length} registros</p>
                    <p className="text-sm">Use o filtro por plano para refinar os resultados</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Botão Scroll to Top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 z-50"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="h-6 w-6" />
          </button>
        )}

        {/* Footer */}
        <div className="text-center py-10 text-gray-600 bg-white rounded-3xl shadow-2xl border border-gray-100">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
            <span className="font-bold text-2xl text-gray-800">Sistema NPS Avançado</span>
          </div>
          <p className="text-lg mb-4">Análise completa de Net Promoter Score com insights automáticos e visualizações interativas</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500 max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Processamento via API</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Visualizações interativas</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Lightbulb className="h-4 w-4" />
              <span>Insights automáticos</span>
            </div>
          </div>
          <div className="mt-6 text-xs text-gray-400">
            Desenvolvido com React + Node.js + Express | Frontend/Backend integrado | v3.0 - Histórico com Datas do CSV
          </div>
        </div>
      </div>
    </div>
  );
};

export default NPSSystem;