import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, Query } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, Course, TimetableEntry, Resource, AttendanceRecord, Result, Announcement, UserRole, Enrollment, AppNotification, Note, Flashcard } from './types';
import { 
  LayoutDashboard, 
  Calendar, 
  BookOpen, 
  CheckSquare, 
  BarChart3, 
  Megaphone, 
  Users, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  XCircle,
  Sparkles,
  Send,
  Bot,
  ChevronRight,
  User as UserIcon,
  Bell,
  FileText,
  Clock,
  MapPin,
  Search,
  Filter,
  Info,
  Menu,
  Minus,
  X,
  Check,
  Headphones,
  Library,
  Music,
  Play,
  Pause,
  Volume2,
  FileSearch,
  Brain,
  StickyNote,
  Notebook
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Safe date formatting
const safeFormat = (dateStr: string | undefined, formatStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format(date, formatStr);
  } catch (e) {
    return 'Error';
  }
};

// --- Mock Data for Offline/Demo Mode ---
const MOCK_DATA = {
  courses: [
    { id: 'demo-robotics', name: 'Introduction to Robotics', code: 'ROB101', lecturerId: 'dev-user-id', description: 'A foundational course on robotics, covering sensors, actuators, and control systems. Students will learn about robot kinematics, dynamics, and basic control algorithms.' },
    { id: 'demo-cs101', name: 'Computer Science 101', code: 'CS101', lecturerId: 'dev-user-id', description: 'Introduction to programming and computer science concepts. This course covers the basics of Python, data structures, and algorithmic thinking.' },
    { 
      id: 'demo-ai', 
      name: 'Artificial Intelligence', 
      code: 'AI301', 
      lecturerId: 'student-1', 
      description: 'Exploration of AI techniques including machine learning, neural networks, and natural language processing.',
      outline: [
        {
          id: 'm1',
          title: 'Module 1: Introduction to AI',
          topics: ['History of AI', 'Intelligent Agents', 'State Space Search'],
          readings: ['Artificial Intelligence: A Modern Approach (Russell & Norvig), Chapter 1-3']
        },
        {
          id: 'm2',
          title: 'Module 2: Machine Learning Foundations',
          topics: ['Supervised vs Unsupervised Learning', 'Linear Regression', 'Decision Trees'],
          readings: ['Pattern Recognition and Machine Learning (Bishop), Chapter 1']
        },
        {
          id: 'm3',
          title: 'Module 3: Neural Networks and Deep Learning',
          topics: ['Perceptrons', 'Backpropagation', 'Convolutional Neural Networks (CNNs)'],
          readings: ['Deep Learning (Goodfellow et al.), Chapter 6-9']
        },
        {
          id: 'm4',
          title: 'Module 4: Natural Language Processing',
          topics: ['Tokenization', 'Word Embeddings', 'Transformers'],
          readings: ['Speech and Language Processing (Jurafsky & Martin), Chapter 2-4']
        }
      ]
    },
  ],
  timetable: [
    { id: 't1', courseId: 'demo-robotics', courseName: 'Introduction to Robotics', day: 'Monday', startTime: '09:00', endTime: '11:00', room: 'Lab 1' },
    { id: 't2', courseId: 'demo-cs101', courseName: 'Computer Science 101', day: 'Wednesday', startTime: '14:00', endTime: '16:00', room: 'Room 302' },
  ],
  announcements: [
    { id: 'a1', title: 'Welcome to EduFlow', content: 'We are excited to have you here! Explore your courses and timetable.', createdAt: new Date().toISOString(), targetRole: 'all', authorId: 'dev-user-id' },
    { id: 'a2', title: 'Robotics Lab Maintenance', content: 'The robotics lab will be closed for maintenance this Friday.', createdAt: new Date().toISOString(), targetRole: 'student', authorId: 'dev-user-id' },
  ],
  resources: [
    { id: 'r1', title: 'Robotics Basics PDF', type: 'pdf', courseId: 'demo-robotics', url: '#', uploadedAt: new Date().toISOString() },
    { id: 'r2', title: 'CS101 Lecture 1 Slides', type: 'link', courseId: 'demo-cs101', url: '#', uploadedAt: new Date().toISOString() },
  ],
  results: [
    { id: 'res1', studentId: 'dev-user-id', courseId: 'demo-robotics', grade: 'A', marks: 92, semester: 'Fall 2025' },
  ],
  attendance: [
    { id: 'att1', studentId: 'dev-user-id', courseId: 'demo-robotics', date: new Date().toISOString(), status: 'present' },
  ],
  users: [
    { uid: 'dev-user-id', name: 'Developer', email: 'katendeabdulbaswit@gmail.com', role: 'admin', isApproved: true },
    { uid: 'student-1', name: 'John Doe', email: 'john@example.com', role: 'student', isApproved: true },
    { uid: 'student-2', name: 'Jane Doe', email: 'jane@example.com', role: 'student', isApproved: true },
  ],
  enrollments: [],
  notifications: [],
  notes: [],
  flashcards: []
};

const useCollection = <T extends { id?: string; uid?: string }>(
  collectionName: keyof typeof MOCK_DATA, 
  queryFn?: (data: T[]) => T[],
  firestoreQuery?: Query
) => {
  const [data, setData] = useState<T[]>(MOCK_DATA[collectionName] as T[]);
  const [loading, setLoading] = useState(true);
  const queryFnRef = useRef(queryFn);

  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  useEffect(() => {
    const q = firestoreQuery || collection(db, collectionName);
    const unsub = onSnapshot(q, (snapshot) => {
      const firestoreData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      setData(queryFnRef.current ? queryFnRef.current(firestoreData) : firestoreData);
      setLoading(false);
    }, (err) => {
      console.warn(`Firestore ${collectionName} failed (offline mode):`, err);
      setData(queryFnRef.current ? queryFnRef.current(MOCK_DATA[collectionName] as T[]) : MOCK_DATA[collectionName] as T[]);
      setLoading(false);
    });
    return unsub;
  }, [collectionName, firestoreQuery]);

  return data;
};

// --- Contexts ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const RoleSwitcher = () => {
  const { profile, setRole } = useAuth();
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-2 items-center">
      <span className="text-xs font-bold text-gray-400 px-2 uppercase">Dev Role:</span>
      {(['student', 'lecturer', 'admin'] as UserRole[]).map((role) => (
        <button
          key={role}
          onClick={() => setRole(role)}
          className={cn(
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            profile?.role === role 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </button>
      ))}
    </div>
  );
};

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
      secondary: 'bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-100',
      outline: 'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div 
    className={cn('bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden', className)}
    {...props}
  >
    {children}
  </div>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
);

const Textarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
);

const Select = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500',
      className
    )}
    {...props}
  >
    {children}
  </select>
);

const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger'; className?: string }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
};

// --- AI Assistant ---
const AIAssistant = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'sources'>('chat');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const timetable = useCollection<TimetableEntry>(
    'timetable', 
    undefined,
    profile?.role === 'student' 
      ? query(collection(db, 'timetable'), where('userId', '==', profile.uid))
      : undefined
  );
  const courses = useCollection<Course>('courses');
  const enrollments = useCollection<Enrollment>('enrollments');
  const resources = useCollection<Resource>('resources');
  const notifications = useCollection<AppNotification>(
    'notifications', 
    undefined,
    profile ? query(collection(db, 'notifications'), where('userId', '==', profile.uid)) : undefined
  );
  const notes = useCollection<Note>(
    'notes', 
    undefined,
    profile ? query(collection(db, 'notes'), where('userId', '==', profile.uid)) : undefined
  );
  const flashcards = useCollection<Flashcard>(
    'flashcards', 
    undefined,
    profile ? query(collection(db, 'flashcards'), where('userId', '==', profile.uid)) : undefined
  );

  const studentCourses = courses.filter(c => enrollments.some(e => e.courseId === c.id && e.studentId === profile?.uid));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const generateAudioOverview = async () => {
    if (selectedSources.length === 0) return alert('Please select at least one source first.');
    setIsGeneratingAudio(true);
    setAudioUrl(null);

    try {
      const { GoogleGenAI, Modality } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

      const sourceContent = selectedSources.map(id => {
        const course = courses.find(c => c.id === id);
        if (course) {
          return `Course: ${course.name} (${course.code})\nDescription: ${course.description}\nOutline: ${JSON.stringify(course.outline || [])}`;
        }
        const resource = resources.find(r => r.id === id);
        if (resource) {
          return `Resource: ${resource.title} (Type: ${resource.type})`;
        }
        const note = notes.find(n => n.id === id);
        if (note) {
          return `Note: ${note.title}\nContent: ${note.content}`;
        }
        const flashcard = flashcards.find(f => f.id === id);
        if (flashcard) {
          return `Flashcard: Front: ${flashcard.front}, Back: ${flashcard.back}`;
        }
        return '';
      }).join('\n\n');

      const prompt = `Generate a 2-speaker podcast-style conversation between "Alex" and "Jordan" summarizing the following course materials. 
      Alex is enthusiastic and Jordan is more analytical. 
      They should discuss the key topics, modules, and how they relate to each other.
      Keep it engaging and educational.
      
      Materials:
      ${sourceContent}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    } catch (error) {
      console.error('Audio Generation Error:', error);
      alert('Failed to generate audio overview. Please try again.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const { GoogleGenAI, Type } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

      const tools = [
        {
          functionDeclarations: [
            {
              name: "get_timetable_markdown",
              description: "Get the current timetable formatted as a markdown table.",
              parameters: { type: Type.OBJECT, properties: {} }
            },
            {
              name: "get_timetable",
              description: "Get the current timetable for the student.",
              parameters: { type: Type.OBJECT, properties: {} }
            },
            {
              name: "add_timetable_entry",
              description: "Add a new entry to the timetable.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  courseId: { type: Type.STRING, description: "The ID of the course." },
                  day: { type: Type.STRING, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
                  startTime: { type: Type.STRING, description: "Start time in HH:MM format." },
                  endTime: { type: Type.STRING, description: "End time in HH:MM format." },
                  room: { type: Type.STRING, description: "The room location." }
                },
                required: ["courseId", "day", "startTime", "endTime", "room"]
              }
            },
            {
              name: "update_timetable_entry",
              description: "Update an existing timetable entry.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "The ID of the timetable entry to update." },
                  courseId: { type: Type.STRING },
                  day: { type: Type.STRING, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
                  startTime: { type: Type.STRING },
                  endTime: { type: Type.STRING },
                  room: { type: Type.STRING }
                },
                required: ["id"]
              }
            },
            {
              name: "delete_timetable_entry",
              description: "Delete a timetable entry.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "The ID of the timetable entry to delete." }
                },
                required: ["id"]
              }
            },
            {
              name: "get_courses",
              description: "Get the list of all available courses.",
              parameters: { type: Type.OBJECT, properties: {} }
            },
            {
              name: "get_student_enrollments",
              description: "Get the courses the current student is enrolled in.",
              parameters: { type: Type.OBJECT, properties: {} }
            },
            {
              name: "get_notifications",
              description: "Get the current notifications for the user.",
              parameters: { type: Type.OBJECT, properties: {} }
            },
            {
              name: "delete_notification",
              description: "Delete a notification.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "The ID of the notification to delete." }
                },
                required: ["id"]
              }
            },
            {
              name: "add_note",
              description: "Add a new study note.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  courseId: { type: Type.STRING, description: "The ID of the course." },
                  title: { type: Type.STRING, description: "The title of the note." },
                  content: { type: Type.STRING, description: "The content of the note." }
                },
                required: ["courseId", "title", "content"]
              }
            },
            {
              name: "get_notes",
              description: "Get all study notes for the current student.",
              parameters: { type: Type.OBJECT, properties: {} }
            },
            {
              name: "delete_note",
              description: "Delete a study note.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "The ID of the note to delete." }
                },
                required: ["id"]
              }
            },
            {
              name: "add_flashcard",
              description: "Add a new study flashcard.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  courseId: { type: Type.STRING, description: "The ID of the course." },
                  front: { type: Type.STRING, description: "The front side of the flashcard (question)." },
                  back: { type: Type.STRING, description: "The back side of the flashcard (answer)." }
                },
                required: ["courseId", "front", "back"]
              }
            },
            {
              name: "get_flashcards",
              description: "Get all study flashcards for the current student.",
              parameters: { type: Type.OBJECT, properties: {} }
            },
            {
              name: "delete_flashcard",
              description: "Delete a study flashcard.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "The ID of the flashcard to delete." }
                },
                required: ["id"]
              }
            }
          ]
        }
      ];

      const sourceContent = selectedSources.map(id => {
        const course = courses.find(c => c.id === id);
        if (course) return `Course: ${course.name} (${course.code})\nDescription: ${course.description}\nOutline: ${JSON.stringify(course.outline || [])}`;
        const resource = resources.find(r => r.id === id);
        if (resource) return `Resource: ${resource.title} (Type: ${resource.type})`;
        const note = notes.find(n => n.id === id);
        if (note) return `Note: ${note.title}\nContent: ${note.content}`;
        const flashcard = flashcards.find(f => f.id === id);
        if (flashcard) return `Flashcard: Front: ${flashcard.front}, Back: ${flashcard.back}`;
        return '';
      }).join('\n\n');

      const systemInstruction = `You are EduFlow AI, a helpful university study assistant with NotebookLM-style features.
      You have access to the student's timetable, courses, and enrollments.
      The current user is ${profile?.name} (${profile?.email}) with role ${profile?.role}.
      
      GROUNDING SOURCES:
      ${selectedSources.length > 0 ? `The user has selected the following sources to ground your answers in:\n${sourceContent}` : "No specific sources selected. Use general knowledge or tools."}
      
      CAPABILITIES:
      - You can suggest reading plans, manage the timetable, and answer academic questions.
      - You can MANIPULATE the timetable: add, update, and delete entries.
      - You can MANAGE notifications: view and delete them.
      - You can CREATE and MANAGE study notes and flashcards.
      - You can ANALYZE notes and course materials to generate flashcards or summaries.
      - You can provide VISUAL TIMETABLES using markdown tables.
      
      GUIDELINES:
      - When asked for a timetable, ALWAYS use the 'get_timetable_markdown' tool or format the data into a clear markdown table yourself.
      - When adding or updating timetable entries, ensure the courseId is valid (use 'get_courses' if unsure).
      - Always prioritize information from the selected sources if available.
      - Be encouraging and professional.`;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        config: {
          systemInstruction,
          tools,
        }
      });

      let responseText = result.text;
      const functionCalls = result.functionCalls;

      if (functionCalls) {
        const functionResponses = [];
        for (const call of functionCalls) {
          let functionResult;
          if (call.name === "get_timetable_markdown") {
            const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            let md = "| Day | Time | Course | Room |\n| --- | --- | --- | --- |\n";
            const sortedEntries = [...timetable].sort((a, b) => {
              const dayDiff = days.indexOf(a.day) - days.indexOf(b.day);
              if (dayDiff !== 0) return dayDiff;
              return a.startTime.localeCompare(b.startTime);
            });
            sortedEntries.forEach(e => {
              md += `| ${e.day} | ${e.startTime} - ${e.endTime} | ${e.courseName} | ${e.room} |\n`;
            });
            functionResult = md;
          } else if (call.name === "get_timetable") {
            functionResult = timetable;
          } else if (call.name === "get_courses") {
            functionResult = courses;
          } else if (call.name === "get_student_enrollments") {
            const studentEnrollments = enrollments.filter(e => e.studentId === profile?.uid);
            functionResult = courses.filter(c => studentEnrollments.some(e => e.courseId === c.id));
          } else if (call.name === "get_notifications") {
            functionResult = notifications;
          } else if (call.name === "add_timetable_entry") {
            const course = courses.find(c => c.id === call.args.courseId);
            const data = { 
              ...call.args, 
              courseName: course?.name || 'Unknown Course',
              userId: profile?.uid,
              createdAt: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'timetable'), data);
            await updateDoc(docRef, { id: docRef.id });
            functionResult = { status: "success", message: "Timetable entry added." };
          } else if (call.name === "update_timetable_entry") {
            const { id, ...data } = call.args;
            if (data.courseId) {
              const course = courses.find(c => c.id === data.courseId);
              (data as any).courseName = course?.name || 'Unknown Course';
            }
            await updateDoc(doc(db, 'timetable', id as string), data);
            functionResult = { status: "success", message: "Timetable entry updated." };
          } else if (call.name === "delete_timetable_entry") {
            await deleteDoc(doc(db, 'timetable', call.args.id as string));
            functionResult = { status: "success", message: "Timetable entry deleted." };
          } else if (call.name === "delete_notification") {
            await deleteDoc(doc(db, 'notifications', call.args.id as string));
            functionResult = { status: "success", message: "Notification deleted." };
          } else if (call.name === "add_note") {
            const data = { ...call.args, userId: profile?.uid, createdAt: new Date().toISOString() };
            const docRef = await addDoc(collection(db, 'notes'), data);
            await updateDoc(docRef, { id: docRef.id });
            functionResult = { status: "success", message: "Note added." };
          } else if (call.name === "get_notes") {
            functionResult = notes.filter(n => n.userId === profile?.uid);
          } else if (call.name === "delete_note") {
            await deleteDoc(doc(db, 'notes', call.args.id as string));
            functionResult = { status: "success", message: "Note deleted." };
          } else if (call.name === "add_flashcard") {
            const data = { ...call.args, userId: profile?.uid, createdAt: new Date().toISOString() };
            const docRef = await addDoc(collection(db, 'flashcards'), data);
            await updateDoc(docRef, { id: docRef.id });
            functionResult = { status: "success", message: "Flashcard added." };
          } else if (call.name === "get_flashcards") {
            functionResult = flashcards.filter(f => f.userId === profile?.uid);
          } else if (call.name === "delete_flashcard") {
            await deleteDoc(doc(db, 'flashcards', call.args.id as string));
            functionResult = { status: "success", message: "Flashcard deleted." };
          }
          
          functionResponses.push({
            name: call.name,
            response: { result: functionResult },
            id: call.id
          });
        }

        const finalResult = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            { role: 'user', parts: [{ text: userMsg }] },
            result.candidates[0].content,
            { role: 'user', parts: functionResponses.map(res => ({ functionResponse: res })) }
          ],
          config: { systemInstruction, tools }
        });
        responseText = finalResult.text;
      }

      setMessages(prev => [...prev, { role: 'ai', content: responseText || "I've processed your request." }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleSource = (id: string) => {
    setSelectedSources(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all z-40"
      >
        {isOpen ? <XCircle size={28} /> : <Sparkles size={28} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-40"
          >
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">EduFlow Notebook AI</h3>
                  <p className="text-[10px] text-white/70">Grounded Study Assistant</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setActiveTab('chat')}
                  className={cn("p-2 rounded-lg transition-colors", activeTab === 'chat' ? "bg-white/20" : "hover:bg-white/10")}
                >
                  <Send size={16} />
                </button>
                <button 
                  onClick={() => setActiveTab('sources')}
                  className={cn("p-2 rounded-lg transition-colors", activeTab === 'sources' ? "bg-white/20" : "hover:bg-white/10")}
                >
                  <Library size={16} />
                </button>
              </div>
            </div>

            {activeTab === 'chat' ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
                  {messages.length === 0 && (
                    <div className="text-center py-10 space-y-2">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                        <Sparkles size={24} />
                      </div>
                      <p className="text-sm font-medium text-gray-900">Welcome to your Notebook</p>
                      <p className="text-xs text-gray-500 px-6">Select sources in the Library tab to ground my answers in your course materials.</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                        msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-gray-800 border border-gray-200 rounded-tl-none"
                      )}>
                        {msg.role === 'ai' ? (
                          <div className="prose prose-sm max-w-none prose-indigo prose-p:leading-relaxed prose-table:border-collapse prose-th:border prose-th:p-2 prose-td:border prose-td:p-2">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 flex gap-2">
                  <Input
                    placeholder={selectedSources.length > 0 ? "Ask about your sources..." : "Type your question..."}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" disabled={isTyping}>
                    <Send size={18} />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <Library size={18} className="text-indigo-600" />
                      Sources ({selectedSources.length})
                    </h4>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs gap-2"
                      onClick={generateAudioOverview}
                      disabled={isGeneratingAudio || selectedSources.length === 0}
                    >
                      {isGeneratingAudio ? (
                        <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Headphones size={14} />
                      )}
                      Audio Overview
                    </Button>
                  </div>

                  {audioUrl && (
                    <div className="mb-6 p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center">
                        <Music size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-indigo-900">Audio Overview Ready</p>
                        <audio ref={audioRef} src={audioUrl} controls className="h-8 w-full mt-1" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Courses</p>
                    {studentCourses.map(course => (
                      <div 
                        key={course.id}
                        onClick={() => toggleSource(course.id)}
                        className={cn(
                          "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                          selectedSources.includes(course.id) 
                            ? "bg-indigo-50 border-indigo-200" 
                            : "bg-white border-gray-100 hover:border-indigo-100 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", selectedSources.includes(course.id) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400")}>
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{course.name}</p>
                            <p className="text-[10px] text-gray-500">{course.code}</p>
                          </div>
                        </div>
                        {selectedSources.includes(course.id) && <Check size={16} className="text-indigo-600" />}
                      </div>
                    ))}

                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-6">Resources</p>
                    {resources.filter(r => studentCourses.some(c => c.id === r.courseId)).map(res => (
                      <div 
                        key={res.id}
                        onClick={() => toggleSource(res.id)}
                        className={cn(
                          "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                          selectedSources.includes(res.id) 
                            ? "bg-indigo-50 border-indigo-200" 
                            : "bg-white border-gray-100 hover:border-indigo-100 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", selectedSources.includes(res.id) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400")}>
                            <FileText size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{res.title}</p>
                            <p className="text-[10px] text-gray-500 uppercase">{res.type}</p>
                          </div>
                        </div>
                        {selectedSources.includes(res.id) && <Check size={16} className="text-indigo-600" />}
                      </div>
                    ))}

                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-6">Your Notes</p>
                    {notes.filter(n => n.userId === profile?.uid).map(note => (
                      <div 
                        key={note.id}
                        onClick={() => toggleSource(note.id)}
                        className={cn(
                          "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                          selectedSources.includes(note.id) 
                            ? "bg-indigo-50 border-indigo-200" 
                            : "bg-white border-gray-100 hover:border-indigo-100 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", selectedSources.includes(note.id) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400")}>
                            <StickyNote size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{note.title}</p>
                            <p className="text-[10px] text-gray-500">NOTE</p>
                          </div>
                        </div>
                        {selectedSources.includes(note.id) && <Check size={16} className="text-indigo-600" />}
                      </div>
                    ))}

                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-6">Flashcards</p>
                    {flashcards.filter(f => f.userId === profile?.uid).map(fc => (
                      <div 
                        key={fc.id}
                        onClick={() => toggleSource(fc.id)}
                        className={cn(
                          "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                          selectedSources.includes(fc.id) 
                            ? "bg-indigo-50 border-indigo-200" 
                            : "bg-white border-gray-100 hover:border-indigo-100 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", selectedSources.includes(fc.id) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400")}>
                            <Brain size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{fc.front.substring(0, 30)}...</p>
                            <p className="text-[10px] text-gray-500">FLASHCARD</p>
                          </div>
                        </div>
                        {selectedSources.includes(fc.id) && <Check size={16} className="text-indigo-600" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// --- Auth Provider ---
const DEV_PROFILE: UserProfile = {
  uid: 'dev-user-id',
  name: 'Developer',
  email: 'katendeabdulbaswit@gmail.com',
  role: 'admin',
  isApproved: true
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          // New user - default to student for now, or show role selection
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            role: 'student',
            isApproved: true,
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    await signInWithGoogle();
  };

  const signOut = async () => {
    await logout();
  };

  const setRole = async (role: UserRole) => {
    const updatedProfile = { ...profile!, role };
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { role });
    }
    setProfile(updatedProfile);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Layout ---
const Sidebar = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { profile, signOut } = useAuth();
  const location = window.location.pathname;

  const developerEmail = 'katendeabdulbaswit@gmail.com';
  const isDeveloper = profile?.email === developerEmail;

  const menuItems = {
    student: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: Calendar, label: 'Timetable', path: '/timetable' },
      { icon: BookOpen, label: 'Courses', path: '/courses' },
      { icon: Users, label: 'Students', path: '/students' },
      { icon: UserIcon, label: 'Lecturers', path: '/lecturers' },
      { icon: FileText, label: 'Resources', path: '/resources' },
      { icon: CheckSquare, label: 'Attendance', path: '/attendance' },
      { icon: BarChart3, label: 'Results', path: '/results' },
      { icon: StickyNote, label: 'My Notes', path: '/notes' },
      { icon: Brain, label: 'Flashcards', path: '/flashcards' },
      { icon: Megaphone, label: 'Announcements', path: '/announcements' },
      { icon: Bell, label: 'Notifications', path: '/notifications' },
      ...(isDeveloper ? [
        { icon: Plus, label: 'Manage Courses (Dev)', path: '/courses' },
        { icon: FileText, label: 'Manage Resources (Dev)', path: '/resources' },
      ] : [])
    ],
    lecturer: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: BookOpen, label: 'My Courses', path: '/courses' },
      { icon: Users, label: 'Students', path: '/students' },
      { icon: UserIcon, label: 'Lecturers', path: '/lecturers' },
      { icon: FileText, label: 'Manage Resources', path: '/resources' },
      { icon: Calendar, label: 'Manage Timetable', path: '/timetable' },
      { icon: Megaphone, label: 'Announcements', path: '/announcements' },
      { icon: BarChart3, label: 'Student Results', path: '/results' },
      { icon: Bell, label: 'Notifications', path: '/notifications' },
    ],
    admin: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: BookOpen, label: 'Manage Courses', path: '/courses' },
      { icon: Users, label: 'Manage Users', path: '/users' },
      { icon: Users, label: 'Students', path: '/students' },
      { icon: UserIcon, label: 'Lecturers', path: '/lecturers' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
      { icon: Settings, label: 'System Settings', path: '/settings' },
      { icon: Bell, label: 'Notifications', path: '/notifications' },
    ],
  };

  const roleItems = profile ? menuItems[profile.role] : [];

  const sidebarClasses = cn(
    "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
    isOpen ? "translate-x-0" : "-translate-x-full"
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className={sidebarClasses}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <BookOpen size={20} />
            </div>
            EduFlow
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {roleItems.map((item) => (
            <Link
              key={`${item.label}-${item.path}`}
              to={item.path}
              onClick={() => onClose()}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location === item.path 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <UserIcon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.name}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{profile?.role}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={signOut}>
            <LogOut size={18} />
            Sign Out
          </Button>
        </div>
      </div>
    </>
  );
};

const Header = ({ title, onMenuClick }: { title: string, onMenuClick: () => void }) => {
  const { profile, signOut } = useAuth();
  const notifications = useCollection<AppNotification>(
    'notifications', 
    (data) => data.filter(n => !n.read),
    profile ? query(collection(db, 'notifications'), where('userId', '==', profile.uid)) : undefined
  );
  const unreadCount = notifications.length;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <Menu size={20} />
        </button>
        <h1 className="text-lg lg:text-xl font-semibold text-gray-900 truncate max-w-[150px] lg:max-w-none">{title}</h1>
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        <Link to="/notifications" className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
        <div className="h-8 w-px bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{profile?.name}</span>
          </div>
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600 hidden sm:flex" onClick={signOut}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
};

const TimetablePage = () => {
  const { profile } = useAuth();
  const entries = useCollection<TimetableEntry>(
    'timetable', 
    undefined,
    profile?.role === 'student' 
      ? query(collection(db, 'timetable'), where('userId', '==', profile.uid))
      : undefined
  );
  const courses = useCollection<Course>('courses');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<TimetableEntry> | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !profile) return;
    try {
      const course = courses.find(c => c.id === editingEntry.courseId);
      const data = { 
        ...editingEntry, 
        courseName: course?.name || '',
        userId: profile.uid,
        createdAt: new Date().toISOString()
      };
      if (editingEntry.id) {
        await updateDoc(doc(db, 'timetable', editingEntry.id), data);
      } else {
        const docRef = await addDoc(collection(db, 'timetable'), data);
        await updateDoc(docRef, { id: docRef.id });
      }
      setIsModalOpen(false);
      setEditingEntry(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'timetable');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      await deleteDoc(doc(db, 'timetable', id));
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Class Timetable</h2>
        {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
          <Button onClick={() => { setEditingEntry({ day: 'Monday' }); setIsModalOpen(true); }} className="gap-2" size="sm">
            <Plus size={18} /> <span className="hidden sm:inline">Add Entry</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {days.map(day => (
          <div key={day} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">{day}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries
                .filter(e => e.day === day)
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                .map(entry => (
                <Card key={entry.id} className="p-4 border-l-4 border-l-indigo-600 relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-900">{entry.courseName || 'Unknown Course'}</h4>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Clock size={14} /> {entry.startTime} - {entry.endTime}
                        </p>
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <MapPin size={14} /> {entry.room}
                        </p>
                      </div>
                    </div>
                    {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }} className="p-1 text-gray-400 hover:text-indigo-600">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(entry.id)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              {entries.filter(e => e.day === day).length === 0 && (
                <p className="text-sm text-gray-400 italic">No classes scheduled.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <Card className="w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-6">{editingEntry?.id ? 'Edit Entry' : 'Add Timetable Entry'}</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                    <Select 
                      required 
                      value={editingEntry?.courseId || ''} 
                      onChange={e => setEditingEntry({ ...editingEntry!, courseId: e.target.value })}
                    >
                      <option value="">Select a course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                    <Select 
                      required 
                      value={editingEntry?.day || 'Monday'} 
                      onChange={e => setEditingEntry({ ...editingEntry!, day: e.target.value as any })}
                    >
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <Input type="time" required value={editingEntry?.startTime || ''} onChange={e => setEditingEntry({ ...editingEntry!, startTime: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <Input type="time" required value={editingEntry?.endTime || ''} onChange={e => setEditingEntry({ ...editingEntry!, endTime: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                    <Input required placeholder="e.g. Room 302" value={editingEntry?.room || ''} onChange={e => setEditingEntry({ ...editingEntry!, room: e.target.value })} />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">Save Entry</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ResourcesPage = () => {
  const { profile } = useAuth();
  const resources = useCollection<Resource>('resources');
  const courses = useCollection<Course>('courses');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newResource, setNewResource] = useState<Partial<Resource>>({ type: 'PDF' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'resources'), {
        ...newResource,
        uploadedAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setNewResource({ type: 'PDF' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'resources');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this resource?')) {
      await deleteDoc(doc(db, 'resources', id));
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Learning Resources</h2>
        {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2" size="sm">
            <Plus size={18} /> <span className="hidden sm:inline">Upload Resource</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map(res => (
          <Card key={res.id} className="p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <FileText size={24} />
              </div>
              {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
                <button onClick={() => handleDelete(res.id)} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <div className="mt-4">
              <h4 className="font-bold text-gray-900 truncate">{res.title}</h4>
              <p className="text-xs text-indigo-600 font-medium mt-1">
                {courses.find(c => c.id === res.courseId)?.name || 'Course'}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-500">{safeFormat(res.uploadedAt, 'MMM d, yyyy')}</span>
                <a href={res.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    Download <ChevronRight size={14} />
                  </Button>
                </a>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <Card className="w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-6">Upload Resource</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                    <Select required value={newResource.courseId || ''} onChange={e => setNewResource({ ...newResource, courseId: e.target.value })}>
                      <option value="">Select a course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <Input required placeholder="e.g. Lecture 1: Introduction" value={newResource.title || ''} onChange={e => setNewResource({ ...newResource, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resource URL</label>
                    <Input required type="url" placeholder="https://..." value={newResource.url || ''} onChange={e => setNewResource({ ...newResource, url: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <Select value={newResource.type || 'PDF'} onChange={e => setNewResource({ ...newResource, type: e.target.value })}>
                      <option value="PDF">PDF</option>
                      <option value="Video">Video</option>
                      <option value="Link">External Link</option>
                      <option value="Document">Document</option>
                    </Select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">Upload</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AttendancePage = () => {
  const { profile } = useAuth();
  const records = useCollection<AttendanceRecord>(
    'attendance', 
    undefined, 
    profile?.role === 'student' ? query(collection(db, 'attendance'), where('studentId', '==', profile.uid)) : undefined
  );
  const courses = useCollection<Course>('courses');
  const students = useCollection<UserProfile>('users', (data) => data.filter(u => u.role === 'student'));
  const [selectedCourse, setSelectedCourse] = useState('');

  const markAttendance = async (studentId: string, status: 'present' | 'absent') => {
    if (!selectedCourse) return alert('Select a course first');
    const date = format(new Date(), 'yyyy-MM-dd');
    const existing = records.find(r => r.studentId === studentId && r.courseId === selectedCourse && r.date === date);
    
    try {
      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.id), { status });
      } else {
        await addDoc(collection(db, 'attendance'), {
          studentId,
          courseId: selectedCourse,
          date,
          status
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Attendance Tracking</h2>
      
      {profile?.role !== 'student' ? (
        <div className="space-y-6">
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Select Course:</label>
              <Select className="max-w-xs" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
                <option value="">Select a course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </Select>
              <p className="text-sm text-gray-500 ml-auto">Date: {format(new Date(), 'MMM d, yyyy')}</p>
            </div>
          </Card>

          <Card>
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map(student => {
                  const record = records.find(r => r.studentId === student.uid && r.courseId === selectedCourse && r.date === format(new Date(), 'yyyy-MM-dd'));
                  return (
                    <tr key={student.uid}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{student.email}</td>
                      <td className="px-6 py-4 text-center">
                        {record ? (
                          <Badge variant={record.status === 'present' ? 'success' : 'danger'}>
                            {record.status.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">Not Marked</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant={record?.status === 'present' ? 'primary' : 'outline'}
                            onClick={() => markAttendance(student.uid, 'present')}
                          >
                            Present
                          </Button>
                          <Button 
                            size="sm" 
                            variant={record?.status === 'absent' ? 'danger' : 'outline'}
                            onClick={() => markAttendance(student.uid, 'absent')}
                          >
                            Absent
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => {
            const courseRecords = records.filter(r => r.studentId === profile.uid && r.courseId === course.id);
            const presentCount = courseRecords.filter(r => r.status === 'present').length;
            const totalCount = courseRecords.length;
            const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

            return (
              <Card key={course.id} className="p-6">
                <h4 className="font-bold text-gray-900">{course.name}</h4>
                <p className="text-xs text-gray-500 mb-4">{course.code}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Attendance</span>
                    <span className={cn('font-bold', percentage < 75 ? 'text-red-600' : 'text-green-600')}>{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className={cn('h-2 rounded-full', percentage < 75 ? 'bg-red-500' : 'bg-green-500')} 
                      style={{ width: `${percentage}%` }} 
                    />
                  </div>
                  <p className="text-xs text-gray-400">{presentCount} present out of {totalCount} total classes</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ResultsPage = () => {
  const { profile } = useAuth();
  const results = useCollection<Result>(
    'results', 
    undefined, 
    profile?.role === 'student' ? query(collection(db, 'results'), where('studentId', '==', profile.uid)) : undefined
  );
  const courses = useCollection<Course>('courses');
  const students = useCollection<UserProfile>('users', (data) => data.filter(u => u.role === 'student'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newResult, setNewResult] = useState<Partial<Result>>({});

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'results'), newResult);
      setIsModalOpen(false);
      setNewResult({});
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'results');
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Academic Results</h2>
        {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2" size="sm">
            <Plus size={18} /> <span className="hidden sm:inline">Add Result</span>
          </Button>
        )}
      </div>

      <Card>
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Course</th>
              {profile?.role !== 'student' && <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>}
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Semester</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.filter(r => profile?.role === 'student' ? r.studentId === profile.uid : true).map(res => (
              <tr key={res.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {courses.find(c => c.id === res.courseId)?.name || 'Course'}
                </td>
                {profile?.role !== 'student' && (
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {students.find(s => s.uid === res.studentId)?.name || 'Student'}
                  </td>
                )}
                <td className="px-6 py-4 text-sm text-gray-500">{res.semester}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{res.marks}</td>
                <td className="px-6 py-4 text-right">
                  <span className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold',
                    res.marks >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  )}>
                    {res.grade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <Card className="w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-6">Add Student Result</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                    <Select required value={newResult.courseId || ''} onChange={e => setNewResult({ ...newResult, courseId: e.target.value })}>
                      <option value="">Select a course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                    <Select required value={newResult.studentId || ''} onChange={e => setNewResult({ ...newResult, studentId: e.target.value })}>
                      <option value="">Select a student</option>
                      {students.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                      <Input type="number" required value={newResult.marks || ''} onChange={e => setNewResult({ ...newResult, marks: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                      <Input required placeholder="e.g. A, B+" value={newResult.grade || ''} onChange={e => setNewResult({ ...newResult, grade: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <Input required placeholder="e.g. Fall 2025" value={newResult.semester || ''} onChange={e => setNewResult({ ...newResult, semester: e.target.value })} />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">Save Result</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AnnouncementsPage = () => {
  const { profile } = useAuth();
  const announcements = useCollection<Announcement>('announcements', (data) => 
    data.filter(ann => ['all', profile?.role || 'student'].includes(ann.targetRole))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAnn, setNewAnn] = useState<Partial<Announcement>>({ targetRole: 'all' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const annRef = await addDoc(collection(db, 'announcements'), {
        ...newAnn,
        authorId: profile?.uid,
        createdAt: new Date().toISOString()
      });
      await updateDoc(annRef, { id: annRef.id });

      // Create notifications for target audience
      // In a real app, this would be a cloud function.
      // For this demo, we'll notify the current user if they match the role
      // and maybe a few others if we want to simulate.
      // But let's just notify all students/lecturers if the role matches.
      // Note: This could be slow if there are many users.
      const targetUsers = await getDocs(query(collection(db, 'users'), where('role', '==', newAnn.targetRole === 'all' ? 'student' : newAnn.targetRole)));
      
      const notificationPromises = targetUsers.docs.map(userDoc => {
        return addDoc(collection(db, 'notifications'), {
          userId: userDoc.id,
          title: 'New Announcement',
          message: newAnn.title || 'A new announcement has been posted.',
          type: 'announcement',
          read: false,
          createdAt: new Date().toISOString(),
          link: '/announcements'
        });
      });
      
      await Promise.all(notificationPromises);

      setIsModalOpen(false);
      setNewAnn({ targetRole: 'all' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'announcements');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this announcement?')) {
      await deleteDoc(doc(db, 'announcements', id));
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Announcements</h2>
        {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2" size="sm">
            <Plus size={18} /> <span className="hidden sm:inline">New Announcement</span>
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {announcements.map(ann => (
          <Card key={ann.id} className="p-6 relative group">
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Megaphone size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-gray-900">{ann.title}</h3>
                    <Badge variant={ann.targetRole === 'all' ? 'default' : 'warning'}>
                      {ann.targetRole.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap">{ann.content}</p>
                  <p className="text-xs text-gray-400 mt-4">
                    Posted on {safeFormat(ann.createdAt, 'MMMM d, yyyy • h:mm a')}
                  </p>
                </div>
              </div>
              {(profile?.role === 'admin' || (profile?.role === 'lecturer' && ann.authorId === profile.uid)) && (
                <button onClick={() => handleDelete(ann.id)} className="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </Card>
        ))}
        {announcements.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mx-auto mb-4">
              <Megaphone size={40} />
            </div>
            <p className="text-gray-500">No announcements found.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <Card className="w-full max-w-2xl p-6">
                <h3 className="text-xl font-bold mb-6">Post New Announcement</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <Input required placeholder="Announcement Title" value={newAnn.title || ''} onChange={e => setNewAnn({ ...newAnn, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                    <Select value={newAnn.targetRole || 'all'} onChange={e => setNewAnn({ ...newAnn, targetRole: e.target.value as any })}>
                      <option value="all">Everyone</option>
                      <option value="student">Students Only</option>
                      <option value="lecturer">Lecturers Only</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea 
                      required 
                      className="w-full h-40 rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Write your announcement here..."
                      value={newAnn.content || ''}
                      onChange={e => setNewAnn({ ...newAnn, content: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">Post Announcement</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NotificationsPage = () => {
  const { profile } = useAuth();
  const notifications = useCollection<AppNotification>(
    'notifications', 
    (data) => data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    profile ? query(collection(db, 'notifications'), where('userId', '==', profile.uid)) : undefined
  );

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    const promises = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
    await Promise.all(promises);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <Megaphone size={20} className="text-blue-500" />;
      case 'deadline': return <Clock size={20} className="text-orange-500" />;
      case 'enrollment': return <BookOpen size={20} className="text-green-500" />;
      default: return <Bell size={20} className="text-gray-500" />;
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
        {notifications.some(n => !n.read) && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
            <Check size={16} /> Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.map(n => (
          <Card 
            key={n.id} 
            className={`p-4 transition-all hover:shadow-md border-l-4 ${n.read ? 'border-l-gray-200 bg-white' : 'border-l-indigo-600 bg-indigo-50/30'}`}
          >
            <div className="flex gap-4">
              <div className="mt-1">{getIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h3 className={`font-semibold text-gray-900 truncate ${!n.read ? 'font-bold' : ''}`}>{n.title}</h3>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{safeFormat(n.createdAt, 'MMM d, h:mm a')}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                <div className="flex gap-4 mt-3">
                  {n.link && (
                    <Link to={n.link} className="text-xs font-medium text-indigo-600 hover:underline">
                      View Details
                    </Link>
                  )}
                  {!n.read && (
                    <button onClick={() => markAsRead(n.id)} className="text-xs font-medium text-gray-500 hover:text-indigo-600">
                      Mark as read
                    </button>
                  )}
                  <button onClick={() => deleteNotification(n.id)} className="text-xs font-medium text-gray-400 hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-4">
              <Bell size={32} />
            </div>
            <p className="text-gray-500 font-medium">No notifications yet.</p>
            <p className="text-sm text-gray-400">We'll let you know when something important happens.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const NotesPage = () => {
  const { profile } = useAuth();
  const notes = useCollection<Note>(
    'notes', 
    undefined,
    profile ? query(collection(db, 'notes'), where('userId', '==', profile.uid)) : undefined
  );
  const courses = useCollection<Course>('courses');
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', courseId: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const docRef = await addDoc(collection(db, 'notes'), {
        ...newNote,
        userId: profile.uid,
        createdAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
      setIsAdding(false);
      setNewNote({ title: '', content: '', courseId: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notes');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this note?')) {
      try {
        await deleteDoc(doc(db, 'notes', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'notes');
      }
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">My Study Notes</h2>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus size={18} /> New Note
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notes.map(note => (
          <Card key={note.id} className="p-6 flex flex-col h-64 hover:shadow-md transition-all border-t-4 border-t-indigo-600">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <StickyNote size={20} />
              </div>
              <button onClick={() => handleDelete(note.id)} className="text-gray-400 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </div>
            <h3 className="font-bold text-gray-900 mb-1 truncate">{note.title}</h3>
            <p className="text-xs text-indigo-600 font-medium mb-3">
              {courses.find(c => c.id === note.courseId)?.name || 'General'}
            </p>
            <p className="text-sm text-gray-600 line-clamp-4 flex-1">{note.content}</p>
            <p className="text-[10px] text-gray-400 mt-4">{safeFormat(note.createdAt, 'MMM d, yyyy')}</p>
          </Card>
        ))}
        {notes.length === 0 && (
          <div className="col-span-full text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <StickyNote size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No notes yet.</p>
            <p className="text-sm text-gray-400">Use the AI Assistant to help you analyze materials and create notes!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6">Create New Note</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Course</label>
                  <Select 
                    required 
                    value={newNote.courseId} 
                    onChange={e => setNewNote({...newNote, courseId: e.target.value})}
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <Input 
                    required 
                    value={newNote.title} 
                    onChange={e => setNewNote({...newNote, title: e.target.value})} 
                    placeholder="Note Title" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Content</label>
                  <textarea 
                    required 
                    className="w-full p-3 border border-gray-200 rounded-xl h-40 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newNote.content} 
                    onChange={e => setNewNote({...newNote, content: e.target.value})} 
                    placeholder="Write your study notes here..."
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Save Note</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FlashcardsPage = () => {
  const { profile } = useAuth();
  const flashcards = useCollection<Flashcard>(
    'flashcards', 
    undefined,
    profile ? query(collection(db, 'flashcards'), where('userId', '==', profile.uid)) : undefined
  );
  const courses = useCollection<Course>('courses');
  const [isAdding, setIsAdding] = useState(false);
  const [newCard, setNewCard] = useState({ front: '', back: '', courseId: '' });
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const docRef = await addDoc(collection(db, 'flashcards'), {
        ...newCard,
        userId: profile.uid,
        createdAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
      setIsAdding(false);
      setNewCard({ front: '', back: '', courseId: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'flashcards');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this flashcard?')) {
      try {
        await deleteDoc(doc(db, 'flashcards', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'flashcards');
      }
    }
  };

  const toggleFlip = (id: string) => {
    setFlipped(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
      `}</style>
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Study Flashcards</h2>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus size={18} /> New Flashcard
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flashcards.map(card => (
          <div key={card.id} className="perspective-1000 h-64 relative group">
            <motion.div 
              animate={{ rotateY: flipped[card.id] ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
              className="w-full h-full relative preserve-3d cursor-pointer"
              onClick={() => toggleFlip(card.id)}
            >
              {/* Front */}
              <Card className="absolute inset-0 backface-hidden p-6 flex flex-col items-center justify-center text-center bg-white border-2 border-indigo-100 shadow-lg">
                <div className="absolute top-4 left-4 p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                  <Brain size={16} />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }} 
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Question</p>
                <p className="text-lg font-bold text-gray-900">{card.front}</p>
                <p className="text-[10px] text-gray-400 mt-auto">Click to flip</p>
              </Card>

              {/* Back */}
              <Card className="absolute inset-0 backface-hidden p-6 flex flex-col items-center justify-center text-center bg-indigo-600 text-white border-2 border-indigo-700 shadow-lg [transform:rotateY(180deg)]">
                <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-4">Answer</p>
                <p className="text-lg font-medium">{card.back}</p>
                <p className="text-[10px] text-white/50 mt-auto">Click to flip back</p>
              </Card>
            </motion.div>
          </div>
        ))}
        {flashcards.length === 0 && (
          <div className="col-span-full text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Brain size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No flashcards yet.</p>
            <p className="text-sm text-gray-400">Ask the AI to generate flashcards from your notes or course materials!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6">Create New Flashcard</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Course</label>
                  <Select 
                    required 
                    value={newCard.courseId} 
                    onChange={e => setNewCard({...newCard, courseId: e.target.value})}
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Front (Question)</label>
                  <textarea 
                    required 
                    className="w-full p-3 border border-gray-200 rounded-xl h-24 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newCard.front} 
                    onChange={e => setNewCard({...newCard, front: e.target.value})} 
                    placeholder="What is the question?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Back (Answer)</label>
                  <textarea 
                    required 
                    className="w-full p-3 border border-gray-200 rounded-xl h-24 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newCard.back} 
                    onChange={e => setNewCard({...newCard, back: e.target.value})} 
                    placeholder="What is the answer?"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Create Card</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CoursesPage = () => {
  const { profile } = useAuth();
  const courses = useCollection<Course>('courses');
  const lecturers = useCollection<UserProfile>('users', (data) => data.filter(u => u.role === 'lecturer'));
  const enrollments = useCollection<Enrollment>('enrollments');
  const students = useCollection<UserProfile>('users', (data) => data.filter(u => u.role === 'student'));
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [viewingStudentsFor, setViewingStudentsFor] = useState<string | null>(null);
  const [viewingDetailsFor, setViewingDetailsFor] = useState<Course | null>(null);
  const [editingOutlineFor, setEditingOutlineFor] = useState<Course | null>(null);
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [lecturerFilter, setLecturerFilter] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [showOnlyEnrolled, setShowOnlyEnrolled] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    try {
      if (editingCourse.id) {
        await updateDoc(doc(db, 'courses', editingCourse.id), editingCourse);
      } else {
        const docRef = await addDoc(collection(db, 'courses'), editingCourse);
        await updateDoc(docRef, { id: docRef.id });
      }
      setIsModalOpen(false);
      setEditingCourse(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this course?')) {
      await deleteDoc(doc(db, 'courses', id));
    }
  };

  const toggleEnrollment = async (courseId: string) => {
    if (!profile) return;
    const existing = enrollments.find(e => e.courseId === courseId && e.studentId === profile.uid);
    const course = courses.find(c => c.id === courseId);

    if (existing) {
      await deleteDoc(doc(db, 'enrollments', existing.id));
    } else {
      const docRef = await addDoc(collection(db, 'enrollments'), {
        studentId: profile.uid,
        courseId,
        enrolledAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });

      // Notify lecturer
      if (course?.lecturerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: course.lecturerId,
          title: 'New Enrollment',
          message: `${profile.name} has enrolled in your course: ${course.name}`,
          type: 'enrollment',
          read: false,
          createdAt: new Date().toISOString(),
          link: '/courses'
        });
      }
    }
  };

  const getEnrolledStudents = (courseId: string) => {
    const studentIds = enrollments.filter(e => e.courseId === courseId).map(e => e.studentId);
    return students.filter(s => studentIds.includes(s.uid));
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          course.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLecturer = lecturerFilter === '' || course.lecturerId === lecturerFilter;
    const matchesCode = codeFilter === '' || course.code.toLowerCase().includes(codeFilter.toLowerCase());
    
    const isEnrolled = enrollments.some(e => e.courseId === course.id && e.studentId === profile?.uid);
    const matchesEnrolled = !showOnlyEnrolled || isEnrolled;

    // Lecturers now have full access to see all courses
    const isLecturerView = profile?.role === 'lecturer';
    const isAdminOrStudentView = profile?.role === 'admin' || profile?.role === 'student';
    
    return matchesSearch && matchesLecturer && matchesCode && matchesEnrolled && (isAdminOrStudentView || isLecturerView);
  });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
          {profile?.role === 'admin' || profile?.role === 'lecturer' ? 'Manage Courses' : 'Available Courses'}
        </h2>
        {(profile?.role === 'admin' || profile?.role === 'lecturer') && (
          <Button onClick={() => { setEditingCourse({}); setIsModalOpen(true); }} className="gap-2" size="sm">
            <Plus size={18} /> <span className="hidden sm:inline">Add Course</span>
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card className="p-4 bg-white/50 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
              className="pl-10" 
              placeholder="Search by name or code..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Select 
              className="pl-10"
              value={lecturerFilter}
              onChange={e => setLecturerFilter(e.target.value)}
            >
              <option value="">All Lecturers</option>
              {lecturers.map(l => <option key={l.uid} value={l.uid}>{l.name}</option>)}
            </Select>
          </div>
          <Input 
            placeholder="Filter by Course Code..." 
            value={codeFilter}
            onChange={e => setCodeFilter(e.target.value)}
          />
          {profile?.role === 'student' && (
            <div className="flex items-center gap-2 px-2">
              <input 
                type="checkbox" 
                id="showEnrolled" 
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                checked={showOnlyEnrolled}
                onChange={e => setShowOnlyEnrolled(e.target.checked)}
              />
              <label htmlFor="showEnrolled" className="text-sm font-medium text-gray-700 cursor-pointer">
                Show only my enrolled courses
              </label>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map(course => {
          const isEnrolled = enrollments.some(e => e.courseId === course.id && e.studentId === profile?.uid);
          const enrolledCount = enrollments.filter(e => e.courseId === course.id).length;
          const isOwnCourse = profile?.role === 'lecturer' && course.lecturerId === profile.uid;

          return (
            <Card key={course.id} className="p-6 relative group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <BookOpen size={24} />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setViewingDetailsFor(course)}>
                    <Info size={18} className="text-gray-400 hover:text-indigo-600" />
                  </Button>
                  {(profile?.role === 'admin' || isOwnCourse) && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingOutlineFor(course)}>
                      <FileText size={18} className="text-gray-400 hover:text-indigo-600" />
                    </Button>
                  )}
                  {isOwnCourse && (
                    <Button variant="ghost" size="sm" onClick={() => setViewingStudentsFor(course.id)}>
                      <Users size={18} className="text-gray-400 hover:text-indigo-600" />
                    </Button>
                  )}
                  {(profile?.role === 'admin' || profile?.role === 'lecturer') && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingCourse(course); setIsModalOpen(true); }}>
                      <Edit size={18} className="text-gray-400 hover:text-indigo-600" />
                    </Button>
                  )}
                  {(profile?.role === 'admin' || profile?.role === 'lecturer') && (
                    <button onClick={() => handleDelete(course.id)} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{course.name}</h3>
                <p className="text-sm text-indigo-600 font-medium mb-2">{course.code}</p>
                {course.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">{course.description}</p>
                )}
              </div>
              
              <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Lecturer</p>
                  <p className="text-sm text-gray-700">{lecturers.find(l => l.uid === course.lecturerId)?.name || 'Unassigned'}</p>
                </div>
                {profile?.role === 'student' && (
                  <Button 
                    size="sm" 
                    variant={isEnrolled ? 'outline' : 'primary'}
                    onClick={() => toggleEnrollment(course.id)}
                  >
                    {isEnrolled ? 'Unenroll' : 'Enroll'}
                  </Button>
                )}
                {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Students</p>
                    <p className="text-sm font-bold text-indigo-600">{enrolledCount}</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        {filteredCourses.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <p className="text-gray-500">No courses found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Course Details Modal */}
      <AnimatePresence>
        {viewingDetailsFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-2xl">
              <Card className="p-4 lg:p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <BookOpen size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{viewingDetailsFor.name}</h3>
                      <p className="text-lg text-indigo-600 font-medium">{viewingDetailsFor.code}</p>
                    </div>
                  </div>
                  <button onClick={() => setViewingDetailsFor(null)} className="text-gray-400 hover:text-gray-600">
                    <XCircle size={28} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</h4>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-gray-700 leading-relaxed">
                        {viewingDetailsFor.description || 'No description provided for this course.'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Lecturer</h4>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                          {lecturers.find(l => l.uid === viewingDetailsFor.lecturerId)?.name.charAt(0) || '?'}
                        </div>
                        <p className="font-medium text-gray-900">
                          {lecturers.find(l => l.uid === viewingDetailsFor.lecturerId)?.name || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Enrollment Status</h4>
                      <Badge variant={enrollments.some(e => e.courseId === viewingDetailsFor.id && e.studentId === profile?.uid) ? 'success' : 'default'} className="text-sm py-1 px-3">
                        {enrollments.some(e => e.courseId === viewingDetailsFor.id && e.studentId === profile?.uid) ? 'Enrolled' : 'Not Enrolled'}
                      </Badge>
                    </div>
                  </div>

                  {viewingDetailsFor.outline && viewingDetailsFor.outline.length > 0 && (
                    <div className="pt-4">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Course Outline</h4>
                      <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                        {viewingDetailsFor.outline.map((module, idx) => (
                          <div key={module.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <h5 className="font-bold text-gray-900 mb-2">{module.title}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Topics</p>
                                <ul className="list-disc list-inside text-sm text-gray-600">
                                  {module.topics.map((t, i) => <li key={i}>{t}</li>)}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Recommended Readings</p>
                                <ul className="list-disc list-inside text-sm text-gray-600">
                                  {module.readings.map((r, i) => <li key={i}>{r}</li>)}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                  <Button onClick={() => setViewingDetailsFor(null)}>Close Details</Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Course Outline Editor Modal */}
      <AnimatePresence>
        {editingOutlineFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <Card className="p-6 lg:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Edit Course Outline: {editingOutlineFor.name}</h3>
                  <button onClick={() => setEditingOutlineFor(null)}><XCircle size={24} /></button>
                </div>

                <div className="space-y-6">
                  {(editingOutlineFor.outline || []).map((module, mIdx) => (
                    <Card key={module.id} className="p-4 bg-gray-50 border-gray-200">
                      <div className="flex justify-between items-start mb-4">
                        <Input 
                          placeholder="Module Title (e.g., Module 1: Introduction)" 
                          value={module.title}
                          onChange={e => {
                            const newOutline = [...(editingOutlineFor.outline || [])];
                            newOutline[mIdx].title = e.target.value;
                            setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                          }}
                          className="font-bold text-lg"
                        />
                        <Button variant="ghost" size="sm" onClick={() => {
                          const newOutline = (editingOutlineFor.outline || []).filter((_, i) => i !== mIdx);
                          setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                        }}>
                          <Trash2 size={18} className="text-red-500" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Topics</label>
                          <div className="space-y-2">
                            {module.topics.map((topic, tIdx) => (
                              <div key={tIdx} className="flex gap-2">
                                <Input 
                                  value={topic}
                                  onChange={e => {
                                    const newOutline = [...(editingOutlineFor.outline || [])];
                                    newOutline[mIdx].topics[tIdx] = e.target.value;
                                    setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                                  }}
                                />
                                <Button variant="ghost" size="sm" onClick={() => {
                                  const newOutline = [...(editingOutlineFor.outline || [])];
                                  newOutline[mIdx].topics = newOutline[mIdx].topics.filter((_, i) => i !== tIdx);
                                  setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                                }}>
                                  <Minus size={14} />
                                </Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => {
                              const newOutline = [...(editingOutlineFor.outline || [])];
                              newOutline[mIdx].topics.push('');
                              setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                            }}>
                              <Plus size={14} className="mr-2" /> Add Topic
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Recommended Readings</label>
                          <div className="space-y-2">
                            {module.readings.map((reading, rIdx) => (
                              <div key={rIdx} className="flex gap-2">
                                <Input 
                                  value={reading}
                                  onChange={e => {
                                    const newOutline = [...(editingOutlineFor.outline || [])];
                                    newOutline[mIdx].readings[rIdx] = e.target.value;
                                    setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                                  }}
                                />
                                <Button variant="ghost" size="sm" onClick={() => {
                                  const newOutline = [...(editingOutlineFor.outline || [])];
                                  newOutline[mIdx].readings = newOutline[mIdx].readings.filter((_, i) => i !== rIdx);
                                  setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                                }}>
                                  <Minus size={14} />
                                </Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => {
                              const newOutline = [...(editingOutlineFor.outline || [])];
                              newOutline[mIdx].readings.push('');
                              setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                            }}>
                              <Plus size={14} className="mr-2" /> Add Reading
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}

                  <Button variant="outline" className="w-full border-dashed py-6" onClick={() => {
                    const newOutline = [...(editingOutlineFor.outline || []), {
                      id: Math.random().toString(36).substr(2, 9),
                      title: '',
                      topics: [''],
                      readings: ['']
                    }];
                    setEditingOutlineFor({...editingOutlineFor, outline: newOutline});
                  }}>
                    <Plus size={20} className="mr-2" /> Add New Module
                  </Button>
                </div>

                <div className="mt-8 pt-6 border-t flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setEditingOutlineFor(null)}>Cancel</Button>
                  <Button onClick={async () => {
                    if (editingOutlineFor.id) {
                      try {
                        await updateDoc(doc(db, 'courses', editingOutlineFor.id), { outline: editingOutlineFor.outline });
                        setEditingOutlineFor(null);
                      } catch (err) {
                        handleFirestoreError(err, OperationType.WRITE, 'courses');
                      }
                    }
                  }}>Save Outline</Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enrolled Students Modal */}
      <AnimatePresence>
        {viewingStudentsFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md">
              <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Enrolled Students</h3>
                  <button onClick={() => setViewingStudentsFor(null)} className="text-gray-400 hover:text-gray-600">
                    <XCircle size={24} />
                  </button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {getEnrolledStudents(viewingStudentsFor).length > 0 ? (
                    getEnrolledStudents(viewingStudentsFor).map(student => (
                      <div key={student.uid} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.email}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">No students enrolled yet.</p>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Course Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <Card className="w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-6">{editingCourse?.id ? 'Edit Course' : 'Add New Course'}</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
                    <Input 
                      required 
                      disabled={profile?.role !== 'admin'}
                      placeholder="e.g. Data Structures" 
                      value={editingCourse?.name || ''} 
                      onChange={e => setEditingCourse({ ...editingCourse!, name: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                    <Input 
                      required 
                      disabled={profile?.role !== 'admin'}
                      placeholder="e.g. CS201" 
                      value={editingCourse?.code || ''} 
                      onChange={e => setEditingCourse({ ...editingCourse!, code: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <Textarea 
                      placeholder="Provide a detailed overview of the course..." 
                      value={editingCourse?.description || ''} 
                      onChange={e => setEditingCourse({ ...editingCourse!, description: e.target.value })} 
                    />
                  </div>
                  {profile?.role === 'admin' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Lecturer</label>
                      <Select required value={editingCourse?.lecturerId || ''} onChange={e => setEditingCourse({ ...editingCourse!, lecturerId: e.target.value })}>
                        <option value="">Select a lecturer</option>
                        {lecturers.map(l => <option key={l.uid} value={l.uid}>{l.name}</option>)}
                      </Select>
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsModalOpen(false); setEditingCourse(null); }}>Cancel</Button>
                    <Button type="submit" className="flex-1">{editingCourse?.id ? 'Update Course' : 'Create Course'}</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StudentsPage = () => {
  const { profile } = useAuth();
  const students = useCollection<UserProfile>('users', (data) => data.filter(u => u.role === 'student'));
  const enrollments = useCollection<Enrollment>('enrollments');
  const courses = useCollection<Course>('courses');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const isAdmin = profile?.role === 'admin';

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStudentCourses = (studentId: string) => {
    const courseIds = enrollments.filter(e => e.studentId === studentId).map(e => e.courseId);
    return courses.filter(c => courseIds.includes(c.id));
  };

  const handleDeleteStudent = async (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this student?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'users');
      }
    }
  };

  const handleUpdateRole = async (uid: string, newRole: UserRole, e: React.ChangeEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Students Directory</h2>
        {isAdmin && <Badge variant="default">Admin Mode</Badge>}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input 
            className="pl-10" 
            placeholder="Search students by name or email..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map(student => (
          <Card key={student.uid} className="p-6 hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => setSelectedStudent(student)}>
            {isAdmin && (
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleDeleteStudent(student.uid, e)}
                  className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                  title="Delete Student"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                {student.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{student.name}</h3>
                <p className="text-sm text-gray-500 truncate">{student.email}</p>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Enrolled Courses</p>
                <p className="text-sm font-bold text-indigo-600">{getStudentCourses(student.uid).length}</p>
              </div>
              {isAdmin && (
                <div onClick={e => e.stopPropagation()}>
                  <Select 
                    className="text-xs py-1 h-8" 
                    value={student.role}
                    onChange={e => handleUpdateRole(student.uid, e.target.value as UserRole, e)}
                  >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md">
              <Card className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl">
                      {selectedStudent.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedStudent.name}</h3>
                      <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600">
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b pb-2">Enrolled Courses</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {getStudentCourses(selectedStudent.uid).map(course => (
                      <div key={course.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{course.name}</p>
                          <p className="text-xs text-indigo-600">{course.code}</p>
                        </div>
                      </div>
                    ))}
                    {getStudentCourses(selectedStudent.uid).length === 0 && (
                      <p className="text-center text-gray-500 py-4 italic">No courses enrolled.</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <Button className="w-full" onClick={() => setSelectedStudent(null)}>Close</Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LecturersPage = () => {
  const { profile } = useAuth();
  const lecturers = useCollection<UserProfile>('users', (data) => data.filter(u => u.role === 'lecturer'));
  const courses = useCollection<Course>('courses');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLecturer, setSelectedLecturer] = useState<UserProfile | null>(null);
  const isAdmin = profile?.role === 'admin';

  const filteredLecturers = lecturers.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLecturerCourses = (lecturerId: string) => {
    return courses.filter(c => c.lecturerId === lecturerId);
  };

  const handleDeleteLecturer = async (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this lecturer?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'users');
      }
    }
  };

  const handleUpdateRole = async (uid: string, newRole: UserRole, e: React.ChangeEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Lecturers Directory</h2>
        {isAdmin && <Badge variant="default">Admin Mode</Badge>}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input 
            className="pl-10" 
            placeholder="Search lecturers by name or email..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLecturers.map(lecturer => (
          <Card key={lecturer.uid} className="p-6 hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => setSelectedLecturer(lecturer)}>
            {isAdmin && (
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleDeleteLecturer(lecturer.uid, e)}
                  className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                  title="Delete Lecturer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xl">
                {lecturer.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{lecturer.name}</h3>
                <p className="text-sm text-gray-500 truncate">{lecturer.email}</p>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Courses Taught</p>
                <p className="text-sm font-bold text-purple-600">{getLecturerCourses(lecturer.uid).length}</p>
              </div>
              {isAdmin && (
                <div onClick={e => e.stopPropagation()}>
                  <Select 
                    className="text-xs py-1 h-8" 
                    value={lecturer.role}
                    onChange={e => handleUpdateRole(lecturer.uid, e.target.value as UserRole, e)}
                  >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {selectedLecturer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md">
              <Card className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                      {selectedLecturer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedLecturer.name}</h3>
                      <p className="text-sm text-gray-500">{selectedLecturer.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedLecturer(null)} className="text-gray-400 hover:text-gray-600">
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b pb-2">Courses Taught</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {getLecturerCourses(selectedLecturer.uid).map(course => (
                      <div key={course.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{course.name}</p>
                          <p className="text-xs text-purple-600">{course.code}</p>
                        </div>
                      </div>
                    ))}
                    {getLecturerCourses(selectedLecturer.uid).length === 0 && (
                      <p className="text-center text-gray-500 py-4 italic">No courses assigned.</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <Button className="w-full" onClick={() => setSelectedLecturer(null)}>Close</Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UsersPage = () => {
  const { profile } = useAuth();
  const users = useCollection<UserProfile>('users');

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'users');
      }
    }
  };

  if (profile?.role !== 'admin') return <div className="p-4 lg:p-8">Access Denied</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900">User Management</h2>
      </div>

      <Card>
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map(u => (
              <tr key={u.uid}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <Select 
                    className="w-32 py-1" 
                    value={u.role} 
                    onChange={e => handleUpdateRole(u.uid, e.target.value as UserRole)}
                  >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="admin">Admin</option>
                  </Select>
                </td>
                <td className="px-6 py-4 text-sm">
                  <Badge variant={u.isApproved ? 'success' : 'warning'}>
                    {u.isApproved ? 'Approved' : 'Pending'}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDeleteUser(u.uid)} className="text-red-600 hover:text-red-900">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const AnalyticsPage = () => {
  const { profile } = useAuth();
  const users = useCollection<UserProfile>('users');
  const courses = useCollection<Course>('courses');
  const enrollments = useCollection<Enrollment>('enrollments');

  const stats = {
    students: users.filter(u => u.role === 'student').length,
    lecturers: users.filter(u => u.role === 'lecturer').length,
    courses: courses.length,
    enrollments: enrollments.length
  };

  if (profile?.role !== 'admin') return <div className="p-4 lg:p-8">Access Denied</div>;

  const chartData = [
    { name: 'Students', value: stats.students },
    { name: 'Lecturers', value: stats.lecturers },
    { name: 'Courses', value: stats.courses },
    { name: 'Enrollments', value: stats.enrollments }
  ];

  return (
    <div className="p-4 lg:p-8 space-y-8">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-900">System Analytics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Total Students</p>
          <p className="text-3xl font-bold text-indigo-600">{stats.students}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Total Lecturers</p>
          <p className="text-3xl font-bold text-purple-600">{stats.lecturers}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Active Courses</p>
          <p className="text-3xl font-bold text-blue-600">{stats.courses}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Total Enrollments</p>
          <p className="text-3xl font-bold text-green-600">{stats.enrollments}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Distribution Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Growth Indicators</h3>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">Student to Lecturer Ratio</p>
                <p className="text-xs text-gray-500">Ideal range: 15:1 - 25:1</p>
              </div>
              <p className="text-xl font-bold text-indigo-600">
                {stats.lecturers > 0 ? (stats.students / stats.lecturers).toFixed(1) : 'N/A'}:1
              </p>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">Avg Enrollments per Course</p>
                <p className="text-xs text-gray-500">Student engagement metric</p>
              </div>
              <p className="text-xl font-bold text-green-600">
                {stats.courses > 0 ? (stats.enrollments / stats.courses).toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { name });
      alert('Profile updated successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-8">Account Settings</h2>
      <Card className="p-4 lg:p-8">
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
              {profile?.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{profile?.name}</h3>
              <p className="text-gray-500">{profile?.email}</p>
              <Badge className="mt-2" variant="default">{profile?.role.toUpperCase()}</Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <Input disabled value={profile?.email} className="bg-gray-50" />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Update Profile'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

const LoginPage = () => {
  const { signIn, user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && profile) {
      navigate('/dashboard');
    }
  }, [user, profile, loading, navigate]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Authenticating...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Left Side - Hero */}
      <div className="flex-1 bg-indigo-600 p-8 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 font-bold text-2xl mb-12">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-lg">
              <BookOpen size={24} />
            </div>
            EduFlow
          </div>
          
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-6">
              Empowering Education <br />
              <span className="text-indigo-200">Through Innovation.</span>
            </h1>
            <p className="text-lg lg:text-xl text-indigo-100 max-w-xl mb-8">
              The comprehensive university management platform designed to streamline academic life for students, lecturers, and administrators.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Calendar className="text-indigo-200" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold">Smart Timetables</h3>
                  <p className="text-sm text-indigo-100/80">Never miss a class with automated scheduling.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Brain className="text-indigo-200" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold">AI Study Tools</h3>
                  <p className="text-sm text-indigo-100/80">Generate notes and flashcards with AI assistance.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
      </div>

      {/* Right Side - Login */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Please sign in to access your account</p>
          </div>
          
          <Card className="p-8 shadow-xl shadow-gray-200/50 border-none">
            <div className="space-y-6">
              <Button 
                className="w-full py-7 text-lg gap-3 bg-white text-gray-700 border-2 border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all shadow-sm" 
                onClick={signIn}
              >
                <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
                Continue with Google
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">Secure Access</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle className="text-green-500" size={18} />
                  <span>Single Sign-On (SSO) enabled</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle className="text-green-500" size={18} />
                  <span>Automatic profile synchronization</span>
                </div>
              </div>
            </div>
          </Card>
          
          <p className="mt-8 text-center text-sm text-gray-500">
            By continuing, you agree to EduFlow's <br />
            <a href="#" className="text-indigo-600 hover:underline font-medium">Terms of Service</a> and <a href="#" className="text-indigo-600 hover:underline font-medium">Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { profile } = useAuth();
  const announcements = useCollection<Announcement>('announcements', (data) => 
    data.filter(ann => ['all', profile?.role || 'student'].includes(ann.targetRole))
  );
  const timetable = useCollection<TimetableEntry>(
    'timetable', 
    undefined,
    profile?.role === 'student' 
      ? query(collection(db, 'timetable'), where('userId', '==', profile.uid))
      : undefined
  );

  if (profile?.role === 'student') return <StudentDashboard announcements={announcements} timetable={timetable} />;
  if (profile?.role === 'lecturer') return <LecturerDashboard announcements={announcements} />;
  if (profile?.role === 'admin') return <AdminDashboard />;
  return null;
};

const StudentDashboard = ({ announcements, timetable }: { announcements: Announcement[], timetable: TimetableEntry[] }) => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = days[new Date().getDay()];
  const nextClass = timetable
    .filter(e => e.day === today)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))[0];

  return (
    <div className="p-4 lg:p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <Card className="p-6 bg-indigo-600 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calendar size={24} />
            </div>
            <Badge variant="success">Active</Badge>
          </div>
          <h3 className="text-lg font-semibold mb-1">Next Class</h3>
          <p className="text-white/80 text-sm">{nextClass?.courseName || 'No classes today'}</p>
          {nextClass && (
            <>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Clock size={14} /> {nextClass.startTime} - {nextClass.endTime}
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <MapPin size={14} /> {nextClass.room}
              </div>
            </>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
              <CheckSquare size={24} />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Attendance</h3>
          <p className="text-gray-500 text-sm">Average across all courses</p>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">85%</span>
              <span className="text-gray-500">Goal: 90%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <BarChart3 size={24} />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Academic Standing</h3>
          <p className="text-gray-500 text-sm">Current CGPA</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">3.82</span>
            <span className="text-sm text-green-600 font-medium">↑ 0.12</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Recent Announcements</h2>
            <Link to="/announcements" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {announcements.slice(0, 3).map(ann => (
              <Card key={ann.id} className="p-4 hover:border-indigo-200 transition-colors cursor-pointer">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Megaphone size={18} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{ann.title}</h4>
                    <p className="text-sm text-gray-500 line-clamp-1">{ann.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{safeFormat(ann.createdAt, 'MMM d, h:mm a')}</p>
                  </div>
                </div>
              </Card>
            ))}
            {announcements.length === 0 && <p className="text-gray-500 text-center py-8">No announcements yet.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
            <Link to="/timetable" className="text-sm text-indigo-600 hover:underline">Full calendar</Link>
          </div>
          <div className="space-y-3">
            {timetable.filter(t => t.day === format(new Date(), 'EEEE')).map(entry => (
              <div key={entry.id} className="flex gap-4 items-center">
                <div className="w-20 text-right">
                  <p className="text-sm font-semibold text-gray-900">{entry.startTime}</p>
                  <p className="text-xs text-gray-500">{entry.endTime}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-indigo-600" />
                <Card className="flex-1 p-4 border-l-4 border-l-indigo-600">
                  <h4 className="font-medium text-gray-900">{entry.courseName || 'Course'}</h4>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin size={12} /> {entry.room}
                  </p>
                </Card>
              </div>
            ))}
            {timetable.filter(t => t.day === format(new Date(), 'EEEE')).length === 0 && (
              <p className="text-gray-500 text-center py-8">No classes scheduled for today.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const LecturerDashboard = ({ announcements }: { announcements: Announcement[] }) => {
  const { profile } = useAuth();
  const courses = useCollection<Course>('courses', (data) => data.filter(c => c.lecturerId === profile?.uid));
  const resources = useCollection<Resource>('resources');
  const enrollments = useCollection<Enrollment>('enrollments');

  const stats = {
    courses: courses.length,
    students: enrollments.filter(e => courses.some(c => c.id === e.courseId)).length,
    resources: resources.filter(r => courses.some(c => c.id === r.courseId)).length
  };

  return (
    <div className="p-4 lg:p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <BookOpen size={24} />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">My Courses</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.courses}</p>
          <p className="text-sm text-gray-500 mt-1">Active this semester</p>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Users size={24} />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Total Students</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.students}</p>
          <p className="text-sm text-gray-500 mt-1">Across all courses</p>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <FileText size={24} />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Resources</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.resources}</p>
          <p className="text-sm text-gray-500 mt-1">Uploaded materials</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Announcements</h2>
          <div className="space-y-3">
            {announcements.slice(0, 3).map(ann => (
              <Card key={ann.id} className="p-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Megaphone size={18} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{ann.title}</h4>
                    <p className="text-sm text-gray-500 line-clamp-1">{ann.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{safeFormat(ann.createdAt, 'MMM d, h:mm a')}</p>
                  </div>
                </div>
              </Card>
            ))}
            {announcements.length === 0 && <p className="text-gray-500 text-center py-8">No announcements yet.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3">
            <Link to="/resources">
              <Button className="w-full justify-start gap-3 py-6">
                <Plus size={20} /> Upload Resource
              </Button>
            </Link>
            <Link to="/announcements">
              <Button variant="secondary" className="w-full justify-start gap-3 py-6">
                <Megaphone size={20} /> Post Announcement
              </Button>
            </Link>
            <Link to="/results">
              <Button variant="secondary" className="w-full justify-start gap-3 py-6">
                <Edit size={20} /> Update Results
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const users = useCollection<UserProfile>('users');
  const courses = useCollection<Course>('courses');

  const stats = {
    users: users.length,
    courses: courses.length,
    students: users.filter(u => u.role === 'student').length,
    lecturers: users.filter(u => u.role === 'lecturer').length
  };

  const data = [
    { name: 'Mon', students: 400, lecturers: 240 },
    { name: 'Tue', students: 300, lecturers: 139 },
    { name: 'Wed', students: 200, lecturers: 980 },
    { name: 'Thu', students: 278, lecturers: 390 },
    { name: 'Fri', students: 189, lecturers: 480 },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Total Users</p>
          <p className="text-2xl font-bold">{stats.users}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Total Students</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.students}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Active Courses</p>
          <p className="text-2xl font-bold">{stats.courses}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">System Health</p>
          <p className="text-2xl font-bold text-green-600">99.9%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">User Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lecturers" fill="#9333ea" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/courses" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
              <BookOpen className="mx-auto mb-2 text-indigo-600" />
              <p className="text-sm font-medium">Manage Courses</p>
            </Link>
            <Link to="/users" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
              <Users className="mx-auto mb-2 text-purple-600" />
              <p className="text-sm font-medium">Manage Users</p>
            </Link>
            <Link to="/announcements" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
              <Megaphone className="mx-auto mb-2 text-orange-600" />
              <p className="text-sm font-medium">New Announcement</p>
            </Link>
            <Link to="/settings" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
              <Settings className="mx-auto mb-2 text-gray-600" />
              <p className="text-sm font-medium">Settings</p>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- Main App ---
const AppContent = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const seedDemoCourse = async () => {
      if (!profile || profile.role !== 'admin') return;
      
      const q = query(collection(db, 'courses'), where('code', '==', 'ROB101'));
      const snapshot = await getDoc(doc(db, 'courses', 'demo-robotics'));
      
      if (!snapshot.exists()) {
        await setDoc(doc(db, 'courses', 'demo-robotics'), {
          id: 'demo-robotics',
          name: 'Introduction to Robotics',
          code: 'ROB101',
          lecturerId: profile.uid, // Assign to current admin for demo
          description: 'A foundational course on robotics, covering sensors, actuators, and control systems.'
        });
      }
    };
    seedDemoCourse();
  }, [profile]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Initializing EduFlow...</p>
      </div>
    </div>
  );

  const pageTitle = window.location.pathname.split('/')[1]?.charAt(0).toUpperCase() + window.location.pathname.split('/')[1]?.slice(1) || 'Dashboard';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {!profile ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <>
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          <main className="flex-1 lg:ml-64 min-h-screen w-full">
            <Header title={pageTitle} onMenuClick={() => setIsSidebarOpen(true)} />
            <div className="max-w-7xl mx-auto">
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/lecturers" element={<LecturersPage />} />
                <Route path="/timetable" element={<TimetablePage />} />
                <Route path="/resources" element={<ResourcesPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/flashcards" element={<FlashcardsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </div>
            <RoleSwitcher />
            {profile && <AIAssistant />}
          </main>
        </>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
