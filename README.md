<p align="center">
  <img src="frontend/public/flowml-icon.svg" width="80" height="80" alt="FlowML" />
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
* Light & Dark Theme
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

# 🚀 Getting Started

## 1. Clone Repository

```bash
git clone https://github.com/vishwajeetchandole/flowml-studio.git
cd flowml-studio
```

---

## 2. Backend Setup (FastAPI & ML Engine)

In your first terminal:

```bash
cd "Source Code/backend"

# Create and activate virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS / Linux:
# source venv/bin/activate

# Install dependencies (FastAPI, Scikit-Learn, Pandas, NumPy, Uvicorn, Matplotlib, Pytest)
pip install -r requirements.txt
pip install pytest httpx

# Start backend API server with auto-reload
uvicorn app:app --reload --port 8000
```

Backend will be running at: `http://localhost:8000` (Interactive Swagger docs: `http://localhost:8000/docs`)

### Environment Variables (.env)

| Variable | Default | Description |
|---|---|---|
| `DEV_AUTH` | `1` | Enable local dev authentication bypass (no Firebase keys needed) |
| `DEV_UID` | `dev_user_123` | Default UID issued in development mode |
| `ADMIN_UIDS` | `dev_user_123,admin_user` | Comma-separated list of UIDs granted Admin Ops privileges |
| `EXECUTION_TIMEOUT_SECONDS` | `15` | Default watchdog timeout for custom Python executions |
| `MAX_EXECUTION_MEMORY_MB` | `256` | Maximum allowed resident memory for Python worker sandboxes |
| `MAX_UPLOAD_SIZE_MB` | `25` | Maximum upload size for datasets (returns HTTP 413 if exceeded) |
| `DOCKER_WORKER_IMAGE` | `flowml-worker:latest` | Docker image tag for containerized Python execution |
| `ENABLE_PYTHON_SANDBOX` | `true` | Enable Python Studio execution (`false` disables it) |

---

## 3. Worker Container Setup (Docker Sandbox)

FlowML executes all user-authored code in an isolated container sandbox with zero network access and strict resource boundaries:

```bash
cd "Source Code"

# Build isolated Python 3.10 worker image:
docker build -t flowml-worker:latest -f docker/Dockerfile.worker .
```

> **Note:** If Docker is not running or unavailable in local environments, FlowML automatically falls back to an isolated child process sandbox with active memory monitoring and timeout enforcement.

---

## 4. Frontend Setup (React 19 + Vite)

In a second terminal:

```bash
cd "Source Code/frontend"

# Install node packages
npm install

# Start Vite dev server
npm run dev
```

Frontend will be running at: `http://localhost:5173`

Python Studio is enabled by default. Set `VITE_ENABLE_PYTHON_SANDBOX=false` in the frontend environment to hide the editor and set `ENABLE_PYTHON_SANDBOX=false` in the backend environment to reject execution requests.

---

## 5. Running the Test Suite

Execute the comprehensive automated test suite (60 tests covering DAG compilation, isolated sandboxes, memory limits, rate limiting, and multi-user concurrency):

```bash
cd "Source Code/backend"
python -m pytest tests/ -v
```

---

# 🔌 API Endpoint Reference

### Authentication & Account
* `POST /api/account` - User registration / status check
* `DELETE /api/account` - Delete account and purge all user artifacts (GDPR)
* `DELETE /api/account/data` - Wipe all datasets and trained models for authenticated user

### Datasets & Profiling
* `POST /api/upload` - Ingest CSV, Excel, or JSON files (enforces 25MB limit)
* `GET /api/datasets` - List user-owned datasets with dimensions and status
* `GET /api/datasets/{id}/preview` - Dataset schema, dtypes, nulls, and duplicate profiling
* `DELETE /api/datasets/{id}` - Delete user dataset

### Preprocessing & Pipelines
* `POST /api/preprocess` - Execute imputation, scaling, label encoding, column filtering
* `POST /api/runs` - Compile and submit visual DAG pipeline for asynchronous execution
* `GET /api/runs` - List user execution runs with status and duration
* `GET /api/runs/{id}` - Inspect run status, live logs, node state, and metrics
* `POST /api/runs/{id}/stop` - Abort active pipeline execution

### Model Training & Inference
* `POST /api/train` - Train a configured `model_name` or compare models with AutoML; evaluation is calculated on a held-out split
* `GET /api/models` - List trained model metadata, algorithm, parameters, and artifact status
* `GET /api/models/{model_id}/download` - Download the estimator together with fitted preprocessing
* `POST /api/predict` - Predict from an owned `dataset_id` or manual `rows`; supplied target labels are evaluated separately

The training response includes classification accuracy, macro precision/recall/F1, confusion matrix and class-wise metrics, or regression MAE/MSE/RMSE/R². Prediction rejects feature schemas that do not match the trained model and reports that supervised metrics are unavailable when inputs have no labels.

### Isolated Python Code Studio
* `POST /api/code/run` - Execute Python script in isolated Docker / sandbox worker
* `POST /api/code/runs/{run_id}/stop` - Abort active running Python worker
* `GET /api/code/history` - Retrieve previous execution logs and durations

### Admin Operations & Security Center (`/app/admin`)
* `GET /api/admin/users` - View all registered accounts, storage usage, and active status
* `POST /api/admin/users/{uid}/status` - Activate or deactivate user accounts
* `GET /api/admin/jobs` - Global job queue overview (queued, active, completed, failed)
* `GET /api/admin/system` - Live CPU, RAM, and disk storage metrics
* `GET /api/admin/limits` - Retrieve system timeouts, memory caps, and upload limits
* `POST /api/admin/limits` - Update system execution limits and quotas
* `GET /api/admin/audit-logs` - Inspect security audit trail and access alerts

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
