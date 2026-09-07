const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const mesRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

function mesAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

function carregarContasDoMes(mes) {
  const contas = db
    .prepare('SELECT * FROM contas_pagar WHERE ativo = 1 ORDER BY dia_vencimento IS NULL, dia_vencimento ASC, descricao ASC')
    .all();

  const pagamentos = db
    .prepare('SELECT * FROM contas_pagamentos WHERE mes_referencia = ?')
    .all(mes);
  const pagamentosPorConta = new Map(pagamentos.map((p) => [p.conta_id, p]));

  return contas.map((conta) => {
    const pagamento = pagamentosPorConta.get(conta.id) || null;
    return {
      ...conta,
      pago: !!(pagamento && pagamento.pago),
      data_pagamento: pagamento?.data_pagamento || null,
      banco_pagamento: pagamento?.banco || null,
      valor_pago: pagamento?.valor_pago ?? null,
    };
  });
}

router.get('/', (req, res) => {
  const mes = mesRegex.test(req.query.mes) ? req.query.mes : mesAtual();
  const contas = carregarContasDoMes(mes);
  res.json({ mes, contas });
});

const contaSchema = z.object({
  descricao: z.string().trim().min(2).max(160),
  valor: z.number().nonnegative().default(0),
  dia_vencimento: z.number().int().min(1).max(31).optional().nullable(),
  banco: z.string().trim().max(80).optional().nullable(),
  categoria: z.string().trim().max(60).optional().nullable(),
});

router.post('/', (req, res) => {
  const parsed = contaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });
  const d = parsed.data;

  const info = db
    .prepare(
      `INSERT INTO contas_pagar (descricao, valor, dia_vencimento, banco, categoria, criado_por)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(d.descricao, d.valor, d.dia_vencimento ?? null, d.banco ?? null, d.categoria ?? null, req.usuario.id);

  const conta = db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ conta });
});

const atualizarSchema = contaSchema.partial();

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existente = db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(id);
  if (!existente) return res.status(404).json({ erro: 'Conta não encontrada.' });

  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });
  const d = { ...existente, ...parsed.data };

  db.prepare(
    `UPDATE contas_pagar SET descricao = ?, valor = ?, dia_vencimento = ?, banco = ?, categoria = ? WHERE id = ?`
  ).run(d.descricao, d.valor, d.dia_vencimento ?? null, d.banco ?? null, d.categoria ?? null, id);

  res.json({ conta: db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(id) });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existente = db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(id);
  if (!existente) return res.status(404).json({ erro: 'Conta não encontrada.' });

  db.prepare('UPDATE contas_pagar SET ativo = 0 WHERE id = ?').run(id);
  res.json({ mensagem: 'Conta removida.' });
});

const pagarSchema = z.object({
  mes_referencia: z.string().regex(mesRegex),
  data_pagamento: z.string().trim().min(1).max(30),
  banco: z.string().trim().max(80).optional().nullable(),
  valor_pago: z.number().nonnegative().optional().nullable(),
});

router.post('/:id/pagar', (req, res) => {
  const id = Number(req.params.id);
  const conta = db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(id);
  if (!conta) return res.status(404).json({ erro: 'Conta não encontrada.' });

  const parsed = pagarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });
  const d = parsed.data;

  db.prepare(
    `INSERT INTO contas_pagamentos (conta_id, mes_referencia, pago, data_pagamento, banco, valor_pago, usuario_id, atualizado_em)
     VALUES (?, ?, 1, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(conta_id, mes_referencia) DO UPDATE SET
       pago = 1, data_pagamento = excluded.data_pagamento, banco = excluded.banco,
       valor_pago = excluded.valor_pago, usuario_id = excluded.usuario_id, atualizado_em = datetime('now')`
  ).run(id, d.mes_referencia, d.data_pagamento, d.banco ?? conta.banco ?? null, d.valor_pago ?? conta.valor, req.usuario.id);

  res.json({ contas: carregarContasDoMes(d.mes_referencia) });
});

const desfazerSchema = z.object({
  mes_referencia: z.string().regex(mesRegex),
});

router.post('/:id/desfazer', (req, res) => {
  const id = Number(req.params.id);
  const conta = db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(id);
  if (!conta) return res.status(404).json({ erro: 'Conta não encontrada.' });

  const parsed = desfazerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.' });

  db.prepare('DELETE FROM contas_pagamentos WHERE conta_id = ? AND mes_referencia = ?').run(id, parsed.data.mes_referencia);

  res.json({ contas: carregarContasDoMes(parsed.data.mes_referencia) });
});

module.exports = router;
