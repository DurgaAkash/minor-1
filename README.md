# SmartRoute AI
## AI-Based Smart Rural Transportation Planning and Optimization System

A beginner-friendly frontend prototype for rural transportation planning.

### Current modules
1. Landing page
2. Passenger login with keyword-based travel intent detection (demo only)
3. India-wide road route search using Leaflet, OpenStreetMap, India-restricted Nominatim geocoding and OSRM
4. Passenger check-ins and service requests
5. Admin request review, approval and rejection
6. CSV-based historical rural passenger demand dataset
7. Next-day demand estimates using a three-record moving average
8. Random Forest Regression demand prediction through a Python API\n9. Rule-based recommendation assistant for bus capacity and schedule planning

### Project structure
```
minor-1/
├── index.html
├── login.html
├── passenger.html
├── admin.html
├── data/
│   └── rural_transport_demand.csv
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── login.js
│   ├── passenger.js
│   └── admin.js
└── assets/
    └── README.md
```

### Run locally
1. Clone or pull the repository.
2. Open the project folder in VS Code.
3. Start VS Code Live Server from `index.html`.
4. Open `admin.html` and sign in with the demo admin credentials shown on the page.
5. The admin page fetches `data/rural_transport_demand.csv` and displays demand forecasts and recommendations.\n6. To enable Random Forest predictions, open a second VS Code terminal and run the Python service commands below.

### India-wide route search\n- Passengers can enter starting points and destinations anywhere in India; geocoding is restricted to India.\n- OpenStreetMap/Nominatim finds the locations and OSRM calculates an estimated driving route, distance and duration.\n- This does not provide verified bus operators, fares, schedules, seat availability or live GPS tracking.\n- Public map services may apply usage limits; production deployment should follow provider policies and consider a dedicated routing/geocoding service.\n\n### Dataset notes
The included CSV is **synthetic sample data created for prototype testing**. It is not official APSRTC or government passenger data. Replace it with verified passenger counts before using the forecasts for real transport planning.

Columns: `Date, Source, Destination, Time, Passengers`.

### Forecast and recommendation logic
- Forecast: average of the latest three daily records for each source, destination and time slot.
- Bus capacity assumption: 50 passengers per bus (editable in `js/admin.js`).
- Recommendation assistant: compares the forecast with assumed capacity and suggests whether to monitor demand or consider an additional bus/departure.
- The admin makes the final decision; the system does not automatically change or publish schedules.

### Important prototype limitations
- CSV forecasting is a simple moving-average baseline, not a trained machine-learning model.
- The recommendation assistant is rule-based; it is not an autonomous or LLM-powered agent.
- Passenger check-ins and requests use browser localStorage, so they are not shared between different devices.
- Demo login credentials are not secure authentication.
- Map routing is not live bus GPS tracking.
- Use Live Server or another local HTTP server; opening HTML directly as a file can prevent CSV fetch from working.

### Random Forest ML service

The admin dashboard first tries to use the Python prediction API. If the API is not running, it automatically falls back to the existing three-record moving-average forecast.

**Windows setup (run from the project root in a second VS Code terminal):**

```powershell
py -m venv .venv
.venv\\Scripts\\activate
pip install -r ml-service/requirements.txt
python ml-service/app.py
```

Keep this terminal running. The API starts at `http://127.0.0.1:5000`. Open or refresh `admin.html` using Live Server in your browser. The dashboard requests `/api/predict` from the local Python service.

**Model approach:**
- Algorithm: `RandomForestRegressor` from Scikit-learn.
- Features: route, time slot, previous day's passengers, previous two days' passengers, previous three-day average, and day of week.
- Evaluation: temporal holdout (latest supervised record from each route/time group) with Mean Absolute Error (MAE).
- The model is retrained from the CSV when a prediction request is made.
- If Python dependencies or the service are unavailable, the dashboard continues using the moving-average fallback.

**Limitations:** the included CSV has only a small number of synthetic observations. Random Forest output and MAE are demonstration results, not reliable real-world transport forecasts. Add a larger, verified dataset covering more dates, routes, holidays and seasonal variation before evaluating the model for actual planning. Bus capacity recommendations remain advisory and require admin approval.


### Schedule optimization
- Converts predicted passenger demand into a suggested bus count using `ceil(predicted_passengers / 50)`.
- Illustrative departures start at 7:00 AM (Morning), 12:00 PM (Afternoon), or 5:00 PM (Evening), spaced 30 minutes apart when multiple buses are suggested.
- Admin can approve or reject each proposal and add a decision note.
- Decisions are stored in browser localStorage and are limited to that browser profile.
- These proposals are not live operator timetables. Real planning must account for travel duration, vehicle and driver availability, depot constraints and verified passenger demand.
