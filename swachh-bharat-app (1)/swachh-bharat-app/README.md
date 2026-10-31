# Swachh Bharat Cleanliness Tracker (MERN, single page)

## Run it
1. Install Node.js and MongoDB (or use a free MongoDB Atlas URL).
2. Backend:  cd server && npm install && cp .env.example .env && npm start   (runs on :5000)
3. Frontend: cd client && npm install && npm run dev                          (runs on :5173)
4. Open http://localhost:5173  (Admin key default: admin123, change it in server/.env)

## Troubleshooting
- Page shows 0 areas / empty dropdown -> the backend is not connected to MongoDB. Check the server terminal and MONGO_URI in server/.env.
- Location tag needs the browser's location permission (works on localhost).
