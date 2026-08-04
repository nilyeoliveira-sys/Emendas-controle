const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbFile = process.env.DATABASE_FILE || './data/emendas.db';
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(dbFile);
db.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
