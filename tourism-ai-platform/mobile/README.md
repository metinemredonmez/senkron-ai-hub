# Tourism AI Mobile

The Tourism AI mobile app delivers travel planning, booking, and AI-powered assistance across iOS, Android, and web using Expo. It integrates with the platform backend for authentication, reservations, and chat experiences.

## Tech Stack
- Expo SDK 50 (React Native)
- React Navigation 6
- Redux Toolkit & Zustand
- Axios for API requests
- TypeScript

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example` and add API keys (backend URL, Google Maps, Stripe, etc.).
3. Start the Expo development server:
   ```bash
   npm run start
   ```

## Running the App
- **iOS**: `npm run ios`
- **Android**: `npm run android`
- **Web (Expo)**: `npm run web`

Use the Expo Go app or emulator to preview mobile builds.

## Build Process
- For managed builds use [EAS Build](https://docs.expo.dev/eas/) (configure `eas.json`).
- Generate native binaries with `eas build --platform ios|android` once credentials and profiles are configured.
- For web deployments, run `expo export:web` or containerize using the provided `Dockerfile`.
