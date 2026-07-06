import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';

import { colors } from '../components/theme';
import { AgentScreen } from '../screens/AgentScreen';
import { BrowserScreen } from '../screens/BrowserScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { DriveScreen } from '../screens/DriveScreen';
import { EmailScreen } from '../screens/EmailScreen';
import { FilesScreen } from '../screens/FilesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type RootTabParamList = {
  Chat: undefined;
  Agent: undefined;
  Dateien: undefined;
  Drive: undefined;
  'E-Mail': undefined;
  Browser: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// Emoji icons keep the dependency list small (no icon library needed).
const TAB_ICONS: Record<keyof RootTabParamList, string> = {
  Chat: '💬',
  Agent: '🤖',
  Dateien: '📁',
  Drive: 'D',
  'E-Mail': '✉️',
  Browser: '🌐',
  Settings: '⚙️',
};

export function RootTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>
            {TAB_ICONS[route.name as keyof RootTabParamList]}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Agent" component={AgentScreen} />
      <Tab.Screen name="Dateien" component={FilesScreen} />
      <Tab.Screen name="Drive" component={DriveScreen} />
      <Tab.Screen name="E-Mail" component={EmailScreen} />
      {/*
        lazy: false mounts the Browser (and its WebView) at app launch, so the
        agent's browser tools work in the background without the user having to
        open the tab first. See docs/ARCHITECTURE.md ("Browser-Verfügbarkeit").
      */}
      <Tab.Screen name="Browser" component={BrowserScreen} options={{ lazy: false }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
