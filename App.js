import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

export default function App() {
  // Standard React state - exactly like you'd use on the web
  const [count, setCount] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Native Counter</Text>
      
      <Text style={styles.countText}>{count}</Text>

      {/* Pressable is the modern React Native equivalent of a button */}
      <Pressable 
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed // Changes color when tapped
        ]}
        onPress={() => setCount(count + 1)}
      >
        <Text style={styles.buttonText}>Tap Me!</Text>
      </Pressable>

      <Pressable 
        style={styles.resetButton}
        onPress={() => setCount(0)}
      >
        <Text style={styles.resetText}>Reset</Text>
      </Pressable>
    </View>
  );
}

// StyleSheet is how you style without CSS/Tailwind
const styles = StyleSheet.create({
  container: {
    flex: 1, // Takes up the whole screen
    backgroundColor: '#111', // Dark background
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  countText: {
    color: '#0ea5e9', // Light blue
    fontSize: 80,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30, // Rounded corners
    marginBottom: 20,
  },
  buttonPressed: {
    backgroundColor: '#0284c7', // Darker blue when pressed
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  resetButton: {
    padding: 10,
  },
  resetText: {
    color: '#ef4444', // Red
    fontSize: 16,
  }
});