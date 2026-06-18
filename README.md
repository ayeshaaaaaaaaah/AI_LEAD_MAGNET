# 60-Second AI Lead Magnet

An interactive, AI-driven lead generation and scoring tool designed for e-commerce platforms. This tool captures user inputs through a dynamic multi-step form, processes commercial signals using a deterministic scoring algorithm, and generates a detailed performance report while saving lead data into a MySQL database.

---

## 🚀 Features

- **Dynamic Multi-Step UI:** A clean, engaging multi-step interface that captures a user's store URL and key business metrics in under 60 seconds.
- **Deterministic Lead Scoring:** Evaluates e-commerce potential across 5 core dimensions (Goal, Platform, Traffic, Ads, and Revenue).
- **Automated Lead Tiering:** Categorizes leads into **Hot, Warm, or Cold** tiers based on commercial value and traffic density.
- **Interactive Dashboard:** Displays a personalized Health Score (0-100), estimated monthly revenue, percentage improvements, and a beautiful custom donut chart breakdown.
- **Data Persistence:** Automatically creates the schema and securely stores submission data into a MySQL database for seamless CRM integration.

---

## 🛠️ Tech Stack

- **Backend:** Python (Flask, Flask-CORS)
- **Frontend:** Semantic HTML5, Custom CSS3, Vanilla JavaScript
- **Database:** MySQL / MariaDB (XAMPP-ready via `pymysql`)

---

## 📂 Project Structure

```text
AI_Lead_Magnet/
│
├── app.py              # Flask API & core deterministic scoring logic
├── index.html          # Main responsive user interface
├── script.js           # Frontend data handling and dynamic UI updates
├── requirements.txt    # Required Python packages
└── README.md           # Project documentation
