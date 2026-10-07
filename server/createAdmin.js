const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./db');
require('dotenv').config();

async function createAdmin(usernameInput, passwordInput) {
  const username = usernameInput || process.env.ADMIN_USERNAME || 'admin';
  const password = passwordInput || process.env.ADMIN_PASSWORD || 'admin123';

  await initDatabase();

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const existing = await db.execute({
    sql: 'SELECT id, username FROM admins WHERE username = ? LIMIT 1',
    args: [username],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE admins SET password_hash = ? WHERE username = ?',
      args: [passwordHash, username],
    });
    console.log(`[Admin] Admin user "${username}" already exists. Password successfully updated.`);
  } else {
    await db.execute({
      sql: 'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      args: [username, passwordHash],
    });
    console.log(`[Admin] Admin user "${username}" created successfully.`);
  }

  console.log(`Credentials: Username = "${username}", Password = "${password}"`);
}

if (require.main === module) {
  const customUser = process.argv[2];
  const customPass = process.argv[3];
  createAdmin(customUser, customPass)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Admin] Error creating admin:', err);
      process.exit(1);
    });
}

module.exports = { createAdmin };
