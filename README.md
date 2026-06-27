# 🎓 SGS AI Integration

The system leverages **Google Gemini 3.5 Flash** using the **Google GenAI SDK** to deliver curriculum-aware content generation, analytics, multilingual support, and AI-assisted academic workflows.

---

# ✨ Key Features

* 🤖 Google Gemini 3.5 Flash Integration
* 📚 AI Lesson Plan Generation
* 📝 Automatic Question Paper Generation
* ✅ AI Answer Sheet Evaluation
* 📈 Student & Classroom Analytics
* 🎯 Adaptive Learning Content
* 📊 Performance Reports
* 🌍 Multilingual Translation
* 💬 Context-Aware AI Chatbots
* 🔊 Speech-to-Text & Text-to-Speech
* 📌 Assignment Tracking & Notifications
* 🧠 Persistent AI Conversation Memory
* 📋 AI Usage Logging

---

# 🖥️ Dashboard Features

## 👩‍🏫 Teacher Dashboard

* AI Lesson Plan Generator
* AI Question Paper Generator
* AI Answer Sheet Evaluation
* Assignment Due Date Reminders
* Assignment Completion Analytics
* Virtual Slate AI Processor
* Individual Student Performance Analytics
* Classroom Performance Analytics
* Language Translator
* Teacher AI Assistant with Conversation Memory
* Speech-to-Text & Text-to-Speech

---

## 🎓 Student Dashboard

* Adaptive Learning Content (Small / Average / Quick Pace)
* Automatic Quiz Generation
* AI Self-Assessment
* Student AI Tutor Chat
* Subject-wise Performance Analytics
* Language Translator
* Speech-to-Text & Text-to-Speech
* Assignment Tracking

---

## 👨‍👩‍👧 Parent Dashboard

* Student Progress Analytics
* Assignment Progress Reports
* AI Parent Assistant
* Language Translator
* Speech-to-Text & Text-to-Speech

---

## 🏛️ Headmaster Dashboard

* School-wide Assignment Analytics
* Student Analytics
* Class Analytics
* Teacher Performance Review
* Executive AI Reports
* Language Translator
* Speech-to-Text & Text-to-Speech

---

## 🛠️ Admin Dashboard

* AI-ready Architecture
* Multilingual Translation
* Speech-to-Text & Text-to-Speech
* Future AI Administrative Modules

---

# 📊 Feature Status

| Module                   |   Status   |
| ------------------------ | :--------: |
| Student Dashboard        | ✅ Complete |
| Teacher Dashboard        | ✅ Complete |
| Parent Dashboard         | ✅ Complete |
| Headmaster Dashboard     | ✅ Complete |
| AI Chat Memory           | ✅ Complete |
| AI Usage Logging         | ✅ Complete |
| Gemini 3.5 Integration   | ✅ Complete |
| Multilingual Translation | ✅ Complete |
| Voice Support            | ✅ Complete |

---

# 🧠 AI Architecture

## AI Model

* Google Gemini 3.5 Flash
* Google GenAI SDK (`@google/genai`)

## AI Capabilities

* Lesson Planning
* Question Paper Generation
* Quiz Generation
* Answer Evaluation
* Adaptive Learning Content
* Academic Analytics
* Language Translation
* Teacher Assistant
* Student Tutor
* Executive Reporting

---

# 🗄️ Database Schema

| Table                    | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `ai_usage_logs`          | Logs every AI interaction for monitoring and analytics  |
| `ai_chat_messages`       | Stores conversation history for contextual AI responses |
| `sgs_chapter_content`    | Curriculum-aligned knowledge base for AI generation     |
| `sgs_assessment_results` | Student assessment records and performance analytics    |
| `sgs_parent_student_map` | Maps parents to students securely                       |
| `sgs_assessments`        | Assessment metadata                                     |
| `sgs_student_master`     | Student information                                     |
| `sgs_users_masters`      | Teacher and administrator information                   |

---

# ⚙️ Technology Stack

## Backend

* Node.js
* Express.js

## Database

* PostgreSQL

## AI

* Google Gemini 3.5 Flash
* Google GenAI SDK (`@google/genai`)

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/Anushka-Swais/AI-integration-swais.git
cd AI-integration-swais
```

---

## Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the root directory.

```env
PORT=5000

DATABASE_URL=your_database_url

GEMINI_API_KEY=your_gemini_api_key

GEMINI_MODEL=gemini-3.5-flash
```

---

## Start the Server

```bash
npm start
```

or

```bash
npm run dev
```

---

# 📂 Project Structure

```text
AI-integration-swais/
│
├── config/
│   ├── aiConfig.js
│   └── db.js
│
├── controllers/
│   ├── studentController.js
│   ├── teacherController.js
│   ├── parentController.js
│   └── headmasterController.js
│
├── routes/
│
├── public/
│
├── package.json
│
└── README.md
```

---

# 🔒 Security

* API keys are stored securely using environment variables.
* AI usage is logged for monitoring and analytics.
* Conversation history is stored securely to provide contextual AI responses.
* Database credentials are never committed to the repository.

---

# 📌 AI Configuration

| Component      | Version                     |
| -------------- | --------------------------- |
| AI SDK         | `@google/genai`             |
| AI Model       | `gemini-3.5-flash`          |
| Retry Strategy | Exponential Backoff         |
| Chat Memory    | Persistent Database Storage |

---

# 👩‍💻 Developer

**Anushka Gupta**

AI/ML Engineer

**SGS AI Integration**
