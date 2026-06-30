import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/context/AuthProvider";
import { AuthGuard } from "./src/navigation/AuthGuard";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <NavigationContainer>
          <AuthGuard />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
