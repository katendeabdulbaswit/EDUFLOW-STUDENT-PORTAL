import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("unisphere.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    role TEXT, -- 'student' or 'lecturer'
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT,
    code TEXT,
    lecturer_id TEXT,
    description TEXT,
    FOREIGN KEY(lecturer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    course_id TEXT,
    title TEXT,
    type TEXT, -- 'pdf', 'video', 'link'
    url TEXT,
    content TEXT,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT, -- 'todo', 'in-progress', 'done'
    user_id TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS schedule (
    id TEXT PRIMARY KEY,
    course_id TEXT,
    title TEXT,
    start_time TEXT,
    end_time TEXT,
    day_of_week INTEGER, -- 0-6
    FOREIGN KEY(course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT,
    receiver_id TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );
`);

// Seed data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare("INSERT INTO users (id, name, email, role, avatar) VALUES (?, ?, ?, ?, ?)");
  insertUser.run("1", "Dr. Sarah Smith", "sarah@uni.edu", "lecturer", "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah");
  insertUser.run("2", "John Doe", "john@uni.edu", "student", "https://api.dicebear.com/7.x/avataaars/svg?seed=John");

  const insertCourse = db.prepare("INSERT INTO courses (id, name, code, lecturer_id, description) VALUES (?, ?, ?, ?, ?)");
  insertCourse.run("c1", "Advanced Web Development", "CS301", "1", "Modern full-stack development with React and Node.js");
  insertCourse.run("c2", "Artificial Intelligence", "CS402", "1", "Introduction to machine learning and neural networks");

  const insertSchedule = db.prepare("INSERT INTO schedule (id, course_id, title, start_time, end_time, day_of_week) VALUES (?, ?, ?, ?, ?, ?)");
  insertSchedule.run("s1", "c1", "Lecture: React Hooks", "10:00", "12:00", 1); // Monday
  insertSchedule.run("s2", "c2", "Lab: Neural Nets", "14:00", "16:00", 3); // Wednesday

  const insertMaterial = db.prepare("INSERT INTO materials (id, course_id, title, type, url, content) VALUES (?, ?, ?, ?, ?, ?)");
  insertMaterial.run("m1", "c1", "Introduction to React", "pdf", "#", "Basics of React components and props.");
  insertMaterial.run("m2", "c1", "State Management", "video", "#", "Deep dive into useState and useReducer.");
  insertMaterial.run("m3", "c2", "Neural Networks 101", "pdf", "#", "Foundations of perceptrons and backpropagation.");
}

async function startServer() {
  const app = express();
  app.use(cors());
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Routes
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.get("/api/courses", (req, res) => {
    const courses = db.prepare("SELECT * FROM courses").all();
    res.json(courses);
  });

  app.get("/api/courses/:id/materials", (req, res) => {
    const materials = db.prepare("SELECT * FROM materials WHERE course_id = ?").all(req.params.id);
    res.json(materials);
  });

  app.get("/api/projects/:userId", (req, res) => {
    const projects = db.prepare("SELECT * FROM projects WHERE user_id = ?").all(req.params.userId);
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { id, title, description, status, userId } = req.body;
    db.prepare("INSERT INTO projects (id, title, description, status, user_id) VALUES (?, ?, ?, ?, ?)")
      .run(id, title, description, status, userId);
    res.json({ success: true });
  });

  app.get("/api/schedule", (req, res) => {
    const schedule = db.prepare(`
      SELECT s.*, c.name as course_name, c.code as course_code 
      FROM schedule s 
      JOIN courses c ON s.course_id = c.id
    `).all();
    res.json(schedule);
  });

  app.get("/api/messages/:userId1/:userId2", (req, res) => {
    const { userId1, userId2 } = req.params;
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) 
      OR (sender_id = ? AND receiver_id = ?)
      ORDER BY timestamp ASC
    `).all(userId1, userId2, userId2, userId1);
    res.json(messages);
  });

  app.post("/api/courses/:id/enroll", (req, res) => {
    const { userId } = req.body;
    const courseId = req.params.id;
    // In a real app, we'd have an enrollments table
    // For now, we'll just return success
    res.json({ success: true, message: `User ${userId} enrolled in ${courseId}` });
  });

  app.post("/api/courses/:id/materials", (req, res) => {
    const { title, type, url, content } = req.body;
    const courseId = req.params.id;
    const id = Math.random().toString(36).substr(2, 9);
    db.prepare("INSERT INTO materials (id, course_id, title, type, url, content) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, courseId, title, type, url, content);
    res.json({ success: true, materialId: id });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/register", (req, res) => {
    const { name, email, role } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    
    try {
      db.prepare("INSERT INTO users (id, name, email, role, avatar) VALUES (?, ?, ?, ?, ?)")
        .run(id, name, email, role, avatar);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  // Socket.io for real-time networking
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("send_message", (data) => {
      const { senderId, receiverId, content } = data;
      const id = Math.random().toString(36).substr(2, 9);
      db.prepare("INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)")
        .run(id, senderId, receiverId, content);
      io.emit("new_message", { id, senderId, receiverId, content, timestamp: new Date() });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  try {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`[UniSphere] Server is listening on 0.0.0.0:${PORT}`);
      console.log(`[UniSphere] Health check available at http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error("[UniSphere] Failed to start server:", err);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error("[UniSphere] Critical error during server startup:", err);
  process.exit(1);
});
