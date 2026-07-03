import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';

import { colors } from '../components/theme';
import { AgentScreen } from '../screens/AgentScreen';
import { BrowserScreen } from '../screens/BrowserScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { EmailScreen } from '../screens/EmailScreen';
import { FilesScreen } from '../screens/FilesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type RootTabParamList = {
  Chat: undefined;
  Agent: undefined;
  Dateien: undefined;
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
      <Tab.Screen name="E-Mail" component={EmailScreen} />
      <Tab.Screen name="Browser" component={BrowserScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
