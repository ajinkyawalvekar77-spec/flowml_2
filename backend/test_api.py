import os
import requests
import json
import pandas as pd
from sklearn.datasets import load_iris

BASE_URL = os.environ.get("FLOWML_API_URL", "http://127.0.0.1:8000/api")
DEV_TOKEN = "dev-token-engineer"
HEADERS = {"Authorization": f"Bearer {DEV_TOKEN}"}


def main():
    print("Generating sample iris dataset...")
    iris = load_iris()
    df = pd.DataFrame(data=iris.data, columns=iris.feature_names)
    df['target'] = iris.target
    sample_file = "iris_test.csv"
    df.to_csv(sample_file, index=False)
    print(f"Saved {sample_file}")

    try:
        # 1. Upload
        print("\n--- 1. Uploading Dataset ---")
        with open(sample_file, "rb") as f:
            files = {"file": (sample_file, f, "text/csv")}
            r = requests.post(f"{BASE_URL}/upload", files=files, headers=HEADERS)
        print("Status Code:", r.status_code)
        assert r.status_code == 200, f"Upload failed: {r.text}"
        upload_data = r.json()
        dataset_id = upload_data["dataset_id"]
        print(f"Dataset uploaded successfully: id={dataset_id}")

        # 2. Analyze
        print("\n--- 2. Analyzing Dataset ---")
        r = requests.post(f"{BASE_URL}/analyze", json={"dataset_id": dataset_id}, headers=HEADERS)
        print("Status Code:", r.status_code)
        assert r.status_code == 200, f"Analyze failed: {r.text}"
        analysis = r.json()
        print("Dataset shape:", analysis.get("shape"))
        print("Columns:", list(analysis.get("summary", {}).keys()))

        # 3. Preprocess
        print("\n--- 3. Preprocessing Dataset ---")
        prep_payload = {
            "dataset_id": dataset_id,
            "config": {
                "missing_values": "mean",
                "scaling": "standard"
            },
            "target_column": "target"
        }
        r = requests.post(f"{BASE_URL}/preprocess", json=prep_payload, headers=HEADERS)
        print("Status Code:", r.status_code)
        assert r.status_code == 200, f"Preprocess failed: {r.text}"
        prep_data = r.json()
        processed_id = prep_data.get("processed_dataset_id", dataset_id)
        print(f"Preprocessed dataset: id={processed_id}")

        # 4. Train
        print("\n--- 4. Training Models ---")
        train_payload = {
            "dataset_id": dataset_id,
            "processed_dataset_id": processed_id,
            "target_column": "target",
            "task_type": "classification"
        }
        r = requests.post(f"{BASE_URL}/train", json=train_payload, headers=HEADERS)
        print("Status Code:", r.status_code)
        assert r.status_code == 200, f"Train failed: {r.text}"
        train_data = r.json()
        model_id = train_data["model_id"]
        best_model = train_data.get("best_model")
        print(f"Training completed: model_id={model_id}, best_model={best_model}")

        # 5. Visualizations
        print("\n--- 5. Generating Visualizations ---")
        viz_payload = {
            "dataset_id": dataset_id,
            "model_id": model_id
        }
        r = requests.post(f"{BASE_URL}/visualizations", json=viz_payload, headers=HEADERS)
        print("Status Code:", r.status_code)
        assert r.status_code == 200, f"Visualizations failed: {r.text}"
        viz_data = r.json()
        print("Generated visualization keys:", list(viz_data.keys()))

        # 6. Predict
        print("\n--- 6. Running Inference / Predictions ---")
        pred_payload = {
            "dataset_id": dataset_id,
            "model_id": model_id,
            "target_column": "target"
        }
        r = requests.post(f"{BASE_URL}/predict", json=pred_payload, headers=HEADERS)
        print("Status Code:", r.status_code)
        assert r.status_code == 200, f"Predict failed: {r.text}"
        pred_data = r.json()
        preds = pred_data.get("predictions", [])
        print(f"Successfully generated {len(preds)} predictions! Snippet: {preds[:10]}")

        print("\n=======================================================")
        print("FlowML Full End-to-End API Test PASSED Successfully!")
        print("=======================================================")

    finally:
        if os.path.exists(sample_file):
            os.remove(sample_file)


if __name__ == "__main__":
    main()
