# SmartRoute AI — Testing Checklist

Use this checklist to verify the frontend prototype in VS Code.

## 1. Start the application
- [ ] Open the repository folder in VS Code.
- [ ] Open `index.html` with Live Server, or open it directly in a browser.
- [ ] Confirm the dashboard loads without a blank screen.
- [ ] Open browser Developer Tools (F12) and check the Console for JavaScript errors.

## 2. Dashboard checks
- [ ] Confirm the sample check-ins appear in the dashboard.
- [ ] Confirm total passenger count is calculated from the sample trips.
- [ ] Confirm unique route count is displayed.
- [ ] Confirm high-demand trip count is displayed.

## 3. Passenger check-in checks
- [ ] Submit a trip with a valid origin, destination, date, time, and passenger count.
- [ ] Confirm the success message appears.
- [ ] Confirm the dashboard totals and demand table update.
- [ ] Try entering the same origin and destination; the form should reject it.
- [ ] Try a passenger count outside 1–100; the form should reject it.
- [ ] Refresh the browser and confirm the saved check-in remains.

## 4. Route planner checks
- [ ] Search for a route that exists in the sample data.
- [ ] Confirm the matching passenger demand is shown.
- [ ] Search for a new origin/destination pair.
- [ ] Confirm the result explains that no matching check-ins have been recorded.
- [ ] Try the same origin and destination; the planner should reject it.

## 5. Reset checks
- [ ] Select **Reset demo data**.
- [ ] Confirm the browser asks for confirmation.
- [ ] Confirm the original sample trips are restored after approval.

## Expected behavior and limitations
- Data is stored in the current browser using `localStorage`.
- Data does not synchronize across different browsers or devices.
- Route suggestions are demonstration outputs, not verified road routes.
- Demand levels use simple passenger-count thresholds.
- There is no backend, login system, live GPS, live bus feed, or trained forecasting model in this frontend prototype.

## Bug report template
When a test fails, record:
1. Test number:
2. Steps performed:
3. Expected result:
4. Actual result:
5. Browser console error, if any:

This checklist is for manual frontend testing and does not represent automated test coverage.
