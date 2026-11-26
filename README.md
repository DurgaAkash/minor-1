# SmartRoute AI
## AI-Based Smart Rural Transportation Planning and Optimization System

SmartRoute AI is a student prototype for collecting rural passenger demand, estimating demand, and preparing admin-reviewed bus schedule proposals. It uses a JavaScript frontend, a Flask/SQLite API, and a separate Python Random Forest service.

## Implemented modules
1. Landing page and 13-language selector.
2. Passenger and admin sign-in backed by the Flask API.
3. Role-based API access using expiring bearer-token sessions.
4. Passenger route finder for locations in India using Leaflet, OpenStreetMap, Nominatim and OSRM.
5. Passenger check-ins and service requests stored in SQLite and linked to the signed-in passenger.
6. Passenger request history filtered to the signed-in passenger; admin can view all requests.
7. Random Forest Regression demand prediction using the sample CSV and SQLite check-ins.
8. Server-side demand decision agent that runs automatically when a passenger submits a request or check-in. It does not depend on the admin dashboard being open.
9. Explainable agent audit history, including the data basis and fallback explanation.
10. Admin review of proposed schedules; only approved schedules are visible to passengers.
11. Automatic passenger status/schedule refresh every 15 seconds.
12. Automated API tests for login, role permissions, passenger data isolation, automatic agent execution and schedule publishing.

## Project structure
```
minor-1/
├── index.html
├── login.html
├── passenger.html
├── admin.html
├── data/rural_transport_demand.csv
├── backend/
│   ├── app.py
│   └── smartroute.db          # created automatically; do not commit
├── ml-service/
│   ├── app.py
│   └── requirements.txt
├── tests/test_workflow.py
├── css/style.css
└── js/
    ├── main.js
    ├── login.js
    ├── passenger.js
    └── admin.js
```

## Run locally (Windows PowerShell)

Open the repository folder in VS Code. Run each service in a separate terminal and keep all three terminals open.

### 1. Install dependencies
```powershell
python -m pip install -r backend/requirements.txt
python -m pip install -r ml-service/requirements.txt
```

### 2. Start the Flask/SQLite API
```powershell
python backend/app.py
```
The API runs at `http://127.0.0.1:5001`. The SQLite database and demo accounts are initialized automatically.

### 3. Start the Random Forest service
```powershell
python ml-service/app.py
```
The ML service runs at `http://127.0.0.1:5000`.

### 4. Start the frontend
```powershell
python -m http.server 5500
```
Open `http://127.0.0.1:5500/index.html`.

### Local demo accounts
- Passenger: `passenger` / `travel123`
- Admin: `admin` / `admin123`

These are local demonstration credentials only. Change them before sharing the application. Set the environment variables before the first backend start so the database seeds the replacement accounts:
```powershell
$env:SMARTROUTE_PASSENGER_PASSWORD = "replace-with-a-strong-passenger-password"
$env:SMARTROUTE_ADMIN_PASSWORD = "replace-with-a-strong-admin-password"
python backend/app.py
```
Optional username variables: `SMARTROUTE_PASSENGER_USERNAME` and `SMARTROUTE_ADMIN_USERNAME`. If demo users already exist in `backend/smartroute.db`, changing environment variables alone does not reset their stored password hashes. For a fresh local demo database, stop the backend and back up/remove `backend/smartroute.db` before restarting; this deletes the locally stored demo records.

## Passenger-to-admin workflow
1. Passenger signs in and submits a check-in or bus service request.
2. The backend stores the record with the passenger's account ID.
3. The backend immediately runs the server-side demand decision agent. The admin page does not need to be open.
4. The agent creates or updates a PENDING schedule proposal and records its evidence/explanation.
5. Admin signs in and reviews the proposed schedule.
6. Admin approves or rejects it and can add a decision note.
7. Only APPROVED schedules are returned to the passenger portal. The passenger's request list contains only their own submissions.
8. Passenger portal refreshes request status and approved schedules approximately every 15 seconds.

## Demand prediction and agent logic
- The Random Forest service trains from the project CSV plus daily totals from SQLite check-ins.
- Features include route, time slot, recent passenger counts, rolling average and day of week.
- When the model returns an exact source/destination/time match, the agent combines that forecast with 50% of pending-request passenger count as an additional planning signal.
- When there is no exact model match or the ML service is unavailable, the agent uses observed check-ins and pending requests as a fallback. It labels this as an observed-data fallback and does not call it an ML prediction.
- Suggested bus count is `ceil(planning demand / 50)`, using an assumed capacity of 50 passengers per bus.
- Departure times are illustrative 30-minute intervals starting at 7:00 AM, 12:00 PM or 5:00 PM based on the selected time slot.
- Admin approval is always required before a proposed schedule is published.

## Data, map and prototype limitations
- The included CSV is synthetic sample data, not official APSRTC, government or operator data.
- The small sample dataset is not sufficient for reliable real-world forecasting. Add verified historical records across more dates, routes, holidays and seasonal periods before using predictions operationally.
- The 50-passenger bus capacity and 30-minute departure intervals are assumptions, not verified fleet or operator information.
- Nominatim and OSRM provide geocoding and road-route estimates. They do not confirm bus operators, fares, service availability, seat availability or live GPS positions. Follow public map-service usage policies.
- SQLite is local to the computer running the backend; it is not cloud-hosted.
- Authentication now uses server-verified password hashes, role checks and expiring bearer tokens, but the default accounts are demo credentials. This remains a local academic prototype: add HTTPS, rate limiting, secure deployment secrets, backups, monitoring and a production identity/session strategy before public deployment.
- Existing rows from older database versions may have no passenger owner ID. Admin can still see them, but they are not shown as a passenger's personal history.

## Automated tests
Install Flask dependencies, then run from the repository root:
```powershell
python -m unittest discover -s tests -v
```
The tests use a temporary database and do not modify the local development database.
