// clean-database.js - Script para limpar o banco de dados
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
});