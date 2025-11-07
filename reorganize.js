// reorganize.js - Script para reorganizar o projeto automaticamente
const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando reorganização do projeto...\n');

// Função auxiliar para criar diretório
function createDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Criado: ${dirPath}`);
  } else {
    console.log(`⏭️  Já existe: ${dirPath}`);
  }
}

// Função auxiliar para mover arquivo
function moveFile(from, to) {
  try {
    if (fs.existsSync(from)) {
      // Criar diretório de destino se não existir
      const toDir = path.dirname(to);
      createDir(toDir);
      
      fs.renameSync(from, to);
      console.log(`✅ Movido: ${from} → ${to}`);
      return true;
    } else {
      console.log(`⚠️  Não encontrado: ${from}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Erro ao mover ${from}:`, error.message);
    return false;
  }
}

// Função para mover diretório inteiro
function moveDir(from, to) {
  try {
    if (fs.existsSync(from)) {
      createDir(path.dirname(to));
      fs.renameSync(from, to);
      console.log(`✅ Movido diretório: ${from} → ${to}`);
      return true;
    } else {
      console.log(`⚠️  Diretório não encontrado: ${from}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Erro ao mover diretório ${from}:`, error.message);
    return false;
  }
}

// Função para criar arquivo .gitkeep
function createGitkeep(dirPath) {
  const gitkeepPath = path.join(dirPath, '.gitkeep');
  fs.writeFileSync(gitkeepPath, '');
  console.log(`✅ Criado .gitkeep em: ${dirPath}`);
}

// PASSO 1: Criar estrutura de pastas
console.log('\n📁 PASSO 1: Criando estrutura de pastas...');
createDir('server');
createDir('server/uploads');

// PASSO 2: Mover server.js
console.log('\n📦 PASSO 2: Movendo arquivos do backend...');
const serverMoved = moveFile('src/server.js', 'server/index.js');

// PASSO 3: Mover pasta data
console.log('\n💾 PASSO 3: Movendo banco de dados...');
const dataMoved = moveDir('src/data', 'server/data');

// PASSO 4: Criar .gitkeep
console.log('\n📌 PASSO 4: Criando arquivos .gitkeep...');
if (fs.existsSync('server/data')) {
  createGitkeep('server/data');
}
createGitkeep('server/uploads');

// PASSO 5: Atualizar .gitignore
console.log('\n🔒 PASSO 5: Atualizando .gitignore...');
const gitignoreContent = `
# Dependências
node_modules/
/.pnp
.pnp.js

# Testes
/coverage

# Produção
/build

# Diversos
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ========================================
# BACKEND - Dados e Uploads
# ========================================

# Banco de dados SQLite
server/data/*.db
server/data/*.db-shm
server/data/*.db-wal

# Backups do banco
server/data/backup-*.db

# Uploads temporários
server/uploads/*

# Manter estrutura de pastas no Git
!server/data/.gitkeep
!server/uploads/.gitkeep
`;

try {
  fs.writeFileSync('.gitignore', gitignoreContent.trim());
  console.log('✅ .gitignore atualizado');
} catch (error) {
  console.error('❌ Erro ao atualizar .gitignore:', error.message);
}

// PASSO 6: Atualizar package.json
console.log('\n📦 PASSO 6: Atualizando package.json...');
try {
  const packageJsonPath = 'package.json';
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Adicionar/atualizar scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "server": "nodemon server/index.js",
    "dev": "concurrently \"npm run server\" \"npm start\"",
    "clean-db": "node scripts/clean-database.js"
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ package.json atualizado');
  console.log('   - Adicionado: npm run server');
  console.log('   - Adicionado: npm run dev');
  console.log('   - Adicionado: npm run clean-db');
} catch (error) {
  console.error('❌ Erro ao atualizar package.json:', error.message);
}

// PASSO 7: Criar script de limpeza do banco
console.log('\n🧹 PASSO 7: Criando script de limpeza...');
createDir('scripts');

const cleanDbScript = `// clean-database.js - Script para limpar o banco de dados
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dataDir = path.join(__dirname, '..', 'server', 'data');
const dbFile = path.join(dataDir, 'nps-database.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🗑️  LIMPEZA DO BANCO DE DADOS');
console.log('');
console.log('⚠️  ATENÇÃO: Esta ação é IRREVERSÍVEL!');
console.log('');

rl.question('Deseja realmente limpar o banco de dados? (sim/não): ', (answer) => {
  if (answer.toLowerCase() === 'sim') {
    try {
      // Listar arquivos do banco
      const files = [
        'nps-database.db',
        'nps-database.db-shm',
        'nps-database.db-wal'
      ];
      
      let deleted = 0;
      files.forEach(file => {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('✅ Deletado: ' + file);
          deleted++;
        }
      });
      
      // Deletar backups
      if (fs.existsSync(dataDir)) {
        const backups = fs.readdirSync(dataDir).filter(f => f.startsWith('backup-'));
        backups.forEach(backup => {
          fs.unlinkSync(path.join(dataDir, backup));
          console.log('✅ Deletado backup: ' + backup);
          deleted++;
        });
      }
      
      if (deleted === 0) {
        console.log('ℹ️  Nenhum arquivo de banco encontrado.');
      } else {
        console.log('');
        console.log('✅ ' + deleted + ' arquivo(s) deletado(s) com sucesso!');
        console.log('🔄 Um novo banco será criado automaticamente no próximo uso.');
        console.log('');
      }
    } catch (error) {
      console.error('❌ Erro ao limpar banco:', error.message);
    }
  } else {
    console.log('❌ Operação cancelada.');
  }
  
  rl.close();
});`;

try {
  fs.writeFileSync('scripts/clean-database.js', cleanDbScript);
  console.log('✅ Script de limpeza criado: scripts/clean-database.js');
} catch (error) {
  console.error('❌ Erro ao criar script de limpeza:', error.message);
}

// PASSO 8: Verificar dependências
console.log('\n📚 PASSO 8: Verificando dependências...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const required = {
    'concurrently': 'para rodar frontend e backend juntos',
    'nodemon': 'para reiniciar backend automaticamente',
    'better-sqlite3': 'para o banco de dados SQLite'
  };
  
  const missing = [];
  Object.keys(required).forEach(dep => {
    if (!deps[dep]) {
      missing.push(dep);
      console.log(`⚠️  Faltando: ${dep} (${required[dep]})`);
    } else {
      console.log(`✅ Instalado: ${dep}`);
    }
  });
  
  if (missing.length > 0) {
    console.log('\n💡 Execute para instalar as dependências faltantes:');
    console.log(`   npm install ${missing.join(' ')}`);

  }
} catch (error) {
  console.error('❌ Erro ao verificar dependências:', error.message);
}

// RESUMO FINAL
console.log('\n' + '='.repeat(60));
console.log('✅ REORGANIZAÇÃO CONCLUÍDA!\n');
console.log('📂 Nova estrutura:');
console.log('   nps-app/');
console.log('   ├── src/              (Frontend React)');
console.log('   ├── server/           (Backend Node.js)');
console.log('   │   ├── index.js');
console.log('   │   ├── data/         (Banco de dados)');
console.log('   │   └── uploads/      (Arquivos temporários)');
console.log('   ├── scripts/          (Utilitários)');
console.log('   └── package.json\n');

console.log('🚀 Próximos passos:\n');
console.log('   1. Instalar dependências (se necessário):');
console.log('      npm install concurrently nodemon better-sqlite3\n');
console.log('   2. Rodar o projeto:');
console.log('      npm run dev\n');
console.log('   3. Limpar banco de dados:');
console.log('      npm run clean-db\n');

console.log('📝 Comandos disponíveis:');
console.log('   - npm start         → Só o frontend (porta 3000)');
console.log('   - npm run server    → Só o backend (porta 5000)');
console.log('   - npm run dev       → Frontend + Backend juntos ✨');
console.log('   - npm run clean-db  → Limpar banco de dados\n');

console.log('💡 Dica: Use "npm run dev" para desenvolvimento!');
console.log('='.repeat(60) + '\n');