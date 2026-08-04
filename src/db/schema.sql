CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'leitor' CHECK (papel IN ('administrador', 'editor', 'leitor')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#0071e3',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS processos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  numero TEXT,
  tipo TEXT NOT NULL DEFAULT 'emenda' CHECK (tipo IN ('emenda', 'convenio')),
  parlamentar TEXT,
  valor REAL DEFAULT 0,
  descricao TEXT,
  fase_atual_id INTEGER REFERENCES fases(id),
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processo_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  processo_id INTEGER NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  fase_id INTEGER REFERENCES fases(id),
  observacao TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  processo_id INTEGER NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  nome_original TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  tipo_mime TEXT,
  enviado_por INTEGER REFERENCES usuarios(id),
  enviado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_processos_fase ON processos(fase_atual_id);
CREATE INDEX IF NOT EXISTS idx_historico_processo ON processo_historico(processo_id);
CREATE INDEX IF NOT EXISTS idx_anexos_processo ON anexos(processo_id);
