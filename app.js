const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 5000;

// เพิ่ม middleware สำหรับ parsing JSON
app.use(express.json());

// กำหนดค่าการเชื่อมต่อกับฐานข้อมูล
const pool = new Pool({
  user: 'myuser',
  host: 'localhost',
  database: 'mydatabase',
  password: '10102024',
  port: 5432,
});

// สร้าง GET endpoint สำหรับดึงข้อมูล users
app.get('/users', async (req, res) => {
  try {
    const query = 'SELECT username, email FROM users';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการดึงข้อมูล users:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// POST endpoint สำหรับเพิ่ม user ใหม่
app.post('/users', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const query = 'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *';
    const values = [username, email, password];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการเพิ่ม user:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// PUT endpoint สำหรับอัปเดต user ทั้งหมด
app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password } = req.body;
    const query = 'UPDATE users SET username = $1, email = $2, password = $3 WHERE id = $4 RETURNING *';
    const values = [username, email, password, id];
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ user' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการอัปเดต user:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// PATCH endpoint สำหรับอัปเดต user บางส่วน
app.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password } = req.body;
    let query = 'UPDATE users SET';
    const values = [];
    let setClause = [];

    if (username) {
      values.push(username);
      setClause.push(`username = $${values.length}`);
    }
    if (email) {
      values.push(email);
      setClause.push(`email = $${values.length}`);
    }
    if (password) {
      values.push(password);
      setClause.push(`password = $${values.length}`);
    }

    query += ` ${setClause.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    values.push(id);

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ user' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการอัปเดต user:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// DELETE endpoint สำหรับลบ user
app.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM users WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ user' });
    }
    res.json({ message: 'ลบ user สำเร็จ', deletedUser: result.rows[0] });
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการลบ user:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// เริ่มต้น server
app.listen(port, () => {
  console.log(`เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${port}`);
});

