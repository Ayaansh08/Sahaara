import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';
import LanguageToggle from '../components/LanguageToggle';
import { sendSaathiMessage } from '../services/saathiService';

export default function SaathiChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const flatListRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;

  // 1. Fetch latest 50 messages from Firestore on mount
  useEffect(() => {
    let isMounted = true;

    const fetchHistory = async () => {
      if (!uid || !db) {
        if (isMounted) setLoadingHistory(false);
        return;
      }

      try {
        const messagesRef = collection(db, 'users', uid, 'saathiMessages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));
        const querySnapshot = await getDocs(q);

        const loadedMessages = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          loadedMessages.push({
            id: doc.id,
            role: data.role,
            content: data.content,
            timestamp: data.timestamp,
          });
        });

        if (isMounted) {
          setMessages(loadedMessages);
          setLoadingHistory(false);
        }
      } catch (error) {
        console.log('[SaathiChat] Error loading Firestore history:', error);
        if (isMounted) setLoadingHistory(false);
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [uid]);

  // 2. Auto scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  // 3. Send message handler
  const handleSend = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || isTyping) return;

    // Clear input
    setInputText('');

    // Create local user message
    const userMsg = {
      id: `temp_user_${Date.now()}`,
      role: 'user',
      content: trimmedText,
      timestamp: new Date(),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setIsTyping(true);

    // Save User message to Firestore
    try {
      if (uid && db) {
        await addDoc(collection(db, 'users', uid, 'saathiMessages'), {
          role: 'user',
          content: trimmedText,
          timestamp: serverTimestamp(),
        });
      }
    } catch (fsErr) {
      console.log('[SaathiChat] Error saving user message to Firestore:', fsErr);
    }

    // Call SAATHI Backend Service
    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const saathiReply = await sendSaathiMessage(trimmedText, historyPayload);

    // Create local SAATHI message
    const saathiMsg = {
      id: `temp_saathi_${Date.now()}`,
      role: 'saathi',
      content: saathiReply,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, saathiMsg]);
    setIsTyping(false);

    // Save SAATHI message to Firestore
    try {
      if (uid && db) {
        await addDoc(collection(db, 'users', uid, 'saathiMessages'), {
          role: 'saathi',
          content: saathiReply,
          timestamp: serverTimestamp(),
        });
      }
    } catch (fsErr) {
      console.log('[SaathiChat] Error saving SAATHI reply to Firestore:', fsErr);
    }
  };

  // Render individual message bubble
  const renderMessageItem = ({ item }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowSaathi,
        ]}
      >
        {!isUser && (
          <View style={styles.saathiAvatar}>
            <Ionicons name="heart-circle" size={24} color={COLORS.primary} />
          </View>
        )}

        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleSaathi,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.messageTextUser : styles.messageTextSaathi,
            ]}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={26} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.titleBadge}>
            <Ionicons name="heart-circle" size={30} color={COLORS.primary} />
            <View style={styles.titleTextBox}>
              <Text style={styles.headerTitle}>{t('saathi.chatTitle')}</Text>
              <Text style={styles.headerSubtitle}>{t('saathi.chatSubtitle')}</Text>
            </View>
          </View>
        </View>

        <LanguageToggle />
      </View>

      {/* Main Chat Body */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loadingHistory ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('saathi.loading')}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              messages.length === 0 ? (
                /* Initial Welcome Card when no history exists */
                <View style={styles.welcomeCard}>
                  <View style={styles.welcomeAvatar}>
                    <Ionicons name="heart-circle" size={44} color={COLORS.primary} />
                  </View>
                  <Text style={styles.welcomeText}>
                    {t('saathi.welcomeMessage')}
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              isTyping ? (
                /* SAATHI Typing Indicator Bubble */
                <View style={[styles.messageRow, styles.messageRowSaathi]}>
                  <View style={styles.saathiAvatar}>
                    <Ionicons name="heart-circle" size={24} color={COLORS.primary} />
                  </View>
                  <View style={[styles.bubble, styles.bubbleSaathi, styles.typingBubble]}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.typingText}>{t('saathi.typing')}</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Input Bar Pinned at Bottom */}
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('saathi.inputPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            accessibilityLabel={t('saathi.inputPlaceholder')}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isTyping}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons
              name="send"
              size={22}
              color={
                !inputText.trim() || isTyping
                  ? COLORS.textLight
                  : COLORS.textOnPrimary
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleTextBox: {
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  chatArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexGrow: 1,
  },

  // Welcome Card
  welcomeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SPACING.lg,
    alignItems: 'center',
    marginVertical: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  welcomeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 25,
  },

  // Message Bubbles
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowSaathi: {
    justifyContent: 'flex-start',
  },
  saathiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    elevation: 1,
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleSaathi: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '500',
  },
  messageTextUser: {
    color: COLORS.textOnPrimary,
  },
  messageTextSaathi: {
    color: COLORS.textDark,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  typingText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },

  // Input Bar
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    minHeight: 56,
    maxHeight: 120,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.borderInput,
    borderRadius: 20,
    paddingHorizontal: 18,
    fontSize: 18,
    color: COLORS.textDark,
    marginRight: 10,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.surfaceMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
});
