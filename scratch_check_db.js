const db = require('./backend/config/database');
async function run() {
    try {
        const res = await db.query('SELECT id, user_id, video_id, order_number, status, purchase_date FROM purchases ORDER BY purchase_date DESC LIMIT 5');
        console.log("LAST 5 PURCHASES:", res.rows);
    } catch(e) {
        console.error("ERROR:", e);
    }
    process.exit(0);
}
run();
