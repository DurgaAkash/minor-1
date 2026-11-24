# SmartRoute AI
## AI-Based Smart Rural Transportation Planning and Optimization System

A prototype for rural transportation planning and passenger-demand-based schedule recommendations.

### Current modules
1. Landing page
2. Passenger sign-in (demo only)
3. India-wide road route search using Leaflet, OpenStreetMap, Nominatim and OSRM
4. Passenger check-ins and service requests stored in SQLite
5. Admin request review, approval and rejection
6. Synthetic CSV historical passenger-demand dataset
7. Random Forest Regression demand prediction using CSV and SQLite check-ins
8. Rule-based bus-capacity and schedule recommendations
9. Admin-approved schedules stored in SQLite and displayed on the Passenger Dashboard

### Project structure
```
minor-1/
├── index.html
├── login.html
├── passenger.html
├── admin.html
├── data/rural_transport_demand.csv
├── backend/app.py
├── ml-service/app.py
├── ml-service/requirements.txt
├── css/style.css
└── js/
    ├── main.js
    ├── login.js
    ├── passenger.js
    └── admin.js
```

### Run locally
1. Pull the latest repository changes and open the project folder in VS Code.
2. Start the SQLite backend: `python backend/app.py`.
3. Start the ML service in another terminal: `python ml-service/app.py`.
4. Open `index.html` using VS Code Live Server.
5. Passenger demo login: `passenger` / `travel123`.
6. Admin demo login: `admin` / `admin123`.

### India-wide road route search
- Enter starting points and destinations anywhere in India.
- Nominatim geocodes locations and OSRM calculates an estimated road route, distance and driving duration.
- This does not provide verified bus operators, fares, schedules, seat availability or live GPS tracking.
- Public map services may apply usage limits; follow their policies for prototype use and arrange a suitable provider for production.

### Demand prediction
- The Python service trains a Random Forest Regression model from the project CSV plus daily totals from SQLite passenger check-ins.
- Features include route, time slot, recent passenger counts, rolling average and day of week.
- The included CSV is synthetic sample data, not official APSRTC or government data. SQLite records are user-entered prototype check-ins.
- The small dataset is not sufficient for reliable real-world forecasts; add verified records covering more dates, routes, holidays and seasonal variation.

### Schedule approval and publishing
- Predicted demand is converted to an estimated bus count using an assumed capacity of 50 passengers per bus.
- Departure proposals use illustrative 30-minute intervals starting at 7:00 AM, 12:00 PM or 5:00 PM according to the time slot.
- Admin can approve or reject proposals and add a note.
- Approved schedules are saved in SQLite and shown under Published Bus Schedules on the Passenger Dashboard.
- These are prototype proposals, not confirmed operator timetables. Confirm actual service details with the bus operator before travel.

### Important prototype limitations
- Passenger and admin demo credentials are not secure authentication.
- SQLite is stored on the computer running the backend; it is not cloud-hosted.
- Passenger request listing is currently a prototype-wide list and is not filtered by authenticated passenger identity.
- Bus capacity is an assumption; real planning must account for travel duration, vehicle/driver availability, depot constraints and verified demand.
- The map displays road routing, not live bus GPS tracking.
- Use Live Server or another local HTTP server rather than opening HTML files directly.
