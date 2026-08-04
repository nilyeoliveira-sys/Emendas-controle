const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const nomeUnico = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, nomeUnico);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post(
  '/:processoId',
  requireRole('administrador', 'editor'),
  upload.single('arquivo'),
  (req, res) => {
    const processoId = Number(req.params.processoId);
    const processo = db.prepare('SELECT id FROM processos WHERE id = ?').get(processoId);
    if (!processo) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ erro: 'Processo não encontrado.' });
    }
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });

    const info = db
      .prepare(
        `INSERT INTO anexos (processo_id, nome_original, nome_arquivo, tamanho, tipo_mime, enviado_por)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(processoId, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype, req.usuario.id);

    const anexo = db.prepare('SELECT * FROM anexos WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ anexo });
  }
);

router.get('/:id/download', (req, res) => {
  const anexo = db.prepare('SELECT * FROM anexos WHERE id = ?').get(Number(req.params.id));
  if (!anexo) return res.status(404).json({ erro: 'Anexo não encontrado.' });

  const caminho = path.join(uploadsDir, anexo.nome_arquivo);
  if (!fs.existsSync(caminho)) return res.status(404).json({ erro: 'Arquivo não encontrado no servidor.' });

  res.download(caminho, anexo.nome_original);
});

router.delete('/:id', requireRole('administrador', 'editor'), (req, res) => {
  const anexo = db.prepare('SELECT * FROM anexos WHERE id = ?').get(Number(req.params.id));
  if (!anexo) return res.status(404).json({ erro: 'Anexo não encontrado.' });

  const caminho = path.join(uploadsDir, anexo.nome_arquivo);
  if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
  db.prepare('DELETE FROM anexos WHERE id = ?').run(anexo.id);

  res.json({ mensagem: 'Anexo removido.' });
});

module.exports = router;
