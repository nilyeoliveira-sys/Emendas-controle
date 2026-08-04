const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const registrarSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  senha: z.string().min(6).max(72),
});

router.post('/registrar', (req, res) => {
  const parsed = registrarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });
  const { nome, email, senha } = parsed.data;

  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existente) return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' });

  const senhaHash = bcrypt.hashSync(senha, 10);
  db.prepare(
    'INSERT INTO usuarios (nome, email, senha_hash, papel, status) VALUES (?, ?, ?, ?, ?)'
  ).run(nome, email, senhaHash, 'leitor', 'pendente');

  res.status(201).json({ mensagem: 'Cadastro realizado. Aguarde aprovação de um administrador.' });
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  senha: z.string().min(1),
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });
  const { email, senha } = parsed.data;

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario || !bcrypt.compareSync(senha, usuario.senha_hash)) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }
  if (usuario.status !== 'aprovado') {
    return res.status(403).json({ erro: 'Cadastro ainda pendente de aprovação.' });
  }

  const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, cookieOpts());
  res.json({
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ mensagem: 'Sessão encerrada.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.usuario });
});

module.exports = router;
