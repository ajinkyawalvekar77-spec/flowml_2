<p align="center">
  <img src="Source Code/frontend/public/flowml-icon.svg" width="80" height="80" alt="FlowML" />
</p>

# 🚀 FlowML

# AI-Powered Visual Machine Learning Pipeline Builder

FlowML is a modern **AutoML platform** that enables users to **build, train, and deploy machine learning pipelines visually** using an intuitive drag-and-drop workflow interface.

Upload datasets, automate preprocessing, compare models, and generate insights — all in one powerful AI-driven environment.

---

# ✨ Features

## 🧠 AI-Powered AutoML

* Automatic dataset analysis
* Auto preprocessing
* Smart model selection
* Best model recommendation

## 🎯 Visual Pipeline Builder

* Drag-and-drop workflow creation
* Connect ML components visually
* Build end-to-end ML pipelines
* Real-time pipeline execution

## 📊 Dataset Intelligence

* Dataset preview
* Missing value detection
* Feature classification
* Target column suggestion

## 🤖 Automated Model Training

* Multiple models training
* Classification support
* Regression support
* Model comparison

## 📈 Smart Visualizations

* Feature importance
* Correlation heatmap
* Confusion matrix
* Model comparison charts

## 🔮 Prediction Engine

* Upload new dataset
* Generate predictions
* Export results

## 📦 Model Export

* Download trained model
* Download pipeline
* Generate reports

---

# 🖼️ UI Preview

* Drag & Drop Pipeline
* Light theme
* Real-time Console
* Node-Based Workflow
* Modern AI SaaS UI

---

# 🏗️ Architecture

```
Frontend (React)
        ↓
Backend (FastAPI)
        ↓
ML Engine (Scikit-learn)
        ↓
Visualization Engine
```

---

# 🛠️ Tech Stack

## Frontend

* React
* Tailwind CSS
* React Flow
* Framer Motion
* Lucide Icons

## Backend

* FastAPI
* Python
* Uvicorn

## Machine Learning

* Scikit-learn
* Pandas
* NumPy

## Visualization

* Matplotlib
* Plotly

## Model Storage

* Joblib
* Pickle

---

# 📁 Project Structure

```
flowml/
│
├── Docs/                  # Presentation slides and project documentation
├── Source Code/
│   ├── frontend/          # React + Vite + Tailwind CSS frontend
│   ├── backend/           # FastAPI + Scikit-Learn backend
│   ├── model_capabilities.yaml
│   └── README.md
├── README.md
└── .gitignore
```

---

## Run locally on Windows

The local development configuration uses DEV_AUTH and does not require Firebase credentials. Run the backend and frontend in separate PowerShell windows.

### Backend

```powershell
cd "Source Code\backend"
py -3.10 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

The backend loads `Source Code\backend\.env` at startup. Keep `DEV_AUTH=1` for local development; never use DEV_AUTH in production. Python code execution is off by default. Do not enable `ENABLE_PYTHON_SANDBOX` unless the isolated worker setup has been reviewed and configured.

The admin console is available only at `http://localhost:5173/admin` and uses its own sign-in, separate from the user dashboard. The example backend environment configures the usernames `vish@flowml`, `kush@flowml`, and `ajinkya@flowml` with the shared password `flowml@2026`. Before starting the backend, set `ADMIN_AUTH_SECRET` in `Source Code\backend\.env` to a random value of at least 32 characters (generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`). Admin sessions expire after 8 hours. For production, replace the shared password and protect the environment file.

### Frontend

```powershell
cd "Source Code\frontend"
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). `VITE_DEV_AUTH=true` selects the local mock account flow. Use a unique email and password to sign up; the mock verification flow is local-only. To use Firebase instead, configure the Firebase web values in `.env.local`, set `VITE_DEV_AUTH=false`, configure the backend service credentials privately, then restart both servers. Never commit `.env`, `.env.local`, or Firebase credential files.

`VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000`, matching the backend's local IPv4 bind address. Backend CORS defaults to the two local Vite origins and can be overridden with `CORS_ORIGINS`. The backend health check is available at `http://127.0.0.1:8000/api/health`.

### Checks

```powershell
# Frontend
cd "Source Code\frontend"
npm run lint
npm run build

# Backend (in a second terminal)
cd "Source Code\backend"
.\venv\Scripts\Activate.ps1
pytest
python test_api.py
```

The backend test suite sets DEV_AUTH for tests. Use a fresh browser account for the local product walkthrough.

# 🚀 Getting Started

## 1. Clone or Extract Zip

```bash
git clone https://github.com/vishwajeetchandole/flowml-studio.git
cd flowml-studio
```

---

## 2. Backend Setup (FastAPI)

In a terminal, navigate to the backend directory and set up Python:

```bash
cd "Source Code/backend"

# (Optional but recommended) create a virtual environment
python -m venv venv

# Activate virtual environment:
# Windows:
.\venv\Scripts\activate
# macOS / Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app:app --reload --port 8000
```

Backend will be running at:
```
http://localhost:8000
```

---

## 3. Frontend Setup (React + Vite)

In a **second terminal**, navigate to the frontend directory:

```bash
cd "Source Code/frontend"

# Install node dependencies
npm install

# Start Vite dev server
npm run dev
```

Frontend will be running at:
```
http://localhost:5173
```


---

# API Endpoints

## Upload Dataset

```
POST /api/upload
```

## Analyze Dataset

```
POST /api/analyze
```

## Preprocess Data

```
POST /api/preprocess
```

## Train Models

```
POST /api/train
```

## Model Comparison

```
GET /api/models
```

## Visualizations

```
GET /api/visualizations
```

## Predict

```
POST /api/predict
```

## Download Model

```
GET /api/download-model
```

---

# ⚡ Workflow

1. Upload dataset
2. Analyze dataset
3. Build pipeline
4. Train models
5. Compare performance
6. Visualize results
7. Generate predictions

---

# 🎯 Use Cases

* Data Scientists
* ML Engineers
* Students
* Hackathons
* Research Projects
* AutoML Experiments

---

# 🌙 UI Features

* Light Theme
* Dark Theme
* Drag-Drop Workflow
* Real-Time Console
* Responsive Design

---

Steps:

1. Fork repository
2. Create branch
3. Make changes
4. Submit pull request

---

# 🚀 FlowML

**Build Machine Learning Pipelines. Visually. Intelligently. Effortless**
