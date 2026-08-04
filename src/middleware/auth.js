const jwt = require('jsonwebtoken');
const db = require('../db');

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ erro: 'Não autenticado.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = db.prepare('SELECT id, nome, email, papel, status FROM usuarios WHERE id = ?').get(payload.id);
    if (!usuario || usuario.status !== 'aprovado') {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }
    req.usuario = usuario;
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }
}

function requireRole(...papeis) {
  return (req, res, next) => {
    if (!req.usuario || !papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Sem permissão para esta ação.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
