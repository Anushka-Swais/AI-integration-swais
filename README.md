# 🎓 SGS AI Integration 

---

## 🌟 AI Features by Dashboard

### 👩‍🏫 Teacher Dashboard
1. Automatic teaching material generation per topic/lesson.
2. Automatic question paper generation per topic/lesson.
3. Automatic answer sheet correction.
4. Assignment due date alerts.
5. Assignment completion alerts.
6. Virtual slate.
7. Student assessment (per student or entire class).
8. Student assessment (one subject or all subjects).
9. Language script translator.
10. Audio language translator.
11. Voice to text and text to voice.

### 🎓 Student Dashboard
1. Automatic content generation based on learning capacity (Small, Average, Quick pace).
2. Automatic quiz generation with auto-correction.
3. Self-assessment with graphical representation per subject and for all subjects.
4. Language script translator.
5. Audio language translator.
6. Voice to text and text to voice.
7. Assignment due date alerts.

### 👨‍👩‍👦 Parent Dashboard
1. Language script translator.
2. Audio language translator.
3. Student assessment per subject and per test.
4. Assignment due date alerts.
5. Voice to text and text to voice.

### 🏛️ Headmaster Dashboard
1. Language script translator.
2. Audio language translator.
3. Voice to text and text to voice.
4. Assessment of students based on per student, per subject, or all subjects.
5. Assessment of classroom per subject or overall.

### 🛠️ Admin Dashboard
1. Language script translator.
2. Audio language translator.
3. Voice to text and text to voice.

---

## ✅ Status Checklist

| Feature Area | Requirement | Status | Note |
| :--- | :--- | :--- | :--- |
| **Student** | 1. Paced Content Generation | ✅ | `generatePacedContent` (Small/Avg/Quick) |
| | 2. Quiz Gen & Auto-Correction | ✅ | `generateAutoQuiz` + `grade()` logic |
| | 3. Graphical Analytics | ✅ | Chart.js & `getStudentAnalytics` |
| | 4, 5. Translation (Script/Audio) | ✅ | Integrated in Chat & Translator UI |
| | 6. Voice to Text & Text to Voice | ✅ | Web Speech API integrated |
| | 7. Assignment Alerts | ✅ | Integrated in the dashboard logic |
| **Teacher** | 1, 2. Lesson & Exam Gen | ✅ | `generateLessonPlan` & `generateQuestionPaper` |
| | 3. Auto Correction | ✅ | `autoCorrectAnswer` |
| | 4, 5. Assignment Alerts | ✅ | `generateAssignmentReminders` |
| | 6. Virtual Slate | ⚠️ | UI placeholder; needs a canvas drawing tool |
| | 7. Annotation Hub Search | ❌ | Out of Scope (as discussed) |
| | 8, 9. Assessment (Student/Class) | ✅ | Analytics engine integrated |
| | 10, 11, 12. Multilingual & Voice | ✅ | Integrated |
| **Parent** | 1, 2. Translation & Voice | ✅ | Integrated |
| | 3. Student Assessment | ✅ | Linked to `sgs_parent_student_map` |
| | 4. Assignment Alerts | ✅ | `getAssignmentReport` |
| | 5. Voice to Text & Text to Voice | ✅ | Integrated |
| **HM/Admin** | 1, 2. Translation & Voice | ✅ | Integrated |
| | 3. Voice to Text | ✅ | Integrated |
| | 4, 5. Student/Class Assessment | ✅ | `getAcademicAnalytics` |

---

## 🧠 AI Engine
* **Engine:** Google Gemini API (`gemini-2.5-flash`)

---

## 🗄️ Database Schema Requirements

| Table Name | Purpose |
| :--- | :--- |
| `ai_usage_logs` | Tracks every AI interaction for usage monitoring. |
| `ai_chat_messages` | Stores persistent conversation history for context-aware AI support. |
| `sgs_chapter_content` | The "Knowledge Base" containing curriculum-aligned textbook text. |
| `sgs_assessment_results` | Links assessments to students with percentage scores. |
| `sgs_parent_student_map` | Bridges parent accounts to student performance data for secure access. |

---

## 🚀 Setup & Installation

### 1. Repository Clone
Clone the repository to your local machine:
```bash
git clone [https://github.com/Anushka-Swais/AI-integration-swais.git](https://github.com/Anushka-Swais/AI-integration-swais.git)
cd AI-integration-swais
