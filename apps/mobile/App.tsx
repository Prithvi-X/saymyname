import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { lightColors } from '@saymyname/design-tokens';
import { ELIGIBLE_PROGRAMMES } from '@saymyname/validation';

export default function App() {
  const [activeTab, setActiveTab] = useState<'Discover' | 'Likes' | 'Matches' | 'Chats' | 'Profile'>('Discover');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SayMyName</Text>
        <Text style={styles.headerBadge}>IITM BS Cohorts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardCategory}>Phase 1.0 • Adult Enrolled Only (18+)</Text>
          <Text style={styles.cardTitle}>Intentional Connection Across Distance</Text>
          <Text style={styles.cardBody}>
            SayMyName connects verified adult students across the four approved IIT Madras non-campus BS programme pathways.
          </Text>

          <View style={styles.programmeList}>
            {Object.entries(ELIGIBLE_PROGRAMMES).map(([code, name]) => (
              <View key={code} style={styles.programmeItem}>
                <Text style={styles.programmeName}>{name}</Text>
                <Text style={styles.programmeCode}>{code}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>Zero Surveillance & Immediate Block</Text>
          <Text style={styles.safetyText}>
            No GPS tracking, no read-receipt pressure. Mutual match required before chat.
          </Text>
        </View>
      </ScrollView>

      {/* Primary Mobile Navigation Bottom Bar */}
      <View style={styles.bottomBar}>
        {(['Discover', 'Likes', 'Matches', 'Chats', 'Profile'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabButton}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="button"
              accessibilityLabel={`${tab} tab`}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.borderDefault,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: lightColors.brandPrimary,
  },
  headerBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: lightColors.brandPrimary,
    backgroundColor: lightColors.brandPrimarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    padding: 20,
    marginBottom: 16,
  },
  cardCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: lightColors.accentWarm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: 10,
    lineHeight: 28,
  },
  cardBody: {
    fontSize: 15,
    color: lightColors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  programmeList: {
    borderTopWidth: 1,
    borderTopColor: lightColors.borderDefault,
    paddingTop: 12,
  },
  programmeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  programmeName: {
    fontSize: 14,
    fontWeight: '500',
    color: lightColors.textPrimary,
  },
  programmeCode: {
    fontSize: 11,
    fontWeight: '600',
    color: lightColors.textSecondary,
    backgroundColor: lightColors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  safetyBox: {
    backgroundColor: lightColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    padding: 18,
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.brandPrimary,
    marginBottom: 6,
  },
  safetyText: {
    fontSize: 13,
    color: lightColors.textSecondary,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: lightColors.textSecondary,
  },
  tabTextActive: {
    fontWeight: '700',
    color: lightColors.brandPrimary,
  },
});
