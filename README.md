# SmartRoute AI
## AI-Based Smart Rural Transportation Planning and Optimization System

A beginner-friendly frontend prototype for rural transportation planning.

### Current modules
1. Landing page
2. Passenger login with keyword-based travel intent detection (demo only)
3. Passenger route search with Leaflet, OpenStreetMap, Nominatim and OSRM
4. Passenger check-ins and service requests
5. Admin request review, approval and rejection
6. CSV-based historical rural passenger demand dataset
7. Next-day demand estimates using a three-record moving average
8. Rule-based recommendation assistant for bus capacity and schedule planning

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
5. The admin page fetches `data/rural_transport_demand.csv` and displays demand forecasts and recommendations.

### Dataset notes
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
