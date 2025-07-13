const crypto = require('crypto');
const { timingSafeStringCompare } = require('./timing-safe-utils');

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return timingSafeStringCompare(hash, verifyHash);
}

module.exports = {
  hashPassword,
  verifyPassword
};