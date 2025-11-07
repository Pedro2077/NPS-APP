const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// CONFIGURAÇÃO DO SQLITE
// ============================================

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "nps-database.db");

// Criar pasta data se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log("📁 Pasta 'data' criada");
}

// Inicializar banco de dados
const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL"); // Melhor performance

console.log(`💾 Banco de dados SQLite: ${DB_FILE}`);

// Criar tabelas
function initDatabase() {
  // Tabela de histórico NPS
  db.exec(`
    CREATE TABLE IF NOT EXISTS nps_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      timestamp TEXT NOT NULL,
      nps_free INTEGER DEFAULT 0,
      nps_lite INTEGER DEFAULT 0,
      nps_pro INTEGER DEFAULT 0,
      total_records INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de uploads (histórico de arquivos processados)
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      total_records INTEGER NOT NULL,
      unique_dates INTEGER NOT NULL,
      upload_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de avaliações individuais (opcional, mas útil)
  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      client_id TEXT,
      user_name TEXT,
      score INTEGER NOT NULL,
      plan TEXT NOT NULL,
      comment TEXT,
      category TEXT NOT NULL,
      upload_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (upload_id) REFERENCES uploads(id)
    )
  `);

  // Índices para performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nps_history_date ON nps_history(date);
    CREATE INDEX IF NOT EXISTS idx_evaluations_date ON evaluations(date);
    CREATE INDEX IF NOT EXISTS idx_evaluations_plan ON evaluations(plan);
    CREATE INDEX IF NOT EXISTS idx_evaluations_score ON evaluations(score);
  `);

  console.log("✅ Tabelas do banco de dados inicializadas");
}

initDatabase();

// Funções do banco de dados
const dbQueries = {
  // Inserir ou atualizar histórico NPS
  upsertHistory: db.prepare(`
    INSERT INTO nps_history (date, timestamp, nps_free, nps_lite, nps_pro, total_records, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(date) DO UPDATE SET
      nps_free = excluded.nps_free,
      nps_lite = excluded.nps_lite,
      nps_pro = excluded.nps_pro,
      total_records = total_records + excluded.total_records,
      updated_at = CURRENT_TIMESTAMP
  `),

  // Buscar histórico completo
  getHistory: db.prepare(`
    SELECT * FROM nps_history ORDER BY date ASC
  `),

  // Buscar histórico por período
  getHistoryByPeriod: db.prepare(`
    SELECT * FROM nps_history 
    WHERE date >= date('now', ?) 
    ORDER BY date ASC
  `),

  // Inserir upload
  insertUpload: db.prepare(`
    INSERT INTO uploads (filename, total_records, unique_dates, upload_date)
    VALUES (?, ?, ?, ?)
  `),

  // Buscar últimos uploads
  getRecentUploads: db.prepare(`
    SELECT * FROM uploads 
    ORDER BY created_at DESC 
    LIMIT 5
  `),

  // Inserir avaliação individual
  insertEvaluation: db.prepare(`
    INSERT INTO evaluations (date, client_id, user_name, score, plan, comment, category, upload_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // Buscar avaliações por período
  getEvaluationsByPeriod: db.prepare(`
    SELECT * FROM evaluations 
    WHERE date >= date('now', ?)
    ORDER BY date DESC
  `),

  // Estatísticas gerais
  getStats: db.prepare(`
    SELECT 
      COUNT(*) as total_evaluations,
      COUNT(DISTINCT date) as unique_dates,
      COUNT(DISTINCT client_id) as unique_clients,
      AVG(score) as average_score,
      MIN(date) as first_date,
      MAX(date) as last_date
    FROM evaluations
  `),

  // Limpar histórico
  clearHistory: db.prepare(`DELETE FROM nps_history`),
  
  // Limpar avaliações
  clearEvaluations: db.prepare(`DELETE FROM evaluations`),
};

// Função para fazer backup do banco
function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(DATA_DIR, `backup-${timestamp}.db`);
    
    // Copiar arquivo do banco
    fs.copyFileSync(DB_FILE, backupFile);
    console.log(`📦 Backup criado: ${backupFile}`);

    // Manter apenas os últimos 5 backups
    const backups = fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.startsWith("backup-") && f.endsWith(".db"))
      .sort()
      .reverse();

    if (backups.length > 5) {
      backups.slice(5).forEach((file) => {
        fs.unlinkSync(path.join(DATA_DIR, file));
        console.log(`🗑️  Backup antigo removido: ${file}`);
      });
    }
  } catch (error) {
    console.error("❌ Erro ao criar backup:", error);
  }
}

// Backup automático a cada 24 horas
setInterval(createBackup, 24 * 60 * 60 * 1000);

// ============================================
// FIM DA CONFIGURAÇÃO SQLITE
// ============================================

// Middlewares
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://seu-dominio.com"]
        : ["http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json());

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../build")));
}

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["text/csv", "application/csv", "text/plain"];
    const isCSV =
      allowedMimeTypes.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith(".csv");

    if (isCSV) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos CSV são permitidos"), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// Função auxiliar para parsear data
function parseDate(dateString) {
  if (!dateString) return null;

  const normalized = dateString.trim().replace(/[\/\-]/g, "-");

  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})/,
    /^(\d{2})-(\d{2})-(\d{4})/,
    /^(\d{2})-(\d{2})-(\d{2})/,
  ];

  for (const format of formats) {
    const match = normalized.match(format);
    if (match) {
      if (match[1].length === 4) {
        const date = new Date(match[1], match[2] - 1, match[3]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } else {
        let year = match[3];
        if (year.length === 2) {
          year = (parseInt(year) > 50 ? "19" : "20") + year;
        }
        const date = new Date(year, match[2] - 1, match[1]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      }
    }
  }

  return new Date().toISOString().split("T")[0];
}

// Função para calcular NPS geral
function calculateNPS(data) {
  const scores = data
    .map((row) => Number(row.nota))
    .filter((score) => !isNaN(score) && score >= 0 && score <= 10);
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
      averageScore: "0.0",
      median: "0.0",
    };
  }

  const promoters = scores.filter((score) => score >= 9).length;
  const passives = scores.filter((score) => score >= 7 && score <= 8).length;
  const detractors = scores.filter((score) => score <= 6).length;

  const promoterPercentage = (promoters / total) * 100;
  const detractorPercentage = (detractors / total) * 100;
  const nps = Math.round(promoterPercentage - detractorPercentage);
  const averageScore =
    total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;

  const sortedScores = [...scores].sort((a, b) => a - b);
  const median =
    total % 2 === 0
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
    median: median.toFixed(1),
  };
}

// Função para calcular NPS por plano
function calculateNPSByPlan(data) {
  const plans = ["FREE", "LITE", "PRO"];
  const resultsByPlan = {};

  plans.forEach((plan) => {
    const planData = data.filter((row) => row.plano?.toUpperCase() === plan);
    const scores = planData
      .map((row) => Number(row.nota))
      .filter((score) => !isNaN(score) && score >= 0 && score <= 10);
    const total = scores.length;

    if (total > 0) {
      const promoters = scores.filter((score) => score >= 9).length;
      const passives = scores.filter(
        (score) => score >= 7 && score <= 8
      ).length;
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

  return resultsByPlan;
}

// Função para gerar insights automáticos
function generateInsights(npsResults, npsResultsByPlan) {
  const insights = [];
  const planEntries = Object.entries(npsResultsByPlan);

  if (planEntries.length === 0) return insights;

  const bestPlan = planEntries.reduce((a, b) => (a[1].nps > b[1].nps ? a : b));
  const worstPlan = planEntries.reduce((a, b) => (a[1].nps < b[1].nps ? a : b));

  insights.push({
    type: "success",
    icon: "🚀",
    message: `Plano ${bestPlan[0]} lidera com NPS ${bestPlan[1].nps} (${bestPlan[1].total} usuários)`,
  });

  if (worstPlan[1].nps < 30) {
    insights.push({
      type: "warning",
      icon: "⚠️",
      message: `Plano ${worstPlan[0]} precisa atenção: NPS ${worstPlan[1].nps}`,
    });
  }

  if (npsResults.detractorPercentage > 30) {
    insights.push({
      type: "error",
      icon: "🔴",
      message: `${npsResults.detractorPercentage}% de detratores - ação imediata necessária`,
    });
  }

  if (npsResults.promoterPercentage > 60) {
    insights.push({
      type: "success",
      icon: "✨",
      message: `${npsResults.promoterPercentage}% promotores - excelente para crescimento orgânico`,
    });
  }

  if (Number(npsResults.averageScore) > 8.5) {
    insights.push({
      type: "success",
      icon: "⭐",
      message: `Média excelente: ${npsResults.averageScore}/10`,
    });
  }

  return insights;
}

// Função para salvar no banco de dados
function saveToDatabase(csvData, uploadId) {
  // Agrupar dados por data
  const dataByDate = {};

  csvData.forEach((row) => {
    const date = parseDate(row.data);
    if (!dataByDate[date]) {
      dataByDate[date] = [];
    }
    dataByDate[date].push(row);
  });

  console.log(`📊 Salvando ${Object.keys(dataByDate).length} datas no banco`);

  // Usar transação para performance
  const insertMany = db.transaction((data) => {
    data.forEach(({ date, dateData }) => {
      const npsResultsByPlan = calculateNPSByPlan(dateData);

      // Salvar histórico NPS
      dbQueries.upsertHistory.run(
        date,
        new Date(date).toISOString(),
        npsResultsByPlan["FREE"]?.nps || 0,
        npsResultsByPlan["LITE"]?.nps || 0,
        npsResultsByPlan["PRO"]?.nps || 0,
        dateData.length
      );

      // Salvar avaliações individuais
      dateData.forEach((row) => {
        const nota = Number(row.nota);
        const categoria = nota >= 9 ? "Promotor" : nota >= 7 ? "Neutro" : "Detrator";
        
        dbQueries.insertEvaluation.run(
          date,
          row.cliente || null,
          row.usuario || null,
          nota,
          row.plano,
          row.comentario || null,
          categoria,
          uploadId
        );
      });
    });
  });

  // Executar transação
  const dataToInsert = Object.entries(dataByDate).map(([date, dateData]) => ({
    date,
    dateData,
  }));

  insertMany(dataToInsert);

  console.log(`✅ Dados salvos no banco de dados`);
}

// Rota de upload e processamento do CSV
app.post("/api/upload-csv", upload.single("csvFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Nenhum arquivo foi enviado",
      });
    }

    const filePath = req.file.path;
    const csvData = [];

    console.log(`📄 Processando arquivo: ${req.file.originalname}`);

    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          delimiter: ",",
          trim: true,
          relax_column_count: true,
          quote: '"',
          escape: '"',
          relax_quotes: true,
          cast: false,
        })
      )
      .on("data", (row) => {
        try {
          const cleanRow = {};
          Object.keys(row).forEach((key) => {
            const cleanKey = key.trim().toLowerCase();
            cleanRow[cleanKey] = row[key]?.trim();
          });

          let comentario = cleanRow.comentario || "";
          const extraColumns = Object.keys(row).filter(
            (k) =>
              ![
                "data",
                "cliente",
                "usuario",
                "nota",
                "comentario",
                "plano",
              ].includes(k.trim().toLowerCase())
          );
          if (extraColumns.length > 0) {
            const allValues = Object.values(row);
            const comentarioParts = allValues.slice(4, allValues.length - 1);
            comentario = comentarioParts.join(",").trim();
          }

          const nota = Number(cleanRow.nota);
          const plano = cleanRow.plano?.toUpperCase();
          const data = parseDate(cleanRow.data);

          if (
            !isNaN(nota) &&
            nota >= 0 &&
            nota <= 10 &&
            plano &&
            ["FREE", "LITE", "PRO"].includes(plano)
          ) {
            csvData.push({
              data: data,
              dataOriginal: cleanRow.data || "",
              cliente: cleanRow.cliente || "",
              usuario: cleanRow.usuario || "",
              nota: cleanRow.nota,
              comentario: comentario || "",
              plano: plano,
            });
          }
        } catch (error) {
          console.log(`⚠️ Erro ao processar linha:`, error.message);
        }
      })
      .on("end", () => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          console.log(
            `✅ Arquivo processado: ${csvData.length} registros válidos`
          );

          if (csvData.length === 0) {
            return res.status(400).json({
              success: false,
              error:
                'Nenhum registro válido encontrado no arquivo.',
            });
          }

          const npsResults = calculateNPS(csvData);
          const npsResultsByPlan = calculateNPSByPlan(csvData);
          const insights = generateInsights(npsResults, npsResultsByPlan);

          // Registrar upload no banco
          const uploadInfo = dbQueries.insertUpload.run(
            req.file.originalname,
            csvData.length,
            [...new Set(csvData.map((r) => r.data))].length,
            new Date().toISOString()
          );

          // Salvar todos os dados no banco
          saveToDatabase(csvData, uploadInfo.lastInsertRowid);

          const scoreDistribution = {};
          for (let i = 0; i <= 10; i++) scoreDistribution[i] = 0;

          csvData.forEach((row) => {
            const score = Number(row.nota);
            if (!Number.isNaN(score)) scoreDistribution[score]++;
          });

          const scoreDistributionData = Object.entries(scoreDistribution).map(
            ([score, count]) => ({
              score: Number(score),
              count,
              percentage: ((count / csvData.length) * 100).toFixed(1),
              category:
                Number(score) >= 9
                  ? "Promotor"
                  : Number(score) >= 7
                  ? "Neutro"
                  : "Detrator",
            })
          );

          const validPlansArray = ["FREE", "LITE", "PRO"];
          const planCounts = { FREE: 0, LITE: 0, PRO: 0 };

          csvData.forEach((row) => {
            const plan = row.plano;
            if (validPlansArray.includes(plan)) planCounts[plan]++;
          });

          const planPercentages = {};
          validPlansArray.forEach((plan) => {
            const count = planCounts[plan];
            if (count > 0) {
              planPercentages[plan] = {
                count,
                percentage: ((count / csvData.length) * 100).toFixed(1),
              };
            }
          });

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
              uniqueDates: [...new Set(csvData.map((r) => r.data))].length,
            },
          });
        } catch (error) {
          console.error("❌ Erro no processamento:", error);
          res.status(500).json({
            success: false,
            error: "Erro interno no processamento dos dados",
          });
        }
      })
      .on("error", (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        console.error("❌ Erro na leitura do CSV:", error);
        res.status(400).json({
          success: false,
          error: "Erro ao processar arquivo CSV.",
        });
      });
  } catch (error) {
    console.error("❌ Erro no upload:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro interno do servidor",
    });
  }
});

// Rota para obter histórico NPS
app.get("/api/nps-history", (req, res) => {
  try {
    const { period } = req.query;
    let history;

    if (period && period !== "all") {
      const periodMap = {
        "7d": "-7 days",
        "30d": "-30 days",
        "90d": "-90 days",
      };

      history = dbQueries.getHistoryByPeriod.all(periodMap[period] || "-30 days");
    } else {
      history = dbQueries.getHistory.all();
    }

    // Formatar resposta
    const formattedHistory = history.map((entry) => ({
      date: entry.date,
      displayDate: entry.date.split("-").reverse().join("/"),
      FREE: entry.nps_free,
      LITE: entry.nps_lite,
      PRO: entry.nps_pro,
      totalRecords: entry.total_records,
      timestamp: entry.timestamp,
    }));

    res.json({
      success: true,
      data: formattedHistory,
      totalEntries: formattedHistory.length,
      period: period || "all",
    });
  } catch (error) {
    console.error("❌ Erro ao buscar histórico:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar histórico",
    });
  }
});

// Rota para estatísticas gerais
app.get("/api/stats", (req, res) => {
  try {
    const stats = dbQueries.getStats.get();
    const recentUploads = dbQueries.getRecentUploads.all();

    res.json({
      success: true,
      data: {
        stats,
        recentUploads,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar estatísticas",
    });
  }
});

// Rota para limpar histórico
app.delete("/api/nps-history", (req, res) => {
  try {
    // Fazer backup antes de limpar
    createBackup();

    dbQueries.clearHistory.run();
    dbQueries.clearEvaluations.run();

    console.log("🗑️ Histórico limpo");

    res.json({
      success: true,
      message: "Histórico limpo com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao limpar histórico:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao limpar histórico",
    });
  }
});

// Rota de saúde da API
app.get("/api/health", (req, res) => {
  try {
    const stats = dbQueries.getStats.get();

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      database: {
        type: "SQLite",
        file: DB_FILE,
        totalEvaluations: stats.total_evaluations || 0,
        uniqueDates: stats.unique_dates || 0,
        uniqueClients: stats.unique_clients || 0,
      },
    });
  } catch (error) {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      database: {
        type: "SQLite",
        file: DB_FILE,
      },
    });
  }
});

// Servir o frontend React em produção
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../build", "index.html"));
  });
}

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error("❌ Erro capturado:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "Arquivo muito grande. Limite máximo: 5MB",
      });
    }
  }

  res.status(500).json({
    success: false,
    error: error.message || "Erro interno do servidor",
  });
});

// Rota 404
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") && !res.headersSent) {
    res.status(404).json({
      success: false,
      error: "Rota da API não encontrada",
    });
  } else {
    next();
  }
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log("🚀 ===================================");
  console.log(`🚀 Servidor NPS Backend rodando na porta ${PORT}`);
  console.log(`📊 API disponível em: http://localhost:${PORT}/api`);
  console.log(`💾 Banco de dados: SQLite (${DB_FILE})`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log("🚀 ===================================");
});

// Tratamento de encerramento
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM recebido. Fechando banco...");
  db.close();
  server.close(() => {
    console.log("✅ Servidor encerrado com sucesso.");
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT recebido. Fechando banco...");
  db.close();
  server.close(() => {
    console.log("✅ Servidor encerrado com sucesso.");
  });
});

module.exports = app;