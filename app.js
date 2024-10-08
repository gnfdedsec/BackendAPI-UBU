require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // เพิ่มการ import jwt
const path = require('path');

console.log('ACCESS_TOKEN_SECRET:', process.env.ACCESS_TOKEN_SECRET);

const app = express();
const port = process.env.PORT || 5000;

// เพิ่ม secret key สำหรับ JWT (ควรเก็บไว้ใน .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// เพิ่ม middleware สำหรับ parsing JSON
app.use(express.json());

// ใช้ middleware เพื่อแยกข้อมูลจากฟอร์ม
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

// ย้ายฟังก์ชัน authenticateToken มาไว้ตรงนี้
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('Received token:', token);

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification error:', err.message);
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

// สร้าง GET endpoint สำหรับดึงข้อมูล users
app.get('/users', authenticateToken, async (req, res) => {
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
app.post('/users', authenticateToken, async (req, res) => {
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
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
      [username, email, hashedPassword]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการเพิ่ม user:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเพิ่มผู้ใช้' });
  }
});

// PUT endpoint สำหรับอัปเดต user ทั้งหมด
app.put('/users/:id', authenticateToken, async (req, res) => {
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
app.patch('/users/:id', authenticateToken, async (req, res) => {
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
app.delete('/users/:id', authenticateToken, async (req, res) => {
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

// สมมติว่านี่คือฐานข้อมูลผู้ใช้ของเรา (ในความเป็นจริงควรใช้ฐานข้อมูลจริง)
const users = [
  { username: 'user1', password: '$2b$10$EXAMPLE_HASHED_PASSWORD' }
];

// แสดงหน้าฟอร์มล็อกอิน
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// เพิ่มฟังก์ชัน generateToken
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '1h' }
  );
}

// จัดการการล็อกอิน
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('ข้อมูลที่ส่งมา:', req.body);

  try {
    // ค้นหาผู้ใช้จาก PostgreSQL
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = generateToken(user);
    res.json({ token });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการล็อกอิน:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการล็อกอิน' });
  }
});

// เริ่มต้น server
app.listen(port, () => {
  console.log(`เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${port}`);
});

// Add middleware to log auth header and token
app.use((req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return next();

  console.log('Received token:', token);
  console.log('Using ACCESS_TOKEN_SECRET:', process.env.ACCESS_TOKEN_SECRET);

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ error: 'Token ไม่ถูกต้อง' });
  }
});

// เพิ่ม endpoint สำหรับเพิ่มผู้ใช้งานเริ่มต้น
app.post('/add-username', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // ตรวจสอบว่ามีข้อมูลครบถ้วนหรือไม่
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ตรวจสอบว่า username หรือ email มีอยู่แล้วหรือไม่
    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว' });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // เพิ่มผู้ใช้ใหม่ลงในฐานข้อมูล
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    res.status(201).json({
      message: 'เพิ่มผู้ใช้งานสำเร็จ',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน' });
  }
});

// เพิ่มเส้นทางสำหรับไฟล์ static
app.use(express.static(path.join(__dirname, 'public')));

// เพิ่มเส้นทางสำหรับ /webtest
app.get('/webtest', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'webtest.html'));
});