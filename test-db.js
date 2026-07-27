const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_lCR4X7beoNKi@ep-royal-paper-at3n6bai-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});
async function check() {
  try {
    const res = await pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ''videos''');
    console.log('VIDEOS:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
