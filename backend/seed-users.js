require('dotenv').config();
const bcrypt = require('bcrypt');
const { centralPool } = require('./db');

async function main() {
  const seed = [
    { username: 'Radhesh', password: 'Radhesh@123', role: 'member',     org_ids: [1] },
    { username: 'Ramesh',  password: 'Ramesh@123',  role: 'admin',      org_ids: [1, 2] },
    { username: 'Raju',    password: 'Raju@123',    role: 'member',     org_ids: [2] },
    { username: 'Shubham', password: 'Shubham@123', role: 'superAdmin', org_ids: [1, 2, 3, 4, 5] },
    { username: 'Priya',   password: 'Priya@123',   role: 'admin',      org_ids: [3] },
    { username: 'Karan',   password: 'Karan@123',   role: 'admin',      org_ids: [4] },
    { username: 'Anita',   password: 'Anita@123',   role: 'admin',      org_ids: [5] },
  ];

  for (const u of seed) {
    const hash = await bcrypt.hash(u.password, 10);
    await centralPool.query(
      `UPDATE users SET password = $1, role = $2, org_ids = $3 WHERE username = $4`,
      [hash, u.role, u.org_ids, u.username]
    );
    console.log(`✔ Updated ${u.username}`);
  }

  console.log('Done. Login credentials:');
  seed.forEach((u) => console.log(`   ${u.username} / ${u.password}  (${u.role})`));
  await centralPool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});