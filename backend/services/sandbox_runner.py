"""
FlowML Isolated Sandbox Runner.

This script executes isolated user Python scripts inside a subprocess or container.
It is launched in a clean process environment with NO application secrets.
It injects upstream DataFrames if provided, captures standard streams and matplotlib figures,
and writes execution results to a JSON output file.
"""

import sys
import os
import json
import time
import traceback
import io
import base64

def run_isolated():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: sandbox_runner.py <input_spec.json> <output_result.json>"}))
        sys.exit(1)

    input_spec_path = sys.argv[1]
    output_result_path = sys.argv[2]

    start_time = time.time()
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    result = {
        "status": "failed",
        "stdout": "",
        "stderr": "",
        "traceback": None,
        "duration_ms": 0,
        "plots": [],
        "output_preview": None,
        "output_csv_path": None,
    }

    try:
        with open(input_spec_path, "r", encoding="utf-8") as f:
            spec = json.load(f)

        code_text = spec.get("code", "")
        input_data_path = spec.get("input_data_path")
        output_data_dir = spec.get("output_data_dir", os.path.dirname(output_result_path))

        # Allowed libraries namespace
        import numpy as np
        import pandas as pd
        import sklearn
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        # Global execution scope
        exec_globals = {
            "__builtins__": __builtins__,
            "np": np,
            "numpy": np,
            "pd": pd,
            "pandas": pd,
            "sklearn": sklearn,
            "plt": plt,
            "matplotlib": matplotlib,
        }

        # Load input DataFrame if specified
        df = None
        if input_data_path and os.path.exists(input_data_path):
            try:
                if input_data_path.endswith(".csv"):
                    df = pd.read_csv(input_data_path)
                elif input_data_path.endswith((".xls", ".xlsx")):
                    df = pd.read_excel(input_data_path)
            except Exception as e:
                stderr_capture.write(f"Warning: Failed to load input dataset: {e}\n")

        exec_globals["df"] = df
        exec_globals["input_df"] = df
        exec_globals["output_df"] = None

        # Capture std streams during execution
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = stdout_capture
        sys.stderr = stderr_capture

        try:
            # Execute user code
            exec(code_text, exec_globals)
            result["status"] = "completed"
        except Exception as exc:
            result["status"] = "failed"
            result["traceback"] = traceback.format_exc()
            stderr_capture.write(f"\n{result['traceback']}")
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        # Capture any open matplotlib figures
        try:
            fig_nums = plt.get_fignums()
            for num in fig_nums:
                fig = plt.figure(num)
                buf = io.BytesIO()
                fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
                buf.seek(0)
                b64_str = base64.b64encode(buf.read()).decode("utf-8")
                result["plots"].append(b64_str)
            plt.close("all")
        except Exception as e:
            stderr_capture.write(f"Warning: Failed to capture plots: {e}\n")

        # Inspect if output DataFrame was produced
        out_df = exec_globals.get("output_df")
        if out_df is None and isinstance(exec_globals.get("df"), pd.DataFrame):
            out_df = exec_globals.get("df")

        if isinstance(out_df, pd.DataFrame):
            out_csv = os.path.join(output_data_dir, "output_transformed.csv")
            try:
                out_df.to_csv(out_csv, index=False)
                result["output_csv_path"] = out_csv
                result["output_preview"] = {
                    "rows": int(len(out_df)),
                    "columns": list(out_df.columns),
                    "dtypes": {c: str(d) for c, d in out_df.dtypes.items()},
                    "head": json.loads(out_df.head(10).to_json(orient="records")),
                }
            except Exception as e:
                stderr_capture.write(f"Warning: Failed to serialize output DataFrame: {e}\n")

    except Exception as outer_exc:
        result["status"] = "failed"
        result["traceback"] = traceback.format_exc()
        stderr_capture.write(f"Execution Error: {outer_exc}\n")

    result["duration_ms"] = int((time.time() - start_time) * 1000)
    result["stdout"] = stdout_capture.getvalue()[:100000] # Bound output to 100KB
    result["stderr"] = stderr_capture.getvalue()[:100000]

    with open(output_result_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

if __name__ == "__main__":
    run_isolated()
