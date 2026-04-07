export type UserRole = 'student' | 'lecturer' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  isApproved?: boolean;
}

export interface CourseOutlineModule {
  id: string;
  title: string;
  topics: string[];
  readings: string[];
}

export interface Course {
  id: string;
  name: string;
  code: string;
  lecturerId: string;
  description?: string;
  outline?: CourseOutlineModule[];
}

export interface TimetableEntry {
  id: string;
  courseId: string;
  courseName?: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string;
  endTime: string;
  room: string;
}

export interface Resource {
  id: string;
  courseId: string;
  title: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export interface AttendanceRecord {
  id: string;
  courseId: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent';
}

export interface Result {
  id: string;
  courseId: string;
  studentId: string;
  grade: string;
  marks: number;
  semester: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  targetRole: 'all' | 'student' | 'lecturer';
  createdAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'announcement' | 'deadline' | 'message' | 'system';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface Note {
  id: string;
  userId: string;
  courseId: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  userId: string;
  courseId: string;
  front: string;
  back: string;
  createdAt: string;
}
