import React, { useState } from 'react';
import { LoginScreen } from '../screens/auth/LoginScreen.js';
import { RegisterScreen } from '../screens/auth/RegisterScreen.js';

export function AuthNavigator() {
  const [currentScreen, setCurrentScreen] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  if (currentScreen === 'REGISTER') {
    return <RegisterScreen onNavigateToLogin={() => setCurrentScreen('LOGIN')} />;
  }

  return <LoginScreen onNavigateToRegister={() => setCurrentScreen('REGISTER')} />;
}
