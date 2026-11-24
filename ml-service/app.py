from datetime import timedelta
from pathlib import Path
import sqlite3

import pandas as pd
from flask import Flask, jsonify
from flask_cors import CORS
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "rural_transport_demand.csv"
DB_FILE = ROOT / "backend" / "smartroute.db"

app = Flask(__name__)
CORS(app)

CATEGORICAL_FEATURES = ["route", "time"]
NUMERIC_FEATURES = ["lag_1", "lag_2", "lag_3", "rolling_mean", "day_of_week"]


def make_model():
    preprocessing = ColumnTransformer([
        ("categories", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ("numbers", "passthrough", NUMERIC_FEATURES),
    ])
    return Pipeline([
        ("preprocessing", preprocessing),
        ("regressor", RandomForestRegressor(
            n_estimators=200,
            random_state=42,
            min_samples_leaf=1
        )),
    ])


def load_csv_data():
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_FILE}")
    data = pd.read_csv(DATA_FILE)
    required = {"Date", "Source", "Destination", "Time", "Passengers"}
    if not required.issubset(data.columns):
        raise ValueError("CSV must contain Date, Source, Destination, Time and Passengers.")
    data["Date"] = pd.to_datetime(data["Date"], errors="coerce")
    data["Passengers"] = pd.to_numeric(data["Passengers"], errors="coerce")
    data = data.dropna(subset=["Date", "Source", "Destination", "Time", "Passengers"])
    data = data[data["Passengers"] >= 0].copy()
    data["Source"] = data["Source"].astype(str).str.strip()
    data["Destination"] = data["Destination"].astype(str).str.strip()
    data["Time"] = data["Time"].astype(str).str.strip()
    return data


def load_sqlite_checkins():
    if not DB_FILE.exists():
        return pd.DataFrame(columns=["Date", "Source", "Destination", "Time", "Passengers"]), 0

    try:
        with sqlite3.connect(DB_FILE) as conn:
            tables = pd.read_sql_query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='checkins'",
                conn
            )
            if tables.empty:
                return pd.DataFrame(columns=["Date", "Source", "Destination", "Time", "Passengers"]), 0
            rows = pd.read_sql_query(
                "SELECT source, destination, travel_time, passengers, created_at FROM checkins",
                conn
            )
    except sqlite3.Error as error:
        raise RuntimeError(f"Could not read SQLite check-ins: {error}") from error

    if rows.empty:
        return pd.DataFrame(columns=["Date", "Source", "Destination", "Time", "Passengers"]), 0

    raw_count = len(rows)
    rows["Date"] = pd.to_datetime(rows["created_at"], errors="coerce")
    rows["Passengers"] = pd.to_numeric(rows["passengers"], errors="coerce")
    rows = rows.dropna(subset=["Date", "Passengers"])
    rows = rows[rows["Passengers"] >= 0].copy()
    rows["Date"] = rows["Date"].dt.normalize()
    rows["Source"] = rows["source"].astype(str).str.strip()
    rows["Destination"] = rows["destination"].astype(str).str.strip()
    rows["Time"] = rows["travel_time"].astype(str).str.strip()
    rows = rows[["Date", "Source", "Destination", "Time", "Passengers"]]

    # Multiple check-ins for the same route and time on one day become one daily total.
    daily = rows.groupby(
        ["Date", "Source", "Destination", "Time"], as_index=False
    )["Passengers"].sum()
    return daily, raw_count


def load_data():
    csv_data = load_csv_data()
    if csv_data.empty:
        raise ValueError("CSV dataset contains no valid passenger records.")

    live_data, raw_checkin_count = load_sqlite_checkins()

    # For a date/route/time already represented in the CSV, prefer the real SQLite
    # daily total instead of adding synthetic and real counts together.
    if not live_data.empty:
        keys = ["Date", "Source", "Destination", "Time"]
        csv_data = csv_data.merge(
            live_data[keys].drop_duplicates(),
            on=keys,
            how="left",
            indicator=True
        )
        csv_data = csv_data[csv_data["_merge"] == "left_only"].drop(
            columns=["_merge"]
        )
        data = pd.concat([csv_data, live_data], ignore_index=True)
    else:
        data = csv_data

    data["route"] = data["Source"] + " -> " + data["Destination"]
    data["Time"] = data["Time"].astype(str).str.strip()
    data = data.sort_values("Date").reset_index(drop=True)

    source_info = {
        "csv_records_used": int(len(csv_data)),
        "sqlite_daily_records_used": int(len(live_data)),
        "sqlite_checkin_submissions": int(raw_checkin_count),
        "combined_daily_records": int(len(data)),
    }
    return data, source_info


def build_training_rows(data):
    features = []
    for (route, time_slot), group in data.groupby(["route", "Time"]):
        group = group.sort_values("Date").reset_index(drop=True)
        values = group["Passengers"].astype(float).tolist()
        dates = group["Date"].tolist()
        for index in range(3, len(group)):
            target_date = dates[index]
            features.append({
                "route": route,
                "time": time_slot,
                "lag_1": values[index - 1],
                "lag_2": values[index - 2],
                "lag_3": values[index - 3],
                "rolling_mean": sum(values[index - 3:index]) / 3,
                "day_of_week": target_date.dayofweek,
                "target": values[index],
                "source": group.loc[index, "Source"],
                "destination": group.loc[index, "Destination"],
            })
    return pd.DataFrame(features)


def train_and_predict():
    data, source_info = load_data()
    training_rows = build_training_rows(data)
    if len(training_rows) < 10:
        raise ValueError(
            "At least 10 training examples are required. Add more daily CSV records "
            "or collect more check-ins across multiple days."
        )

    validation_indices = training_rows.groupby(["route", "time"]).tail(1).index
    train_part = training_rows.drop(index=validation_indices)
    validation_part = training_rows.loc[validation_indices]

    if len(train_part) < 5 or validation_part.empty:
        raise ValueError("Not enough historical records for a temporal holdout evaluation.")

    validation_model = make_model()
    validation_model.fit(train_part[CATEGORICAL_FEATURES + NUMERIC_FEATURES], train_part["target"])
    validation_predictions = validation_model.predict(validation_part[CATEGORICAL_FEATURES + NUMERIC_FEATURES])
    mae = mean_absolute_error(validation_part["target"], validation_predictions)

    final_model = make_model()
    final_model.fit(training_rows[CATEGORICAL_FEATURES + NUMERIC_FEATURES], training_rows["target"])

    forecast_date = data["Date"].max() + timedelta(days=1)
    future_rows = []
    for (route, time_slot), group in data.groupby(["route", "Time"]):
        group = group.sort_values("Date")
        values = group["Passengers"].astype(float).tolist()
        if len(values) < 3:
            continue
        last = group.iloc[-1]
        future_rows.append({
            "route": route,
            "time": time_slot,
            "lag_1": values[-1],
            "lag_2": values[-2],
            "lag_3": values[-3],
            "rolling_mean": sum(values[-3:]) / 3,
            "day_of_week": forecast_date.dayofweek,
            "source": str(last["Source"]),
            "destination": str(last["Destination"]),
            "training_records": len(group),
        })

    future = pd.DataFrame(future_rows)
    if future.empty:
        raise ValueError("No route groups have enough records to forecast.")
    predicted = final_model.predict(future[CATEGORICAL_FEATURES + NUMERIC_FEATURES])

    predictions = []
    for row, value in zip(future.to_dict(orient="records"), predicted):
        predictions.append({
            "source": row["source"],
            "destination": row["destination"],
            "time": row["time"],
            "predicted_passengers": round(max(0.0, float(value)), 1),
            "training_records": row["training_records"],
        })

    return {
        "model": "Random Forest Regression",
        "forecast_date": forecast_date.strftime("%Y-%m-%d"),
        "training_samples": int(len(training_rows)),
        "validation_samples": int(len(validation_part)),
        "mae": round(float(mae), 2),
        "data_sources": source_info,
        "predictions": predictions,
        "note": (
            "Forecast uses the project CSV plus daily passenger check-in totals from "
            "the local SQLite database. CSV records are synthetic sample data; "
            "SQLite check-ins are user-entered prototype data."
        ),
    }


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "SmartRoute AI Random Forest API",
        "sqlite_available": DB_FILE.exists()
    })


@app.get("/api/predict")
def predict():
    try:
        return jsonify(train_and_predict())
    except Exception as error:
        return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
