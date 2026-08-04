const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const fases = db.prepare('SELECT * FROM fases ORDER BY ordem ASC').all();
  res.json({ fases });
});

router.use(requireRole('administrador'));

const faseSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default('#0071e3'),
});

router.post('/', (req, res) => {
  const parsed = faseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const maxOrdem = db.prepare('SELECT COALESCE(MAX(ordem), -1) AS m FROM fases').get().m;
  const info = db
    .prepare('INSERT INTO fases (nome, cor, ordem) VALUES (?, ?, ?)')
    .run(parsed.data.nome, parsed.data.cor, maxOrdem + 1);
  const fase = db.prepare('SELECT * FROM fases WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ fase });
});

const atualizarSchema = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ativo: z.boolean().optional(),
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const fase = db.prepare('SELECT * FROM fases WHERE id = ?').get(id);
  if (!fase) return res.status(404).json({ erro: 'Fase não encontrada.' });

  const dados = {
    nome: parsed.data.nome ?? fase.nome,
    cor: parsed.data.cor ?? fase.cor,
    ativo: parsed.data.ativo === undefined ? fase.ativo : parsed.data.ativo ? 1 : 0,
  };
  db.prepare('UPDATE fases SET nome = ?, cor = ?, ativo = ? WHERE id = ?').run(
    dados.nome,
    dados.cor,
    dados.ativo,
    id
  );
  res.json({ fase: db.prepare('SELECT * FROM fases WHERE id = ?').get(id) });
});

const reordenarSchema = z.object({ ids: z.array(z.number().int()).min(1) });

router.patch('/reordenar/tudo', (req, res) => {
  const parsed = reordenarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  const atualizar = db.prepare('UPDATE fases SET ordem = ? WHERE id = ?');
  parsed.data.ids.forEach((id, index) => atualizar.run(index, id));
  res.json({ fases: db.prepare('SELECT * FROM fases ORDER BY ordem ASC').all() });
});

module.exports = router;
