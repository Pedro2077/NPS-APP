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
    ? ['https://seu-dominio.com'] // Substitua pelo seu domínio em produção
    : ['http://localhost:3000'], // Frontend React
  credentials: true
}));

app.use(express.json());

// Servir arquivos estáticos em produção
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
}

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
    // Verificar tipo de arquivo
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

  // Calcular mediana
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

  // Melhor e pior plano
  const bestPlan = planEntries.reduce((a, b) => a[1].nps > b[1].nps ? a : b);
  const worstPlan = planEntries.reduce((a, b) => a[1].nps < b[1].nps ? a : b);

  // Insight sobre melhor plano
  insights.push({
    type: 'success',
    icon: '🚀',
    message: `Plano ${bestPlan[0]} lidera com NPS ${bestPlan[1].nps} (${bestPlan[1].total} usuários)`
  });

  // Insight sobre plano que precisa atenção
  if (worstPlan[1].nps < 30) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      message: `Plano ${worstPlan[0]} precisa atenção: NPS ${worstPlan[1].nps}`
    });
  }

  // Insight sobre detratores
  if (npsResults.detractorPercentage > 30) {
    insights.push({
      type: 'error',
      icon: '🔴',
      message: `${npsResults.detractorPercentage}% de detratores - ação imediata necessária`
    });
  }

  // Insight sobre promotores
  if (npsResults.promoterPercentage > 60) {
    insights.push({
      type: 'success',
      icon: '✨',
      message: `${npsResults.promoterPercentage}% promotores - excelente para crescimento orgânico`
    });
  }

  // Insight sobre média
  if (Number(npsResults.averageScore) > 8.5) {
    insights.push({
      type: 'success',
      icon: '⭐',
      message: `Média excelente: ${npsResults.averageScore}/10`
    });
  }

  return insights;
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

    // Ler e processar o CSV
    fs.createReadStream(filePath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        delimiter: ',',
        trim: true
      }))
      .on('data', (row) => {
        try {
          // Normalizar e validar os dados
          const cleanRow = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toLowerCase();
            cleanRow[cleanKey] = row[key]?.trim();
          });

          // Validar campos obrigatórios
          const nota = Number(cleanRow.nota);
          const plano = cleanRow.plano?.toUpperCase();

          if (!isNaN(nota) && nota >= 0 && nota <= 10 && plano && ['FREE', 'LITE', 'PRO'].includes(plano)) {
            csvData.push({
              data: cleanRow.data || '',
              cliente: cleanRow.cliente || '',
              usuario: cleanRow.usuario || '',
              nota: cleanRow.nota,
              comentario: cleanRow.comentario || '',
              plano: plano
            });
          }
        } catch (error) {
          console.log(`⚠️ Erro ao processar linha:`, error.message);
        }
      })
      .on('end', () => {
        try {
          // Limpar arquivo temporário
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          console.log(`✅ Arquivo processado: ${csvData.length} registros válidos`);

          // Validar se há dados válidos
          if (csvData.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'Nenhum registro válido encontrado no arquivo. Verifique se os campos "nota" e "plano" estão corretos.'
            });
          }

          // Calcular métricas NPS
          const npsResults = calculateNPS(csvData);
          const npsResultsByPlan = calculateNPSByPlan(csvData);
          const insights = generateInsights(npsResults, npsResultsByPlan);

          // Calcular distribuição de notas
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

          // Calcular percentuais por plano
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

          // Resposta com todos os dados processados
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
              uploadDate: new Date().toISOString()
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
        // Limpar arquivo em caso de erro
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

// Rota de exemplo para histórico (mock data)
app.get('/api/nps-history', (req, res) => {
  const mockHistory = [
    { date: '2024-12-25', FREE: 22, LITE: 40, PRO: 59 },
    { date: '2025-01-01', FREE: 28, LITE: 38, PRO: 62 },
    { date: '2025-01-08', FREE: 30, LITE: 42, PRO: 68 },
    { date: '2025-01-15', FREE: 25, LITE: 45, PRO: 65 },
    { date: '2025-01-22', FREE: 32, LITE: 47, PRO: 70 },
    { date: '2025-01-29', FREE: 35, LITE: 50, PRO: 72 },
  ];

  res.json({
    success: true,
    data: mockHistory
  });
});

// Rota de saúde da API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
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
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota da API não encontrada'
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log('🚀 ===================================');
  console.log(`🚀 Servidor NPS Backend rodando na porta ${PORT}`);
  console.log(`📊 API disponível em: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('🚀 ===================================');
});

// Tratamento de encerramento gracioso
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