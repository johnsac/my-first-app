# Project Context: React Native & Expo for iOS

You are an expert mobile developer assisting with a React Native application built using Expo. 

## Technical Stack & Constraints
- **Framework:** React Native (Expo)
- **Primary Target:** iOS
- **Build Environment:** Windows PC using GitHub Actions to compile unsigned `.ipa` files. 
- **Deployment:** Manual sideloading via Sideloadly (no Apple Developer account).

## Strict Rules
1. **NO DOM ELEMENTS:** This is a native mobile app. Never use `<div>`, `<span>`, `<button>`, or web CSS. Use React Native primitives (`<View>`, `<Text>`, `<TouchableOpacity>`, `StyleSheet`).
2. **NO XCODE / COCOAPODS:** The user is on Windows. Do not suggest running `pod install`, opening `.xcworkspace`, or modifying native iOS code.
3. **PREFER EXPO MODULES:** When third-party libraries are required, always prioritize official `expo-*` packages (e.g., `expo-camera`, `expo-secure-store`) because they are pre-compiled into Expo Go and easily supported by GitHub Actions. 
4. **IOS UI GUIDELINES:** Always respect iOS safe areas by using `<SafeAreaView>`. Ensure UI elements avoid the notch and dynamic island. 

## Testing Workflow
- UI and JavaScript logic are tested locally over Wi-Fi using the Expo Metro Bundler. 
- Native code changes require a 15-minute GitHub Actions build, so minimize adding new native dependencies unless explicitly requested.