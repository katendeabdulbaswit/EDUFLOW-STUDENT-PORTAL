import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, Course, TimetableEntry, Resource, AttendanceRecord, Result, Announcement, UserRole, Enrollment } from './types';
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
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
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

// --- Mock Data for Offline/Demo Mode ---
const MOCK_DATA = {
  courses: [
    { id: 'demo-robotics', name: 'Introduction to Robotics', code: 'ROB101', lecturerId: 'dev-user-id', description: 'A foundational course on robotics, covering sensors, actuators, and control systems.' },
    { id: 'demo-cs101', name: 'Computer Science 101', code: 'CS101', lecturerId: 'dev-user-id', description: 'Introduction to programming and computer science concepts.' },
  ],
  timetable: [
    { id: 't1', courseId: 'demo-robotics', courseName: 'Introduction to Robotics', day: 'Monday', startTime: '09:00', endTime: '11:00', room: 'Lab 1' },
    { id: 't2', courseId: 'demo-cs101', courseName: 'Computer Science 101', day: 'Wednesday', startTime: '14:00', endTime: '16:00', room: 'Room 302' },
  ],
  announcements: [
    { id: 'a1', title: 'Welcome to EduFlow', content: 'We are excited to have you here! Explore your courses and timetable.', date: new Date().toISOString(), role: 'all', authorName: 'Admin' },
    { id: 'a2', title: 'Robotics Lab Maintenance', content: 'The robotics lab will be closed for maintenance this Friday.', date: new Date().toISOString(), role: 'student', authorName: 'Dr. Smith' },
  ],
  resources: [
    { id: 'r1', title: 'Robotics Basics PDF', type: 'pdf', courseId: 'demo-robotics', url: '#', date: new Date().toISOString() },
    { id: 'r2', title: 'CS101 Lecture 1 Slides', type: 'link', courseId: 'demo-cs101', url: '#', date: new Date().toISOString() },
  ],
  results: [
    { id: 'res1', studentId: 'dev-user-id', courseId: 'demo-robotics', courseName: 'Introduction to Robotics', grade: 'A', score: 92, date: new Date().toISOString() },
  ],
  attendance: [
    { id: 'att1', studentId: 'dev-user-id', courseId: 'demo-robotics', date: new Date().toISOString(), status: 'present' },
  ],
  users: [
    { uid: 'dev-user-id', name: 'Developer', email: 'katendeabdulbaswit@gmail.com', role: 'admin', isApproved: true },
    { uid: 'student-1', name: 'John Doe', email: 'john@example.com', role: 'student', isApproved: true },
    { uid: 'student-2', name: 'Jane Doe', email: 'jane@example.com', role: 'student', isApproved: true },
  ],
  enrollments: []
};

const useCollection = <T extends { id?: string; uid?: string }>(collectionName: keyof typeof MOCK_DATA, queryFn?: (data: T[]) => T[]) => {
  const [data, setData] = useState<T[]>(MOCK_DATA[collectionName] as T[]);
  const [loading, setLoading] = useState(true);
  const queryFnRef = useRef(queryFn);

  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, collectionName), (snapshot) => {
      if (!snapshot.empty) {
        const firestoreData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        setData(queryFnRef.current ? queryFnRef.current(firestoreData) : firestoreData);
      }
      setLoading(false);
    }, (err) => {
      console.warn(`Firestore ${collectionName} failed (offline mode):`, err);
      setData(queryFnRef.current ? queryFnRef.current(MOCK_DATA[collectionName] as T[]) : MOCK_DATA[collectionName] as T[]);
      setLoading(false);
    });
    return unsub;
  }, [collectionName]);

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

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden', className)}>
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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: `You are a helpful university study assistant. Help the student with their query: ${userMsg}` }] }],
      });

      const response = result.text;
      setMessages(prev => [...prev, { role: 'ai', content: response || "I'm sorry, I couldn't generate a response." }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
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
            className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-40"
          >
            <div className="p-4 bg-indigo-600 text-white flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm">EduFlow AI Assistant</h3>
                <p className="text-[10px] text-white/70">Study Guide & Assistance</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 && (
                <div className="text-center py-10 space-y-2">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles size={24} />
                  </div>
                  <p className="text-sm font-medium text-gray-900">How can I help you today?</p>
                  <p className="text-xs text-gray-500 px-6">Ask me about your courses, study tips, or any academic questions!</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                    msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-gray-800 border border-gray-200 rounded-tl-none"
                  )}>
                    {msg.content}
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
                placeholder="Type your question..."
                value={input}
                onChange={e => setInput(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={isTyping}>
                <Send size={18} />
              </Button>
            </form>
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
  const [profile, setProfile] = useState<UserProfile | null>(DEV_PROFILE);
  const [loading, setLoading] = useState(false);

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
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(DEV_PROFILE);
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
const Sidebar = () => {
  const { profile, signOut } = useAuth();
  const location = window.location.pathname;

  const developerEmail = 'katendeabdulbaswit@gmail.com';
  const isDeveloper = profile?.email === developerEmail;

  const menuItems = {
    student: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: Calendar, label: 'Timetable', path: '/timetable' },
      { icon: BookOpen, label: 'Courses', path: '/courses' },
      { icon: FileText, label: 'Resources', path: '/resources' },
      { icon: CheckSquare, label: 'Attendance', path: '/attendance' },
      { icon: BarChart3, label: 'Results', path: '/results' },
      { icon: Megaphone, label: 'Announcements', path: '/announcements' },
      ...(isDeveloper ? [
        { icon: Plus, label: 'Manage Courses (Dev)', path: '/courses' },
        { icon: FileText, label: 'Manage Resources (Dev)', path: '/resources' },
      ] : [])
    ],
    lecturer: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: BookOpen, label: 'My Courses', path: '/courses' },
      { icon: FileText, label: 'Manage Resources', path: '/resources' },
      { icon: Calendar, label: 'Manage Timetable', path: '/timetable' },
      { icon: Megaphone, label: 'Announcements', path: '/announcements' },
      { icon: BarChart3, label: 'Student Results', path: '/results' },
    ],
    admin: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: BookOpen, label: 'Manage Courses', path: '/courses' },
      { icon: Users, label: 'Manage Users', path: '/users' },
      { icon: CheckCircle, label: 'Approve Lecturers', path: '/approvals' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
      { icon: Settings, label: 'System Settings', path: '/settings' },
    ],
  };

  const roleItems = profile ? (
    (profile.role === 'lecturer' && !profile.isApproved && !isDeveloper)
      ? [{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' }] 
      : menuItems[profile.role]
  ) : [];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <BookOpen size={20} />
          </div>
          EduFlow
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {roleItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
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
  );
};

const Header = ({ title }: { title: string }) => (
  <header className="h-16 bg-white border-bottom border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
    <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
    <div className="flex items-center gap-4">
      <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
        <Bell size={20} />
      </button>
      <div className="h-8 w-px bg-gray-200" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-indigo-600" />
      </div>
    </div>
  </header>
);

const TimetablePage = () => {
  const { profile } = useAuth();
  const entries = useCollection<TimetableEntry>('timetable');
  const courses = useCollection<Course>('courses');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<TimetableEntry> | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    try {
      const course = courses.find(c => c.id === editingEntry.courseId);
      const data = { ...editingEntry, courseName: course?.name || '' };
      if (editingEntry.id) {
        await updateDoc(doc(db, 'timetable', editingEntry.id), data);
      } else {
        await addDoc(collection(db, 'timetable'), data);
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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Class Timetable</h2>
        {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
          <Button onClick={() => { setEditingEntry({ day: 'Monday' }); setIsModalOpen(true); }} className="gap-2">
            <Plus size={18} /> Add Entry
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {days.map(day => (
          <div key={day} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">{day}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.filter(e => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(entry => (
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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Learning Resources</h2>
        {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus size={18} /> Upload Resource
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
                <span className="text-xs text-gray-500">{format(new Date(res.uploadedAt), 'MMM d, yyyy')}</span>
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
  const records = useCollection<AttendanceRecord>('attendance');
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
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Attendance Tracking</h2>
      
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
  const results = useCollection<Result>('results');
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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Academic Results</h2>
        {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus size={18} /> Add Result
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
      await addDoc(collection(db, 'announcements'), {
        ...newAnn,
        authorId: profile?.uid,
        createdAt: new Date().toISOString()
      });
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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Announcements</h2>
        {(profile?.role === 'lecturer' || profile?.role === 'admin') && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus size={18} /> New Announcement
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
                    Posted on {format(new Date(ann.createdAt), 'MMMM d, yyyy • h:mm a')}
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

const CoursesPage = () => {
  const { profile } = useAuth();
  const courses = useCollection<Course>('courses');
  const lecturers = useCollection<UserProfile>('users', (data) => data.filter(u => u.role === 'lecturer'));
  const enrollments = useCollection<Enrollment>('enrollments');
  const students = useCollection<UserProfile>('users', (data) => data.filter(u => u.role === 'student'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCourse, setNewCourse] = useState<Partial<Course>>({});
  const [viewingStudentsFor, setViewingStudentsFor] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'courses'), newCourse);
      await updateDoc(docRef, { id: docRef.id });
      setIsModalOpen(false);
      setNewCourse({});
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
    if (existing) {
      await deleteDoc(doc(db, 'enrollments', existing.id));
    } else {
      const docRef = await addDoc(collection(db, 'enrollments'), {
        studentId: profile.uid,
        courseId,
        enrolledAt: new Date().toISOString()
      });
      await updateDoc(docRef, { id: docRef.id });
    }
  };

  const getEnrolledStudents = (courseId: string) => {
    const studentIds = enrollments.filter(e => e.courseId === courseId).map(e => e.studentId);
    return students.filter(s => studentIds.includes(s.uid));
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {profile?.role === 'admin' ? 'Manage Courses' : profile?.role === 'lecturer' ? 'My Courses' : 'Available Courses'}
        </h2>
        {profile?.role === 'admin' && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus size={18} /> Add Course
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses
          .filter(c => profile?.role !== 'lecturer' || c.lecturerId === profile.uid)
          .map(course => {
            const isEnrolled = enrollments.some(e => e.courseId === course.id && e.studentId === profile?.uid);
            const enrolledCount = enrollments.filter(e => e.courseId === course.id).length;

            return (
              <Card key={course.id} className="p-6 relative group">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                    <BookOpen size={24} />
                  </div>
                  <div className="flex gap-2">
                    {profile?.role === 'lecturer' && course.lecturerId === profile.uid && (
                      <Button variant="ghost" size="sm" onClick={() => setViewingStudentsFor(course.id)}>
                        <Users size={18} className="text-gray-400 hover:text-indigo-600" />
                      </Button>
                    )}
                    {profile?.role === 'admin' && (
                      <button onClick={() => handleDelete(course.id)} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{course.name}</h3>
                <p className="text-sm text-indigo-600 font-medium">{course.code}</p>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-end">
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
      </div>

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

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <Card className="w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-6">Add New Course</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
                    <Input required placeholder="e.g. Data Structures" value={newCourse.name || ''} onChange={e => setNewCourse({ ...newCourse, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                    <Input required placeholder="e.g. CS201" value={newCourse.code || ''} onChange={e => setNewCourse({ ...newCourse, code: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Lecturer</label>
                    <Select required value={newCourse.lecturerId || ''} onChange={e => setNewCourse({ ...newCourse, lecturerId: e.target.value })}>
                      <option value="">Select a lecturer</option>
                      {lecturers.map(l => <option key={l.uid} value={l.uid}>{l.name}</option>)}
                    </Select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">Create Course</Button>
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

  if (profile?.role !== 'admin') return <div className="p-8">Access Denied</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
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

const ApprovalsPage = () => {
  const { profile } = useAuth();
  const pendingUsers = useCollection<UserProfile>('users', (data) => 
    data.filter(u => u.role === 'lecturer' && u.isApproved === false)
  );

  const handleApprove = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isApproved: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  const handleReject = async (uid: string) => {
    if (confirm('Reject this lecturer?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'users');
      }
    }
  };

  if (profile?.role !== 'admin') return <div className="p-8">Access Denied</div>;

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Lecturer Approvals</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pendingUsers.map(u => (
          <Card key={u.uid} className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                {u.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{u.name}</h3>
                <p className="text-sm text-gray-500">{u.email}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 text-red-600" onClick={() => handleReject(u.uid)}>Reject</Button>
              <Button className="flex-1" onClick={() => handleApprove(u.uid)}>Approve</Button>
            </div>
          </Card>
        ))}
        {pendingUsers.length === 0 && (
          <div className="col-span-full text-center py-20">
            <p className="text-gray-500 italic">No pending approvals at the moment.</p>
          </div>
        )}
      </div>
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

  if (profile?.role !== 'admin') return <div className="p-8">Access Denied</div>;

  const chartData = [
    { name: 'Students', value: stats.students },
    { name: 'Lecturers', value: stats.lecturers },
    { name: 'Courses', value: stats.courses },
    { name: 'Enrollments', value: stats.enrollments }
  ];

  return (
    <div className="p-8 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">System Analytics</h2>
      
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
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Account Settings</h2>
      <Card className="p-8">
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

const LandingPage = () => {
  const { signIn, user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && profile) {
      navigate('/dashboard');
    }
  }, [user, profile, loading, navigate]);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-200">
          <BookOpen size={32} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">EduFlow</h1>
        <p className="text-gray-600 mb-8">The all-in-one university management platform for students, lecturers, and admins.</p>
        
        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-6">Welcome Back</h2>
          <Button className="w-full py-6 text-lg gap-3" onClick={signIn}>
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </Button>
          <p className="mt-6 text-xs text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </Card>

        <div className="mt-12 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-2">
              <Users size={20} />
            </div>
            <p className="text-xs font-medium text-gray-700">Students</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mx-auto mb-2">
              <UserIcon size={20} />
            </div>
            <p className="text-xs font-medium text-gray-700">Lecturers</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mx-auto mb-2">
              <Settings size={20} />
            </div>
            <p className="text-xs font-medium text-gray-700">Admins</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const { profile } = useAuth();
  const announcements = useCollection<Announcement>('announcements', (data) => 
    data.filter(ann => ['all', profile?.role || 'student'].includes(ann.targetRole))
  );
  const timetable = useCollection<TimetableEntry>('timetable');

  if (profile?.role === 'student') return <StudentDashboard announcements={announcements} timetable={timetable} />;
  if (profile?.role === 'lecturer') {
    if (!profile.isApproved) {
      return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-6">
            <Clock size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Approval Pending</h2>
          <p className="text-gray-600 max-w-md">
            Your lecturer account is currently pending approval from the administrator. 
            Once approved, you will have full access to manage courses, resources, and students.
          </p>
          <div className="mt-8 p-4 bg-orange-50 border border-orange-100 rounded-lg text-sm text-orange-700">
            Current Status: <span className="font-bold">Pending Review</span>
          </div>
        </div>
      );
    }
    return <LecturerDashboard announcements={announcements} />;
  }
  if (profile?.role === 'admin') return <AdminDashboard />;
  return null;
};

const StudentDashboard = ({ announcements, timetable }: { announcements: Announcement[], timetable: TimetableEntry[] }) => {
  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-indigo-600 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calendar size={24} />
            </div>
            <Badge variant="success">Active</Badge>
          </div>
          <h3 className="text-lg font-semibold mb-1">Next Class</h3>
          <p className="text-white/80 text-sm">Introduction to Computer Science</p>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Clock size={14} /> 10:00 AM - 12:00 PM
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <MapPin size={14} /> Room 302, Block B
          </div>
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
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(ann.createdAt), 'MMM d, h:mm a')}</p>
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
    <div className="p-8 space-y-8">
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
    pending: users.filter(u => u.role === 'lecturer' && !u.isApproved).length,
    courses: courses.length
  };
  const pendingLecturers = users.filter(u => u.role === 'lecturer' && !u.isApproved).slice(0, 3);

  const handleApprove = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isApproved: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  const data = [
    { name: 'Mon', students: 400, lecturers: 240 },
    { name: 'Tue', students: 300, lecturers: 139 },
    { name: 'Wed', students: 200, lecturers: 980 },
    { name: 'Thu', students: 278, lecturers: 390 },
    { name: 'Fri', students: 189, lecturers: 480 },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Total Users</p>
          <p className="text-2xl font-bold">{stats.users}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500 mb-1">Pending Approvals</p>
          <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Pending Lecturer Approvals</h3>
            <Link to="/approvals" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-4">
            {pendingLecturers.map(u => (
              <div key={u.uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <UserIcon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(u.uid)}>Approve</Button>
                </div>
              </div>
            ))}
            {pendingLecturers.length === 0 && <p className="text-center text-gray-500 py-8">No pending approvals.</p>}
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

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  if (!profile) return <LandingPage />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen">
        <Header title={window.location.pathname.split('/')[1].charAt(0).toUpperCase() + window.location.pathname.split('/')[1].slice(1) || 'Dashboard'} />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
        <RoleSwitcher />
        {profile?.role === 'student' && <AIAssistant />}
      </main>
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
