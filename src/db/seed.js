require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');

const FASES_PADRAO = [
  { nome: 'Protocolo', cor: '#8e8e93' },
  { nome: 'Em análise', cor: '#0071e3' },
  { nome: 'Empenho', cor: '#ff9500' },
  { nome: 'Liberação de recurso', cor: '#af52de' },
  { nome: 'Execução', cor: '#34c759' },
  { nome: 'Concluído', cor: '#30d158' },
];

function seed() {
  const totalFases = db.prepare('SELECT COUNT(*) AS n FROM fases').get().n;
  if (totalFases === 0) {
    const inserirFase = db.prepare('INSERT INTO fases (nome, cor, ordem) VALUES (?, ?, ?)');
    FASES_PADRAO.forEach((fase, i) => inserirFase.run(fase.nome, fase.cor, i));
    console.log(`Criadas ${FASES_PADRAO.length} fases padrão.`);
  } else {
    console.log('Fases já existentes, pulando.');
  }

  const nome = process.env.ADMIN_NOME || 'Administrador';
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;

  if (!email || !senha) {
    console.log('ADMIN_EMAIL/ADMIN_SENHA não definidos no .env — administrador não criado.');
    return;
  }

  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existente) {
    console.log(`Usuário administrador "${email}" já existe, pulando.`);
    return;
  }

  const senhaHash = bcrypt.hashSync(senha, 10);
  db.prepare(
    'INSERT INTO usuarios (nome, email, senha_hash, papel, status) VALUES (?, ?, ?, ?, ?)'
  ).run(nome, email, senhaHash, 'administrador', 'aprovado');
  console.log(`Usuário administrador "${email}" criado.`);
}

seed();
