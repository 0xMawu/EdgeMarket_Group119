import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { TrendingUp, TrendingDown, Copy } from 'lucide-react-native';
import { Position } from '../types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { useAuth } from '../context/AuthContext';
import { PremiumPaywallModal } from './PremiumPaywallModal';
import { API_PREFIX } from '../config/api';

interface Props {
  position: Position;
  /** Address of the trader whose position this is. Required for copy trading. */
  targetAddress?: string;
}

export function PositionCard({ position, targetAddress }: Props) {
  const profitable = position.pnl >= 0;
  const pnlColor = profitable ? colors.green : colors.red;

  const { currentUser, getJwt } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [betAmount, setBetAmount] = useState('');
  const [copying, setCopying] = useState(false);

  const canCopyTrade = !!(targetAddress && position.conditionId && currentUser);

  const openModal = () => {
    if (!currentUser?.isPremium) {
      setPaywallVisible(true);
      return;
    }
    setBetAmount('');
    setModalVisible(true);
  };

  const handleCopyTrade = async () => {
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a bet amount greater than $0.');
      return;
    }

    const jwt = getJwt();
    if (!jwt || !currentUser) {
      Alert.alert('Not signed in', 'Please sign in to copy trade.');
      return;
    }

    setCopying(true);
    try {
      const res = await fetch(`${API_PREFIX}/paper-trades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          userAddress: currentUser.id,          // UUID from email-auth JWT sub
          targetAddress,
          conditionId: position.conditionId,
          entryPrice: position.currentPrice,    // use live price as entry
          betAmount: amount,
          marketTitle: position.marketName,
          outcome: position.outcome,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      }

      const data = await res.json() as { shares?: number };
      const sharesMsg = data.shares
        ? `\n${data.shares.toFixed(2)} shares at $${position.currentPrice.toFixed(2)}`
        : '';
      Alert.alert('Trade copied!', `$${amount.toFixed(2)} bet on ${position.outcome}${sharesMsg}`);
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Copy failed', (err as Error).message);
    } finally {
      setCopying(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.flex}>
          <Text style={styles.marketName} numberOfLines={2}>
            {position.marketName}
          </Text>
          <View style={styles.outcomePill}>
            <Text style={styles.outcomeText}>{position.outcome}</Text>
          </View>
        </View>
        <View style={styles.rightIcons}>
          <View style={[
            styles.pnlIcon,
            { backgroundColor: profitable ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)' },
          ]}>
            {profitable
              ? <TrendingUp size={16} color={colors.green} />
              : <TrendingDown size={16} color={colors.red} />}
          </View>
          {canCopyTrade && (
            <Pressable style={styles.copyBtn} onPress={openModal}>
              <Copy size={14} color={colors.purple} />
              <Text style={styles.copyBtnText}>Copy</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.pnlRow}>
        <Text style={[styles.pnlValue, { color: pnlColor }]}>
          {profitable ? '+' : ''}${position.pnl.toFixed(2)}
        </Text>
        <Text style={[styles.pnlPct, { color: pnlColor }]}>
          {profitable ? '+' : ''}{position.pnlPercentage.toFixed(1)}%
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Shares</Text>
          <Text style={styles.statValue}>{position.shares.toLocaleString()}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Avg Price</Text>
          <Text style={styles.statValue}>${position.averagePrice.toFixed(2)}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={styles.statValue}>${position.currentPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Value</Text>
          <Text style={styles.statValue}>${position.value.toLocaleString()}</Text>
        </View>
      </View>

      {/* Copy Trade Modal */}
      <Modal
        visible={modalVisible && !paywallVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Copy Trade</Text>
            <Text style={styles.modalMarket} numberOfLines={2}>
              {position.marketName}
            </Text>
            <View style={styles.outcomePill}>
              <Text style={styles.outcomeText}>{position.outcome}</Text>
            </View>

            <Text style={styles.modalLabel}>Current price</Text>
            <Text style={styles.modalPrice}>${position.currentPrice.toFixed(4)}</Text>

            <Text style={styles.modalLabel}>Bet amount (USD)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 10"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              value={betAmount}
              onChangeText={setBetAmount}
              editable={!copying}
              autoFocus
            />
            {betAmount && parseFloat(betAmount) > 0 && (
              <Text style={styles.modalHint}>
                ≈ {(parseFloat(betAmount) / position.currentPrice).toFixed(2)} shares
              </Text>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={copying}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, copying && { opacity: 0.6 }]}
                onPress={handleCopyTrade}
                disabled={copying}
              >
                {copying
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.modalConfirmText}>Confirm</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PremiumPaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        jwt={getJwt()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  flex: { flex: 1, marginRight: 12 },
  marketName: {
    color: colors.white,
    fontSize: 13,
    fontFamily: fonts.medium, fontWeight: '500',
    marginBottom: 6,
  },
  outcomePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168,85,247,0.25)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  outcomeText: {
    color: '#d8b4fe',
    fontSize: 11,
    fontFamily: fonts.semiBold, fontWeight: '600',
  },
  rightIcons: {
    alignItems: 'flex-end',
    gap: 8,
  },
  pnlIcon: {
    padding: 6,
    borderRadius: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyBtnText: {
    color: colors.purple,
    fontSize: 11,
    fontFamily: fonts.semiBold, fontWeight: '600',
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  pnlValue: { fontSize: 14, fontFamily: fonts.bold, fontWeight: '700' },
  pnlPct: { fontSize: 12 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  statCell: { width: '50%', marginBottom: 4 },
  statLabel: { color: colors.textFaint, fontSize: 11, marginBottom: 2 },
  statValue: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: fonts.medium, fontWeight: '500' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    padding: 24,
  },
  modalTitle: {
    color: colors.white,
    fontSize: 18,
    fontFamily: fonts.bold, fontWeight: '700',
    marginBottom: 12,
  },
  modalMarket: {
    color: colors.white,
    fontSize: 13,
    fontFamily: fonts.medium, fontWeight: '500',
    marginBottom: 8,
  },
  modalLabel: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 16,
    marginBottom: 4,
  },
  modalPrice: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.semiBold, fontWeight: '600',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 16,
    marginTop: 4,
  },
  modalHint: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textFaint,
    fontSize: 14,
    fontFamily: fonts.medium, fontWeight: '500',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.purpleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: fonts.bold, fontWeight: '700',
  },
});
