const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('administrador'));

router.get('/', (req, res) => {
  const usuarios = db
    .prepare('SELECT id, nome, email, papel, status, criado_em FROM usuarios ORDER BY criado_em DESC')
    .all();
  res.json({ usuarios });
});

router.patch('/:id/aprovar', (req, res) => {
  const id = Number(req.params.id);
  const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  db.prepare("UPDATE usuarios SET status = 'aprovado' WHERE id = ?").run(id);
  res.json({ mensagem: 'Usuário aprovado.' });
});

const papelSchema = z.object({ papel: z.enum(['administrador', 'editor', 'leitor']) });

router.patch('/:id/papel', (req, res) => {
  const id = Number(req.params.id);
  const parsed = papelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Papel inválido.' });

  if (id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode alterar seu próprio papel.' });
  }
  const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  db.prepare('UPDATE usuarios SET papel = ? WHERE id = ?').run(parsed.data.papel, id);
  res.json({ mensagem: 'Papel atualizado.' });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode excluir seu próprio usuário.' });
  }
  const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  res.json({ mensagem: 'Usuário removido.' });
});

module.exports = router;
