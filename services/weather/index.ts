import {
  createReaction,
  createService,
  selectInput,
  textInput,
} from '@area/sdk';

type GeocodingResponse = {
  results?: Array<{
    name: string;
    country?: string;
    country_code?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
  }>;
};

type WeatherResponse = {
  current_weather?: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
    is_day: number;
  };
};

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

const round = (value: number, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const kmhToMph = (value: number) => value * 0.621371;

export default createService({
  id: 'weather',
  name: 'Weather',
  version: '1.0.0',
  description:
    'Fetch the latest weather conditions for any city using the free Open-Meteo API.',
  logo: 'https://cdn-icons-png.flaticon.com/512/869/869869.png',
  auth: { type: 'none' },

  reactions: [
    createReaction({
      id: 'current',
      name: 'Get Current Weather',
      description:
        'Retrieve the current temperature, wind, and conditions for a location.',
      input: {
        location: textInput({
          label: 'City or location',
          description: 'Examples: "Paris", "Paris, FR", "New York".',
          placeholder: 'Paris, FR',
          validation: {
            required: true,
          },
        }),
        preferredUnits: selectInput(
          [
            {
              label: 'Celsius (°C)',
              value: 'celsius',
              description: 'Return summary in Celsius.',
            },
            {
              label: 'Fahrenheit (°F)',
              value: 'fahrenheit',
              description: 'Return summary in Fahrenheit.',
            },
          ],
          {
            label: 'Preferred temperature units',
            description:
              'Controls how the summary field is formatted. Both °C and °F are always provided.',
            defaultValue: 'celsius',
          },
        ),
      },
      output: {
        location: 'string',
        latitude: 'number',
        longitude: 'number',
        temperature_c: 'number',
        temperature_f: 'number',
        wind_speed_kmh: 'number',
        wind_speed_mph: 'number',
        wind_direction_deg: 'number',
        weather_code: 'number',
        weather_description: 'string',
        observed_at: 'string',
        is_day: 'boolean',
        summary: 'string',
      },
      run: async (params, ctx) => {
        const rawLocation = String(params.location ?? '').trim();
        if (!rawLocation) {
          throw new Error('Location is required to fetch the weather.');
        }

        const preferredUnits =
          params.preferredUnits === 'fahrenheit' ? 'fahrenheit' : 'celsius';

        ctx.logger?.log?.(
          `[weather] fetching current weather for "${rawLocation}" (${preferredUnits})`,
          'WeatherService',
        );

        const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
        geocodeUrl.searchParams.set('name', rawLocation);
        geocodeUrl.searchParams.set('count', '1');
        geocodeUrl.searchParams.set('language', 'en');
        geocodeUrl.searchParams.set('format', 'json');

        let geocodingData: GeocodingResponse;
        try {
          const geoResponse = await fetch(geocodeUrl);
          if (!geoResponse.ok) {
            throw new Error(
              `Geocoding failed with status ${geoResponse.status} ${geoResponse.statusText}`,
            );
          }
          geocodingData = (await geoResponse.json()) as GeocodingResponse;
        } catch (error) {
          throw new Error(
            `Unable to look up location "${rawLocation}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        const place = geocodingData.results?.[0];
        if (!place) {
          throw new Error(`No matching location found for "${rawLocation}".`);
        }

        const latitude = place.latitude;
        const longitude = place.longitude;

        const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
        weatherUrl.searchParams.set('latitude', String(latitude));
        weatherUrl.searchParams.set('longitude', String(longitude));
        weatherUrl.searchParams.set('current_weather', 'true');
        weatherUrl.searchParams.set('timezone', 'auto');

        let weatherData: WeatherResponse;
        try {
          const weatherResponse = await fetch(weatherUrl);
          if (!weatherResponse.ok) {
            throw new Error(
              `Weather lookup failed with status ${weatherResponse.status} ${weatherResponse.statusText}`,
            );
          }
          weatherData = (await weatherResponse.json()) as WeatherResponse;
        } catch (error) {
          throw new Error(
            `Unable to fetch weather for "${rawLocation}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        const current = weatherData.current_weather;
        if (!current) {
          throw new Error('Weather data unavailable for the selected location.');
        }

        const temperatureC = Number(current.temperature);
        const temperatureF = (temperatureC * 9) / 5 + 32;
        const windSpeedKmh = Number(current.windspeed);
        const windSpeedMph = kmhToMph(windSpeedKmh);
        const windDirection = Number(current.winddirection);
        const weatherCode = Number(current.weathercode);
        const observedAt = String(current.time);
        const isDay = current.is_day === 1;

        const description =
          WEATHER_CODE_DESCRIPTIONS[weatherCode] ?? 'Unknown conditions';

        const preferredTemperature =
          preferredUnits === 'fahrenheit' ? temperatureF : temperatureC;
        const preferredSuffix = preferredUnits === 'fahrenheit' ? '°F' : '°C';

        const locationParts = [
          place.name,
          place.admin1,
          place.country ?? place.country_code,
        ].filter(Boolean);
        const locationLabel = locationParts.join(', ');

        const summary = `${locationLabel}: ${round(preferredTemperature)}${preferredSuffix}, ${description.toLowerCase()}, wind ${round(windSpeedKmh)} km/h`;

        return {
          location: locationLabel,
          latitude: round(latitude, 4),
          longitude: round(longitude, 4),
          temperature_c: round(temperatureC),
          temperature_f: round(temperatureF),
          wind_speed_kmh: round(windSpeedKmh),
          wind_speed_mph: round(windSpeedMph),
          wind_direction_deg: round(windDirection),
          weather_code: weatherCode,
          weather_description: description,
          observed_at: observedAt,
          is_day: isDay,
          summary,
        };
      },
    }),
  ],
});
