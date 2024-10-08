require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// เพิ่ม middleware สำหรับ parsing JSON
app.use(express.json());

// เพิ่ม middleware สำหรับ CORS
app.use(cors());

// เพิ่ม middleware สำหรับ serving static files
app.use(express.static('public'));

// กำหนดค่าการเชื่อมต่อกับฐานข้อมูล
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// ทดสอบการเชื่อมต่อ
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้:', err);
  } else {
    console.log('เชื่อมต่อกับฐานข้อมูลสำเร็จ');
  }
});

// แก้ไข GET endpoint สำหรับหน้าแรก
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/webtest.html');
});

// สร้าง GET endpoint สำหรับดึงข้อมูล users
app.get('/users', async (req, res) => {
  try {
    const query = 'SELECT id, username, email FROM users';
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
    
    // ตรวจสอบว่าอีเมลมีอยู่แล้วหรือไม่
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }
    
    // ถ้าไม่มีอีเมลซ้ำ ดำเนินการเพิ่มผู้ใช้ใหม่
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการเพิ่ม user:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเพิ่มผู้ใช้' });
  }
});

// PUT endpoint สำหรับอัปเดต user ทั้งหมด
app.put('/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { username, email, password } = req.body;
      let query = 'UPDATE users SET';
      const values = [];
      let paramCount = 1;
  
      if (username) {
        query += ` username = $${paramCount},`;
        values.push(username);
        paramCount++;
      }
      if (email) {
        query += ` email = $${paramCount},`;
        values.push(email);
        paramCount++;
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += ` password = $${paramCount},`;
        values.push(hashedPassword);
        paramCount++;
      }
  
      // ลบเครื่องหมาย , ตัวสุดท้ายออก
      query = query.slice(0, -1);
  
      query += ` WHERE id = $${paramCount} RETURNING id, username, email`;
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
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id, username, email';
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