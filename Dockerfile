# ใช้ PostgreSQL เวอร์ชันล่าสุดเป็นฐาน
FROM postgres:latest

# ตั้งค่าตัวแปรสภาพแวดล้อม
ENV POSTGRES_DB=mydatabase
ENV POSTGRES_USER=myuser
ENV POSTGRES_PASSWORD=10102024

# ถ้าคุณต้องการใช้ init.sql ให้ตรวจสอบว่าไฟล์อยู่ในตำแหน่งที่ถูกต้อง
# และคงบรรทัดนี้ไว้


# เปิดพอร์ต 5432 สำหรับการเชื่อมต่อ
EXPOSE 5432

# ไม่จำเป็นต้องระบุ CMD เพราะ image หลักของ PostgreSQL จะจัดการให้
