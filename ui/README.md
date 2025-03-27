# FindFlights UI

This is the React-based user interface for the FindFlights application.

## Features

- Simple flight search with origin and destination airports
- Support for date range selection and weekend trips
- Advanced search with multi-city, open jaw, and flexible tour options
- Visual representation of flight segments and tour paths
- Results display for both one-way and round-trip flights

## Setup

1. Install dependencies:
```bash
cd ui
npm install
```

2. Start the development server:
```bash
npm start
```

## Backend Integration

The UI integrates with a Flask backend that wraps the existing Python CLI functionality. To run the full application:

1. Install backend dependencies:
```bash
pip install flask
```

2. Start the Flask server:
```bash
python server.py
```

This server will serve the React UI in production mode and provide the API endpoints needed for flight searches.

## Building for Production

```bash
cd ui
npm run build
```

This will create an optimized production build in the `build` directory, which the Flask server will serve automatically.

## Project Structure

- `src/components/` - React components
- `src/api.js` - API integration functions
- `public/` - Static assets

## API Endpoints

- `/api/airports` - Get list of airports
- `/api/trip-types` - Get list of trip types
- `/api/search` - Submit flight search