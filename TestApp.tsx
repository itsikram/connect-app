import React from 'react';
import { View, Text, StatusBar } from 'react-native';

const TestApp = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>App Entry Point Working!</Text>
      <Text style={{ marginTop: 10, color: '#666' }}>If you see this, the basic setup is working.</Text>
    </View>
  );
};

export default TestApp;
