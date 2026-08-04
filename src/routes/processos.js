const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function carregarProcesso(id) {
  const processo = db
    .prepare(
      `SELECT p.*, f.nome AS fase_nome, f.cor AS fase_cor
       FROM processos p
       LEFT JOIN fases f ON f.id = p.fase_atual_id
       WHERE p.id = ?`
    )
    .get(id);
  if (!processo) return null;

  processo.historico = db
    .prepare(
      `SELECT h.*, f.nome AS fase_nome, f.cor AS fase_cor, u.nome AS usuario_nome
       FROM processo_historico h
       LEFT JOIN fases f ON f.id = h.fase_id
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.processo_id = ?
       ORDER BY h.criado_em ASC, h.id ASC`
    )
    .all(id);

  processo.anexos = db
    .prepare(
      `SELECT id, nome_original, tamanho, tipo_mime, enviado_em
       FROM anexos WHERE processo_id = ? ORDER BY enviado_em DESC`
    )
    .all(id);

  return processo;
}

router.get('/', (req, res) => {
  const { fase, tipo, busca } = req.query;
  let sql = `SELECT p.*, f.nome AS fase_nome, f.cor AS fase_cor
             FROM processos p LEFT JOIN fases f ON f.id = p.fase_atual_id WHERE 1=1`;
  const params = [];

  if (fase) {
    sql += ' AND p.fase_atual_id = ?';
    params.push(Number(fase));
  }
  if (tipo) {
    sql += ' AND p.tipo = ?';
    params.push(tipo);
  }
  if (busca) {
    sql += ' AND (p.titulo LIKE ? OR p.numero LIKE ? OR p.parlamentar LIKE ?)';
    const termo = `%${busca}%`;
    params.push(termo, termo, termo);
  }
  sql += ' ORDER BY p.atualizado_em DESC';

  const processos = db.prepare(sql).all(...params);
  res.json({ processos });
});

router.get('/:id', (req, res) => {
  const processo = carregarProcesso(Number(req.params.id));
  if (!processo) return res.status(404).json({ erro: 'Processo não encontrado.' });
  res.json({ processo });
});

const processoSchema = z.object({
  titulo: z.string().trim().min(2).max(200),
  numero: z.string().trim().max(60).optional().nullable(),
  tipo: z.enum(['emenda', 'convenio']).default('emenda'),
  parlamentar: z.string().trim().max(160).optional().nullable(),
  valor: z.number().nonnegative().optional().default(0),
  descricao: z.string().trim().max(4000).optional().nullable(),
  fase_atual_id: z.number().int().optional().nullable(),
});

router.post('/', requireRole('administrador', 'editor'), (req, res) => {
  const parsed = processoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });
  const d = parsed.data;

  let faseId = d.fase_atual_id ?? null;
  if (!faseId) {
    const primeira = db.prepare('SELECT id FROM fases WHERE ativo = 1 ORDER BY ordem ASC LIMIT 1').get();
    faseId = primeira ? primeira.id : null;
  }

  const info = db
    .prepare(
      `INSERT INTO processos (titulo, numero, tipo, parlamentar, valor, descricao, fase_atual_id, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(d.titulo, d.numero ?? null, d.tipo, d.parlamentar ?? null, d.valor, d.descricao ?? null, faseId, req.usuario.id);

  db.prepare(
    'INSERT INTO processo_historico (processo_id, fase_id, observacao, usuario_id) VALUES (?, ?, ?, ?)'
  ).run(info.lastInsertRowid, faseId, 'Processo criado.', req.usuario.id);

  res.status(201).json({ processo: carregarProcesso(info.lastInsertRowid) });
});

const atualizarSchema = processoSchema.partial();

router.patch('/:id', requireRole('administrador', 'editor'), (req, res) => {
  const id = Number(req.params.id);
  const existente = db.prepare('SELECT * FROM processos WHERE id = ?').get(id);
  if (!existente) return res.status(404).json({ erro: 'Processo não encontrado.' });

  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });
  const d = { ...existente, ...parsed.data };

  db.prepare(
    `UPDATE processos SET titulo = ?, numero = ?, tipo = ?, parlamentar = ?, valor = ?, descricao = ?, atualizado_em = datetime('now')
     WHERE id = ?`
  ).run(d.titulo, d.numero ?? null, d.tipo, d.parlamentar ?? null, d.valor, d.descricao ?? null, id);

  res.json({ processo: carregarProcesso(id) });
});

const avancarSchema = z.object({
  fase_id: z.number().int(),
  observacao: z.string().trim().max(2000).optional().nullable(),
});

router.post('/:id/avancar', requireRole('administrador', 'editor'), (req, res) => {
  const id = Number(req.params.id);
  const processo = db.prepare('SELECT id FROM processos WHERE id = ?').get(id);
  if (!processo) return res.status(404).json({ erro: 'Processo não encontrado.' });

  const parsed = avancarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const fase = db.prepare('SELECT id FROM fases WHERE id = ?').get(parsed.data.fase_id);
  if (!fase) return res.status(404).json({ erro: 'Fase não encontrada.' });

  db.prepare(`UPDATE processos SET fase_atual_id = ?, atualizado_em = datetime('now') WHERE id = ?`).run(
    fase.id,
    id
  );
  db.prepare(
    'INSERT INTO processo_historico (processo_id, fase_id, observacao, usuario_id) VALUES (?, ?, ?, ?)'
  ).run(id, fase.id, parsed.data.observacao ?? null, req.usuario.id);

  res.json({ processo: carregarProcesso(id) });
});

router.delete('/:id', requireRole('administrador'), (req, res) => {
  const id = Number(req.params.id);
  const processo = db.prepare('SELECT id FROM processos WHERE id = ?').get(id);
  if (!processo) return res.status(404).json({ erro: 'Processo não encontrado.' });

  db.prepare('DELETE FROM processos WHERE id = ?').run(id);
  res.json({ mensagem: 'Processo excluído.' });
});

module.exports = router;
