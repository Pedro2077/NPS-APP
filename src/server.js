const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://seu-dominio.com']
    : ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Servir arquivos estáticos em produção
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
}

// Armazenamento em memória para histórico de uploads
let npsHistory = [];

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['text/csv', 'application/csv', 'text/plain'];
    const isCSV = allowedMimeTypes.includes(file.mimetype) || 
                  file.originalname.toLowerCase().endsWith('.csv');
    
    if (isCSV) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Função auxiliar para parsear data
function parseDate(dateString) {
  if (!dateString) return null;
  
  // Remove espaços e normaliza separadores
  const normalized = dateString.trim().replace(/[\/\-]/g, '-');
  
  // Tenta vários formatos comuns
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /^(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
    /^(\d{2})-(\d{2})-(\d{2})/, // DD-MM-YY
  ];
  
  for (const format of formats) {
    const match = normalized.match(format);
    if (match) {
      if (match[1].length === 4) {
        // YYYY-MM-DD
        const date = new Date(match[1], match[2] - 1, match[3]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } else {
        // DD-MM-YYYY ou DD-MM-YY
        let year = match[3];
        if (year.length === 2) {
          year = (parseInt(year) > 50 ? '19' : '20') + year;
        }
        const date = new Date(year, match[2] - 1, match[1]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
  }
  
  // Se falhar, usa data atual
  return new Date().toISOString().split('T')[0];
}

// Função para calcular NPS geral
function calculateNPS(data) {
  const scores = data.map(row => Number(row.nota)).filter(score => !isNaN(score) && score >= 0 && score <= 10);
  const total = scores.length;
  
  if (total === 0) {
    return {
      nps: 0,
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      promoterPercentage: 0,
      passivePercentage: 0,
      detractorPercentage: 0,
      averageScore: '0.0',
      median: '0.0'
    };
  }

  const promoters = scores.filter(score => score >= 9).length;
  const passives = scores.filter(score => score >= 7 && score <= 8).length;
  const detractors = scores.filter(score => score <= 6).length;

  const promoterPercentage = (promoters / total) * 100;
  const detractorPercentage = (detractors / total) * 100;
  const nps = Math.round(promoterPercentage - detractorPercentage);
  const averageScore = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;

  const sortedScores = [...scores].sort((a, b) => a - b);
  const median = total % 2 === 0
    ? (sortedScores[total / 2 - 1] + sortedScores[total / 2]) / 2
    : sortedScores[Math.floor(total / 2)];

  return {
    nps,
    total,
    promoters,
    passives,
    detractors,
    promoterPercentage: Math.round(promoterPercentage),
    passivePercentage: Math.round((passives / total) * 100),
    detractorPercentage: Math.round(detractorPercentage),
    averageScore: averageScore.toFixed(1),
    median: median.toFixed(1)
  };
}

// Função para calcular NPS por plano
function calculateNPSByPlan(data) {
  const plans = ['FREE', 'LITE', 'PRO'];
  const resultsByPlan = {};

  plans.forEach(plan => {
    const planData = data.filter(row => row.plano?.toUpperCase() === plan);
    const scores = planData.map(row => Number(row.nota)).filter(score => !isNaN(score) && score >= 0 && score <= 10);
    const total = scores.length;

    if (total > 0) {
      const promoters = scores.filter(score => score >= 9).length;
      const passives = scores.filter(score => score >= 7 && score <= 8).length;
      const detractors = scores.filter(score => score <= 6).length;
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
        averageScore: averageScore.toFixed(1)
      };
    }
  });

  return resultsByPlan;
}

// Função para gerar insights automáticos
function generateInsights(npsResults, npsResultsByPlan) {
  const insights = [];
  const planEntries = Object.entries(npsResultsByPlan);

  if (planEntries.length === 0) return insights;

  const bestPlan = planEntries.reduce((a, b) => a[1].nps > b[1].nps ? a : b);
  const worstPlan = planEntries.reduce((a, b) => a[1].nps < b[1].nps ? a : b);

  insights.push({
    type: 'success',
    icon: '🚀',
    message: `Plano ${bestPlan[0]} lidera com NPS ${bestPlan[1].nps} (${bestPlan[1].total} usuários)`
  });

  if (worstPlan[1].nps < 30) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      message: `Plano ${worstPlan[0]} precisa atenção: NPS ${worstPlan[1].nps}`
    });
  }

  if (npsResults.detractorPercentage > 30) {
    insights.push({
      type: 'error',
      icon: '🔴',
      message: `${npsResults.detractorPercentage}% de detratores - ação imediata necessária`
    });
  }

  if (npsResults.promoterPercentage > 60) {
    insights.push({
      type: 'success',
      icon: '✨',
      message: `${npsResults.promoterPercentage}% promotores - excelente para crescimento orgânico`
    });
  }

  if (Number(npsResults.averageScore) > 8.5) {
    insights.push({
      type: 'success',
      icon: '⭐',
      message: `Média excelente: ${npsResults.averageScore}/10`
    });
  }

  return insights;
}

// Função NOVA para adicionar ao histórico usando datas do CSV
function addToHistoryFromCSV(csvData) {
  // Agrupar dados por data
  const dataByDate = {};
  
  csvData.forEach(row => {
    const date = parseDate(row.data);
    if (!dataByDate[date]) {
      dataByDate[date] = [];
    }
    dataByDate[date].push(row);
  });
  
  console.log(`📊 Datas encontradas no CSV: ${Object.keys(dataByDate).length}`);
  
  // Calcular NPS por plano para cada data
  Object.entries(dataByDate).forEach(([date, dateData]) => {
    const npsResultsByPlan = calculateNPSByPlan(dateData);
    
    const historyEntry = {
      date: date,
      timestamp: new Date(date).toISOString(),
      FREE: npsResultsByPlan['FREE']?.nps || 0,
      LITE: npsResultsByPlan['LITE']?.nps || 0,
      PRO: npsResultsByPlan['PRO']?.nps || 0,
      totalRecords: dateData.length
    };
    
    // Verificar se já existe entrada para esta data
    const existingIndex = npsHistory.findIndex(entry => entry.date === date);
    
    if (existingIndex !== -1) {
      // Atualizar entrada existente (somar registros)
      const existing = npsHistory[existingIndex];
      const combinedData = [...dataByDate[date], ...csvData.filter(r => parseDate(r.data) === date)];
      const combinedNPSByPlan = calculateNPSByPlan(combinedData);
      
      npsHistory[existingIndex] = {
        date: date,
        timestamp: new Date(date).toISOString(),
        FREE: combinedNPSByPlan['FREE']?.nps || 0,
        LITE: combinedNPSByPlan['LITE']?.nps || 0,
        PRO: combinedNPSByPlan['PRO']?.nps || 0,
        totalRecords: combinedData.length
      };
    } else {
      // Adicionar nova entrada
      npsHistory.push(historyEntry);
    }
  });
  
  // Ordenar por data (do mais antigo para o mais recente)
  npsHistory = npsHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  console.log(`📊 Histórico atualizado: ${npsHistory.length} entradas únicas`);
  console.log(`📊 Datas no histórico:`, npsHistory.map(h => h.date));
}

// Rota de upload e processamento do CSV
app.post('/api/upload-csv', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const filePath = req.file.path;
    const csvData = [];

    console.log(`📄 Processando arquivo: ${req.file.originalname}`);
    console.log(`📊 Tamanho: ${(req.file.size / 1024).toFixed(2)} KB`);

    fs.createReadStream(filePath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        delimiter: ',',
        trim: true,
        relax_column_count: true, // Permite colunas irregulares
        quote: '"', // Reconhece aspas duplas
        escape: '"', // Permite escapar aspas
        relax_quotes: true, // Mais flexível com aspas
        cast: false // Não tenta converter tipos automaticamente
      }))
      .on('data', (row) => {
        try {
          const cleanRow = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toLowerCase();
            cleanRow[cleanKey] = row[key]?.trim();
          });

          // Juntar comentário se foi quebrado em várias colunas
          let comentario = cleanRow.comentario || '';
          const extraColumns = Object.keys(row).filter(k => !['data', 'cliente', 'usuario', 'nota', 'comentario', 'plano'].includes(k.trim().toLowerCase()));
          if (extraColumns.length > 0) {
            // Provavelmente o comentário foi quebrado
            const allValues = Object.values(row);
            const knownFields = [cleanRow.data, cleanRow.cliente, cleanRow.usuario, cleanRow.nota];
            const plano = allValues[allValues.length - 1]; // Plano sempre é o último
            
            // Pegar tudo entre nota e plano como comentário
            const comentarioParts = allValues.slice(4, allValues.length - 1);
            comentario = comentarioParts.join(',').trim();
          }

          const nota = Number(cleanRow.nota);
          const plano = cleanRow.plano?.toUpperCase();
          const data = parseDate(cleanRow.data);

          if (!isNaN(nota) && nota >= 0 && nota <= 10 && plano && ['FREE', 'LITE', 'PRO'].includes(plano)) {
            csvData.push({
              data: data,
              dataOriginal: cleanRow.data || '',
              cliente: cleanRow.cliente || '',
              usuario: cleanRow.usuario || '',
              nota: cleanRow.nota,
              comentario: comentario || '',
              plano: plano
            });
          }
        } catch (error) {
          console.log(`⚠️ Erro ao processar linha:`, error.message);
        }
      })
      .on('end', () => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          console.log(`✅ Arquivo processado: ${csvData.length} registros válidos`);

          if (csvData.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'Nenhum registro válido encontrado no arquivo. Verifique se os campos "nota" e "plano" estão corretos.'
            });
          }

          const npsResults = calculateNPS(csvData);
          const npsResultsByPlan = calculateNPSByPlan(csvData);
          const insights = generateInsights(npsResults, npsResultsByPlan);

          // NOVA FUNÇÃO: Adicionar ao histórico usando datas do CSV
          addToHistoryFromCSV(csvData);

          const scoreDistribution = {};
          for (let i = 0; i <= 10; i++) scoreDistribution[i] = 0;
          
          csvData.forEach(row => {
            const score = Number(row.nota);
            if (!Number.isNaN(score)) scoreDistribution[score]++;
          });

          const scoreDistributionData = Object.entries(scoreDistribution).map(([score, count]) => ({
            score: Number(score),
            count,
            percentage: ((count / csvData.length) * 100).toFixed(1),
            category: Number(score) >= 9 ? 'Promotor' : Number(score) >= 7 ? 'Neutro' : 'Detrator'
          }));

          const validPlansArray = ['FREE', 'LITE', 'PRO'];
          const planCounts = { FREE: 0, LITE: 0, PRO: 0 };
          
          csvData.forEach(row => {
            const plan = row.plano;
            if (validPlansArray.includes(plan)) planCounts[plan]++;
          });

          const planPercentages = {};
          validPlansArray.forEach(plan => {
            const count = planCounts[plan];
            if (count > 0) {
              planPercentages[plan] = {
                count,
                percentage: ((count / csvData.length) * 100).toFixed(1)
              };
            }
          });

          console.log(`📈 NPS Geral: ${npsResults.nps}`);
          console.log(`👥 Distribuição por plano:`, Object.keys(planPercentages));
          console.log(`📅 Datas processadas:`, [...new Set(csvData.map(r => r.data))]);

          res.json({
            success: true,
            data: {
              csvData,
              npsResults,
              npsResultsByPlan,
              insights,
              scoreDistributionData,
              planPercentages,
              totalRecords: csvData.length,
              fileName: req.file.originalname,
              uploadDate: new Date().toISOString(),
              uniqueDates: [...new Set(csvData.map(r => r.data))].length
            }
          });

        } catch (error) {
          console.error('❌ Erro no processamento:', error);
          res.status(500).json({
            success: false,
            error: 'Erro interno no processamento dos dados'
          });
        }
      })
      .on('error', (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        console.error('❌ Erro na leitura do CSV:', error);
        res.status(400).json({
          success: false,
          error: 'Erro ao processar arquivo CSV. Verifique se o arquivo está no formato correto e use codificação UTF-8.'
        });
      });

  } catch (error) {
    console.error('❌ Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// Função para agrupar dados por trimestre
function aggregateByQuarter(history) {
  const quarterData = {};
  
  history.forEach(entry => {
    const date = new Date(entry.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    const quarter = Math.ceil(month / 3);
    const quarterKey = `Q${quarter} ${year}`;
    
    if (!quarterData[quarterKey]) {
      quarterData[quarterKey] = {
        date: quarterKey,
        displayDate: quarterKey,
        FREE: [],
        LITE: [],
        PRO: [],
        totalRecords: 0,
        firstDate: entry.date,
        lastDate: entry.date
      };
    }
    
    // Acumular valores de NPS
    if (entry.FREE !== 0) quarterData[quarterKey].FREE.push(entry.FREE);
    if (entry.LITE !== 0) quarterData[quarterKey].LITE.push(entry.LITE);
    if (entry.PRO !== 0) quarterData[quarterKey].PRO.push(entry.PRO);
    quarterData[quarterKey].totalRecords += entry.totalRecords;
    
    // Atualizar última data
    if (new Date(entry.date) > new Date(quarterData[quarterKey].lastDate)) {
      quarterData[quarterKey].lastDate = entry.date;
    }
  });
  
  // Calcular médias
  return Object.values(quarterData).map(q => ({
    date: q.date,
    displayDate: q.displayDate,
    FREE: q.FREE.length > 0 ? Math.round(q.FREE.reduce((a, b) => a + b, 0) / q.FREE.length) : 0,
    LITE: q.LITE.length > 0 ? Math.round(q.LITE.reduce((a, b) => a + b, 0) / q.LITE.length) : 0,
    PRO: q.PRO.length > 0 ? Math.round(q.PRO.reduce((a, b) => a + b, 0) / q.PRO.length) : 0,
    totalRecords: q.totalRecords,
    timestamp: q.firstDate
  })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Rota para obter histórico NPS (com filtro de período e agregação)
app.get('/api/nps-history', (req, res) => {
  const { period, aggregate } = req.query;
  let filteredHistory = [...npsHistory];

  console.log(`📊 Requisição de histórico recebida. Período: ${period || 'all'}, Agregação: ${aggregate || 'none'}`);
  console.log(`📊 Total de entradas no histórico: ${npsHistory.length}`);

  if (period && period !== 'all') {
    const now = new Date();
    let daysToSubtract = 0;

    switch(period) {
      case '7d':
        daysToSubtract = 7;
        break;
      case '30d':
        daysToSubtract = 30;
        break;
      case '90d':
        daysToSubtract = 90;
        break;
      default:
        daysToSubtract = 0;
    }

    if (daysToSubtract > 0) {
      const cutoffDate = new Date(now.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
      filteredHistory = filteredHistory.filter(entry => new Date(entry.date) >= cutoffDate);
      console.log(`📊 Histórico filtrado: ${filteredHistory.length} entradas após ${daysToSubtract} dias`);
    }
  }

  // Aplicar agregação trimestral se solicitado
  if (aggregate === 'quarterly' && filteredHistory.length > 0) {
    filteredHistory = aggregateByQuarter(filteredHistory);
    console.log(`📊 Agregação trimestral aplicada: ${filteredHistory.length} trimestres`);
  }

  console.log(`📊 Enviando histórico:`, filteredHistory.map(h => ({ date: h.date || h.displayDate, records: h.totalRecords })));

  res.json({
    success: true,
    data: filteredHistory,
    totalEntries: filteredHistory.length,
    period: period || 'all',
    aggregated: aggregate === 'quarterly'
  });
});

// Rota para limpar histórico (útil para testes)
app.delete('/api/nps-history', (req, res) => {
  npsHistory = [];
  console.log('🗑️ Histórico limpo');
  
  res.json({
    success: true,
    message: 'Histórico limpo com sucesso'
  });
});

// Rota de saúde da API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    historyEntries: npsHistory.length
  });
});

// Servir o frontend React em produção
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('❌ Erro capturado:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Arquivo muito grande. Limite máximo: 5MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Campo de arquivo não esperado'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: error.message || 'Erro interno do servidor'
  });
});

// Rota 404 para rotas não encontradas da API
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !res.headersSent) {
    res.status(404).json({
      success: false,
      error: 'Rota da API não encontrada'
    });
  } else {
    next();
  }
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log('🚀 ===================================');
  console.log(`🚀 Servidor NPS Backend rodando na porta ${PORT}`);
  console.log(`📊 API disponível em: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📈 Histórico NPS: http://localhost:${PORT}/api/nps-history`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('🚀 ===================================');
});

// Tratamento de encerramento 
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido. Encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso.');
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recebido. Encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso.');
  });
});

module.exports = app;