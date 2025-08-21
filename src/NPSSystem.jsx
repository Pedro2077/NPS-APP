import React, { useState } from 'react';
import { Upload, FileText, BarChart3, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const NPSSystem = () => {
  const [csvData, setCsvData] = useState([]);
  const [npsResults, setNpsResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);

  // Simulação de dados de histórico
  const mockHistory = [
    { date: '2025-01-15', nps: 42, total: 150 },
    { date: '2025-01-08', nps: 38, total: 120 },
    { date: '2025-01-01', nps: 45, total: 200 },
  ];

  const processCSV = (file) => {
    if (!file) return;
    
    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index]?.trim();
        });
        return obj;
      }).filter(row => row.nota && !isNaN(Number(row.nota)));

      setCsvData(data);
      calculateNPS(data);
      setIsProcessing(false);
    };
    
    reader.readAsText(file);
  };

  const calculateNPS = (data) => {
    const scores = data.map(row => Number(row.nota)).filter(score => score >= 0 && score <= 10);
    const total = scores.length;
    
    const promoters = scores.filter(score => score >= 9).length;
    const passives = scores.filter(score => score >= 7 && score <= 8).length;
    const detractors = scores.filter(score => score <= 6).length;
    
    const promoterPercentage = (promoters / total) * 100;
    const detractorPercentage = (detractors / total) * 100;
    const nps = Math.round(promoterPercentage - detractorPercentage);
    
    const results = {
      nps,
      total,
      promoters,
      passives,
      detractors,
      promoterPercentage: Math.round(promoterPercentage),
      passivePercentage: Math.round((passives / total) * 100),
      detractorPercentage: Math.round(detractorPercentage)
    };
    
    setNpsResults(results);
    
    // Adicionar ao histórico
    setUploadHistory(prev => [{
      date: new Date().toISOString().split('T')[0],
      nps,
      total,
      id: Date.now()
    }, ...prev]);
  };

  const getNPSColor = (nps) => {
    if (nps >= 70) return 'text-green-600';
    if (nps >= 50) return 'text-yellow-600';
    if (nps >= 0) return 'text-orange-600';
    return 'text-red-600';
  };

  const getNPSLabel = (nps) => {
    if (nps >= 70) return 'Excelente';
    if (nps >= 50) return 'Muito Bom';
    if (nps >= 0) return 'Razoável';
    return 'Crítico';
  };

  const pieData = npsResults ? [
    { name: 'Promotores', value: npsResults.promoters, color: '#10B981' },
    { name: 'Neutros', value: npsResults.passives, color: '#F59E0B' },
    { name: 'Detratores', value: npsResults.detractors, color: '#EF4444' }
  ] : [];

  const COLORS = ['#10B981', '#F59E0B', '#EF4444'];

  const historyData = [...mockHistory, ...uploadHistory].slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Sistema NPS</h1>
          <p className="text-gray-600">Net Promoter Score - Análise de Satisfação do Cliente</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Upload className="text-blue-600" />
            Upload do Arquivo CSV
          </h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => processCSV(e.target.files[0])}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700">
                Clique para selecionar o arquivo CSV
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Formato esperado: cliente, nota (0-10)
              </p>
            </label>
          </div>
          
          {isProcessing && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Processando arquivo...
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {npsResults && (
          <>
            {/* NPS Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">NPS Score</h3>
                <div className={`text-4xl font-bold ${getNPSColor(npsResults.nps)}`}>
                  {npsResults.nps}
                </div>
                <div className={`text-sm font-medium ${getNPSColor(npsResults.nps)}`}>
                  {getNPSLabel(npsResults.nps)}
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Respostas</h3>
                <div className="text-3xl font-bold text-blue-600">{npsResults.total}</div>
                <div className="flex items-center justify-center text-sm text-gray-500 mt-1">
                  <Users className="h-4 w-4 mr-1" />
                  Clientes avaliados
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Promotores</h3>
                <div className="text-3xl font-bold text-green-600">{npsResults.promoters}</div>
                <div className="text-sm text-gray-500">{npsResults.promoterPercentage}% do total</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Detratores</h3>
                <div className="text-3xl font-bold text-red-600">{npsResults.detractors}</div>
                <div className="text-sm text-gray-500">{npsResults.detractorPercentage}% do total</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Pie Chart */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="text-blue-600" />
                  Distribuição por Categoria
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="text-blue-600" />
                  Quantidade por Categoria
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pieData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* Historical Data */}
        {historyData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="text-blue-600" />
              Histórico de Análises
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="nps" stroke="#3B82F6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sample Data Section */}
        {csvData.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="text-yellow-600" />
              Formato CSV Esperado
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
              <div className="text-gray-700">
                cliente,nota<br/>
                João Silva,10<br/>
                Maria Santos,8<br/>
                Pedro Costa,6<br/>
                Ana Oliveira,9<br/>
                Carlos Lima,7
              </div>
            </div>
            <p className="text-gray-600 mt-4">
              O arquivo deve conter duas colunas: 'cliente' (nome do cliente) e 'nota' (valor de 0 a 10).
            </p>
          </div>
        )}

        {/* Data Table */}
        {csvData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Dados Processados ({csvData.length} registros)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nota
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvData.slice(0, 10).map((row, index) => {
                    const nota = Number(row.nota);
                    const categoria = nota >= 9 ? 'Promotor' : nota >= 7 ? 'Neutro' : 'Detrator';
                    const corCategoria = nota >= 9 ? 'text-green-600' : nota >= 7 ? 'text-yellow-600' : 'text-red-600';
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.cliente}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.nota}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${corCategoria}`}>
                          {categoria}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {csvData.length > 10 && (
                <p className="text-gray-500 text-sm mt-2 text-center">
                  Mostrando 10 de {csvData.length} registros
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NPSSystem;