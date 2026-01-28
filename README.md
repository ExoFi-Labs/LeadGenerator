# Lead Generator

A Next.js application to help find local businesses that don't have websites, so you can reach out to offer them website services.

## Features

- Search for local businesses by type and location
- Automatically check if businesses have websites
- Display results of businesses without websites
- Clean, modern UI without Tailwind CSS

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## How It Works

1. Enter a business type (e.g., "restaurants", "plumbers", "lawyers")
2. Enter a location (city, state, or zip code)
3. Click "Find Leads" to search for businesses
4. The app will check each business for a website
5. Results show only businesses without websites

## API Integration

Currently, the app uses mock data for demonstration. To make it fully functional, you'll need to integrate with:

- **Google Places API** (recommended) or **Yelp API** for business search
- **Website checking service** to verify if businesses have websites

### Setting up Google Places API (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API** and **Places API (New)**
4. Create credentials (API Key)
5. Restrict your API key to only the Places API for security
6. Copy your API key and add it to `.env.local`:
   ```
   GOOGLE_PLACES_API_KEY=your_api_key_here
   ```
7. Uncomment the Google Places API code in `lib/websiteChecker.js`

**Note:** Google Places API has usage limits and costs. Check their [pricing](https://mapsplatform.google.com/pricing/) before using in production.

### Setting up Yelp API (Alternative)

1. Go to [Yelp Developers](https://www.yelp.com/developers)
2. Create an app to get your API key
3. Add it to `.env.local`:
   ```
   YELP_API_KEY=your_yelp_api_key_here
   ```
4. Uncomment the Yelp API code in `lib/websiteChecker.js`

### Website Checking

The app automatically checks if businesses have websites. When using Google Places API, the website field is included in the response, so no additional checking is needed. For other APIs, the app will attempt to find websites using search methods.

### Cost Considerations

- **Google Places API**: Pay-as-you-go, ~$17 per 1000 requests
- **Yelp API**: Free tier available (5000 requests/day)
- Consider implementing caching to reduce API calls

## Next Steps

- Integrate with Google Places API for real business data
- Implement website checking logic
- Add export functionality (CSV, PDF)
- Add filters and sorting options
- Save favorite leads
