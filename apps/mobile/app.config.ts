import baseConfig from "./app.json";

const expoConfig = baseConfig.expo ?? {};

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_URL ?? null;

const config = {
  ...expoConfig,
  extra: {
    ...(expoConfig.extra ?? {}),
    apiUrl,
  },
};

export default config;
