# Antigravity React Client

This is the new React frontend for the Antigravity API.

## Prerequisites

- Node.js installed.
- The backend server running on port **8045**.

## Project Structure

- `src/`: Source code
  - `api/`: Axios setup
  - `features/`: Auth, Tokens, Settings modules
  - `context/`: Global state (Auth, I18n, Toast)
- `public/`: Static assets (images, locales)

## How to Run

### 1. Start the Backend
Open a terminal in the root directory (`d:\antigravity2api-nodejs`) and run:
```bash
npm start
# OR node index.js
```
The backend must be running for the frontend APIs to work.

### 2. Start the Frontend
Open a **new** terminal, navigate to the client directory, install dependencies (first time only), and start the dev server:

```bash
cd client
npm install
npm run dev
```

### 3. Access the App
Open your browser and navigate to:
http://localhost:5173

## Build for Production

To build the frontend for production deployment:
```bash
npm run build
```
The output will be in the `dist` folder.
