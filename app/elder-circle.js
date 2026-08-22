import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, getDocs, query, where,
  addDoc, setDoc, doc, serverTimestamp, arrayUnion, getDoc,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SPACING } from '../constants/theme';

// ─── Hardcoded Events ────────────────────────────────────────────────────────

const EVENTS = [
  {
    id: 'sundarkand_weekly',
    title: 'Sundarkand Path',
    titleHindi: 'सुंदरकांड पाठ',
    description: 'A collective reading of Sundarkand from Ramcharitmanas. All devotees warmly welcome.',
    descriptionHindi: 'रामचरितमानस के सुंदरकांड का सामूहिक पाठ। सभी भक्त सादर आमंत्रित हैं।',
    date: '2026-09-07',
    dateHindi: '७ सितंबर २०२६',
    time: '7:00 AM',
    timeHindi: 'सुबह ७:०० बजे',
    type: 'Prayer',
    typeHindi: 'प्रार्थना',
    icon: 'book',
  },
  {
    id: 'morning_yoga',
    title: 'Morning Yoga Session',
    titleHindi: 'सुबह की योग बैठक',
    description: 'Gentle yoga and pranayama designed specifically for seniors. Start the day right.',
    descriptionHindi: 'बुजुर्गों के लिए विशेष हल्की योग और प्राणायाम। दिन की अच्छी शुरुआत करें।',
    date: '2026-09-03',
    dateHindi: '३ सितंबर २०२६',
    time: '6:30 AM',
    timeHindi: 'सुबह ६:३० बजे',
    type: 'Wellness',
    typeHindi: 'स्वास्थ्य',
    icon: 'body',
  },
  {
    id: 'gita_satsang',
    title: 'Gita Satsang',
    titleHindi: 'गीता सत्संग',
    description: 'Weekly Bhagavad Gita discussion — understanding one shloka together every week.',
    descriptionHindi: 'साप्ताहिक भगवद्गीता चर्चा — हर हफ्ते एक श्लोक पर मिलकर विचार करें।',
    date: '2026-09-10',
    dateHindi: '१० सितंबर २०२६',
    time: '5:00 PM',
    timeHindi: 'शाम ५:०० बजे',
    type: 'Satsang',
    typeHindi: 'सत्संग',
    icon: 'library',
  },
  {
    id: 'evening_bhajan',
    title: 'Evening Bhajan Circle',
    titleHindi: 'संध्या भजन संध्या',
    description: 'Come together for an evening of devotional singing. All instruments welcome.',
    descriptionHindi: 'भक्ति संगीत की शाम में शामिल हों। सभी वाद्य यंत्र स्वागत योग्य हैं।',
    date: '2026-09-05',
    dateHindi: '५ सितंबर २०२६',
    time: '6:00 PM',
    timeHindi: 'शाम ६:०० बजे',
    type: 'Music',
    typeHindi: 'संगीत',
    icon: 'musical-notes',
  },
  {
    id: 'ramayana_katha',
    title: 'Ramayana Katha',
    titleHindi: 'रामायण कथा',
    description: 'A week-long Ramayana Katha session. Listen to stories from the great epic.',
    descriptionHindi: 'एक सप्ताह की रामायण कथा। महाकाव्य की कहानियाँ सुनें।',
    date: '2026-09-15',
    dateHindi: '१५ सितंबर २०२६',
    time: '4:00 PM',
    timeHindi: 'शाम ४:०० बजे',
    type: 'Katha',
    typeHindi: 'कथा',
    icon: 'flame',
  },
];

// ─── Dummy Members ────────────────────────────────────────────────────────────

const DUMMY_PROFILES = [
  {
    uid: 'dummy_savitri',
    name: 'Savitri Devi',
    nameHindi: 'सावित्री देवी',
    city: 'Varanasi',
    cityHindi: 'वाराणसी',
    joinedAt: { toDate: () => new Date('2026-08-01') },
    interests: ['Bhajans', 'Gardening'],
    interestsHindi: ['भजन', 'बागवानी'],
    isDummy: true,
  },
  {
    uid: 'dummy_mohan',
    name: 'Mohan Rao',
    nameHindi: 'मोहन राव',
    city: 'Pune',
    cityHindi: 'पुणे',
    joinedAt: { toDate: () => new Date('2026-08-10') },
    interests: ['Yoga', 'Reading'],
    interestsHindi: ['योग', 'पढ़ना'],
    isDummy: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function getAvatarColor(uid = '') {
  const palette = ['#C85A32', '#6C3D91', '#2980B9', '#27AE60', '#E67E22', '#8E44AD'];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}
function daysAgo(dateObj) {
  if (!dateObj) return 0;
  const d = typeof dateObj.toDate === 'function' ? dateObj.toDate() : new Date(dateObj);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

const WAVES_KEY = '@sahaara_waves';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ElderCircleScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const isHindi = language === 'hi';
  const currentUid = auth.currentUser?.uid;

  const [activeTab, setActiveTab] = useState(0); // 0=Members, 1=Events

  // ── Members state ──────────────────────────────────────────────────────────
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [waves, setWaves]  = useState({});  // { [uid]: true }

  // ── Events state ───────────────────────────────────────────────────────────
  const [eventData, setEventData] = useState({});
  const [loadingEvents, setLoadingEvents] = useState(true);
  // MUTUAL friends only — both sides must have waved each other
  const [friendUids, setFriendUids] = useState([]);

  // ── Incoming wave notification ─────────────────────────────────────────────
  const [newWavers, setNewWavers] = useState([]); // [{name, uid}] since last visit

  // ── Load waves from AsyncStorage ───────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(WAVES_KEY).then(raw => {
      if (raw) setWaves(JSON.parse(raw));
    });
  }, []);

  // ── Fetch members ──────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    try {
      // Fetch ALL visible users — no isVisible filter so old users appear too
      const snap = await getDocs(collection(db, 'users'));
      const real = snap.docs
        .map(d => d.data())
        .filter(u => u.uid && u.uid !== currentUid); // exclude self, skip malformed
      setMembers([...DUMMY_PROFILES, ...real]);
    } catch (err) {
      console.error('Elder Circle members fetch failed:', err.code, err.message);
      // Show dummies even if Firestore fails (likely rules issue)
      setMembers([...DUMMY_PROFILES]);
    } finally {
      setLoadingMembers(false);
      setRefreshing(false);
    }
  }, [currentUid]);

  // ── Fetch event enrollment + friend UIDs (bidirectional) ────────────────────
  const fetchEventData = useCallback(async () => {
    setLoadingEvents(true);
    try {
      if (currentUid) {
        const WAVE_CHECK_KEY = `@sahaara_wave_check_${currentUid}`;
        const lastCheckStr = await AsyncStorage.getItem(WAVE_CHECK_KEY);
        const lastCheck = lastCheckStr ? new Date(lastCheckStr) : new Date(0);

        // Friends I waved at (outgoing)
        const outSnap = await getDocs(
          query(collection(db, 'waves'), where('fromUid', '==', currentUid))
        );
        const outUids = new Set(outSnap.docs.map(d => d.data().toUid).filter(Boolean));

        // People who waved at me (incoming) + detect NEW ones
        const inSnap = await getDocs(
          query(collection(db, 'waves'), where('toUid', '==', currentUid))
        );
        const inUids = new Set();
        const newWaversList = [];
        inSnap.docs.forEach(d => {
          const data = d.data();
          if (!data.fromUid) return;
          inUids.add(data.fromUid);
          const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : null;
          if (sentAt && sentAt > lastCheck) {
            newWaversList.push({ uid: data.fromUid, name: data.fromName || 'Someone' });
          }
        });

        // MUTUAL friends only = intersection (both waved each other)
        const mutualFriends = [...outUids].filter(uid => inUids.has(uid));
        setFriendUids(mutualFriends);
        setNewWavers(newWaversList);

        await AsyncStorage.setItem(WAVE_CHECK_KEY, new Date().toISOString());
      }

      // Fetch enrollment data for all events
      const data = {};
      await Promise.all(EVENTS.map(async (ev) => {
        const snap = await getDoc(doc(db, 'events', ev.id));
        data[ev.id] = snap.exists() ? snap.data() : { enrolledUids: [] };
      }));
      setEventData(data);
    } catch (err) {
      console.error('fetchEventData error:', err.code, err.message);
      setEventData({});
    } finally {
      setLoadingEvents(false);
    }
  }, [currentUid]);

  useEffect(() => { fetchMembers(); fetchEventData(); }, [fetchMembers, fetchEventData]);
  const onRefresh = () => { setRefreshing(true); fetchMembers(); fetchEventData(); };

  // ── Wave Hello ─────────────────────────────────────────────────────────────
  const handleWave = async (uid, displayName) => {
    const updated = { ...waves, [uid]: true };
    setWaves(updated);
    await AsyncStorage.setItem(WAVES_KEY, JSON.stringify(updated));
    try {
      await addDoc(collection(db, 'waves'), {
        fromUid: currentUid || 'unknown',
        fromName: auth.currentUser?.displayName || 'A member',
        toUid: uid,
        sentAt: serverTimestamp(),
      });
      // Don't add to friendUids yet — must be mutual
    } catch (_) {}
    Alert.alert(
      isHindi ? 'नमस्ते भेज दिया!' : 'Wave Sent!',
      isHindi
        ? `आपने ${displayName} को नमस्ते किया।`
        : `You waved at ${displayName}. Say hello!`,
      [{ text: isHindi ? 'ठीक है' : 'OK' }]
    );
  };

  // ── Enroll in event ────────────────────────────────────────────────────────
  const handleEnroll = async (event) => {
    if (!currentUid) return;
    const isEnrolled = eventData[event.id]?.enrolledUids?.includes(currentUid);
    if (isEnrolled) {
      Alert.alert(
        isHindi ? 'पहले से नामांकित' : 'Already Enrolled',
        isHindi ? 'आप पहले से इस कार्यक्रम में नामांकित हैं।' : 'You are already enrolled in this event.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // setDoc with merge so doc is created if not exists
      await setDoc(doc(db, 'events', event.id), {
        enrolledUids: arrayUnion(currentUid),
        title: event.title,
        titleHindi: event.titleHindi,
        date: event.date,
      }, { merge: true });

      // Update local state immediately
      setEventData(prev => ({
        ...prev,
        [event.id]: {
          ...prev[event.id],
          enrolledUids: [...(prev[event.id]?.enrolledUids || []), currentUid],
        },
      }));

      Alert.alert(
        isHindi ? 'नामांकन सफल!' : 'Enrolled Successfully!',
        isHindi
          ? `आप "${event.titleHindi}" में नामांकित हो गए हैं। मिलते हैं!`
          : `You've enrolled in "${event.title}". See you there!`,
        [{ text: isHindi ? 'बहुत अच्छा!' : 'Great!' }]
      );
    } catch (err) {
      Alert.alert(isHindi ? 'त्रुटि' : 'Error', isHindi ? 'पुनः प्रयास करें।' : 'Please try again.');
    }
  };

  // ── Tabs: Members | Friends | Events ─────────────────────────────────
  const TAB_ICONS  = ['people-outline', 'heart-outline', 'calendar-outline'];
  const TAB_LABELS = isHindi
    ? ['सदस्य', 'मित्र', 'कार्यक्रम']
    : ['Members', 'Friends', 'Events'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('elderCircle.title')}</Text>
          <Text style={styles.headerSub}>{t('elderCircle.subtitle')}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countNum}>{members.length}</Text>
          <Text style={styles.countLabel}>{t('elderCircle.members')}</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TAB_LABELS.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Ionicons
              name={TAB_ICONS[i]}
              size={15}
              color={activeTab === i ? COLORS.primary : COLORS.textSecondary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
              {label}
            </Text>
            {/* Friends badge count */}
            {i === 1 && friendUids.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{friendUids.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 0 && (
        <MembersTab
          members={members}
          loading={loadingMembers}
          refreshing={refreshing}
          onRefresh={onRefresh}
          waves={waves}
          onWave={handleWave}
          friendUids={friendUids}
          newWavers={newWavers}
          onDismissWavers={() => setNewWavers([])}
          isHindi={isHindi}
          t={t}
        />
      )}
      {activeTab === 1 && (
        <FriendsTab
          members={members}
          friendUids={friendUids}
          loading={loadingMembers}
          isHindi={isHindi}
        />
      )}
      {activeTab === 2 && (
        <EventsTab
          events={EVENTS}
          eventData={eventData}
          loading={loadingEvents}
          currentUid={currentUid}
          friendUids={friendUids}
          onEnroll={handleEnroll}
          isHindi={isHindi}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ members, loading, refreshing, onRefresh, waves, onWave, friendUids, newWavers, onDismissWavers, isHindi, t }) {
  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>{t('elderCircle.loading')}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Wave notification banner */}
      {newWavers.length > 0 && (
        <View style={styles.waveBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.waveBannerTitle}>
              {isHindi
                ? `${newWavers.length} नई नमस्ते!`
                : `${newWavers.length} new wave${newWavers.length > 1 ? 's' : ''}!`}
            </Text>
            <Text style={styles.waveBannerSub}>
              {isHindi
                ? `${newWavers.map(w => w.name).join(', ')} ने आपको नमस्ते किया`
                : `${newWavers.map(w => w.name).join(', ')} waved at you`}
            </Text>
          </View>
          <TouchableOpacity onPress={onDismissWavers} style={styles.waveBannerClose}>
            <Ionicons name="close" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      )}
    <FlatList
      data={members}
      keyExtractor={item => item.uid}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={52} color={COLORS.textLight} />
          <Text style={styles.emptyText}>{t('elderCircle.empty')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const displayName = isHindi && item.nameHindi ? item.nameHindi : item.name;
        const displayCity = isHindi && item.cityHindi ? item.cityHindi : (item.city || '');
        const days = daysAgo(item.joinedAt);
        const joinedLabel = days === 0
          ? t('elderCircle.joinedToday')
          : `${days} ${t('elderCircle.joinedDaysAgo')}`;
        const interests = isHindi && item.interestsHindi ? item.interestsHindi : (item.interests || []);
        const waved = !!waves[item.uid];
        const isMutualFriend = friendUids.includes(item.uid);

        return (
          <View style={styles.memberCard}>
            <View style={styles.cardTop}>
              <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.uid) }]}>
                <Text style={styles.avatarText}>{getInitials(item.name || displayName)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.memberName}>{displayName}</Text>
                  {isMutualFriend && (
                    <View style={styles.friendChip}>
                      <Ionicons name="heart" size={10} color="#fff" />
                      <Text style={styles.friendChipText}>{isHindi ? 'मित्र' : 'Friend'}</Text>
                    </View>
                  )}
                </View>
                {displayCity ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{displayCity}</Text>
                  </View>
                ) : null}
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{joinedLabel}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.waveBtn, waved && styles.waveBtnDone]}
                onPress={() => !waved && onWave(item.uid, displayName)}
                activeOpacity={waved ? 1 : 0.75}
              >
                <Ionicons
                  name={waved ? 'checkmark-circle' : 'hand-right-outline'}
                  size={16}
                  color={waved ? COLORS.primary : '#fff'}
                />
                <Text style={[styles.waveBtnText, waved && styles.waveBtnTextDone]}>
                  {waved ? t('elderCircle.waved') : t('elderCircle.wave')}
                </Text>
              </TouchableOpacity>
            </View>

            {interests.length > 0 && (
              <View style={styles.interestRow}>
                {interests.map((tag, i) => (
                  <View key={i} style={styles.interestChip}>
                    <Text style={styles.interestText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      }}
    />
    </View>
  );
}

// ─── Friends Tab ──────────────────────────────────────────────────────────────

function FriendsTab({ members, friendUids, loading, isHindi }) {
  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  // Only keep members who are mutual friends
  const friends = members.filter(m => friendUids.includes(m.uid));

  if (friends.length === 0) return (
    <View style={styles.centered}>
      <Ionicons name="heart-outline" size={52} color={COLORS.textLight} />
      <Text style={styles.emptyText}>
        {isHindi
          ? 'अभी कोई मित्र नहीं।\nजब दोनों नमस्ते करें तो मित्रता बनती है।'
          : 'No friends yet.\nWave at someone and when they wave back, you become friends!'}
      </Text>
    </View>
  );

  return (
    <FlatList
      data={friends}
      keyExtractor={item => item.uid}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const displayName = isHindi && item.nameHindi ? item.nameHindi : item.name;
        const displayCity = isHindi && item.cityHindi ? item.cityHindi : (item.city || '');
        const avatarColor = getAvatarColor(item.uid);
        const interests = isHindi && item.interestsHindi ? item.interestsHindi : (item.interests || []);

        return (
          <View style={[styles.memberCard, styles.friendCard]}>
            <View style={styles.cardTop}>
              <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{getInitials(item.name || displayName)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.memberName}>{displayName}</Text>
                  <View style={styles.friendChip}>
                    <Ionicons name="heart" size={10} color="#fff" />
                    <Text style={styles.friendChipText}>{isHindi ? 'मित्र' : 'Friend'}</Text>
                  </View>
                </View>
                {displayCity ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{displayCity}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {interests.length > 0 && (
              <View style={styles.interestRow}>
                {interests.map((tag, i) => (
                  <View key={i} style={styles.interestChip}>
                    <Text style={styles.interestText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

function EventsTab({ events, eventData, loading, currentUid, friendUids, onEnroll, isHindi }) {
  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>{isHindi ? 'कार्यक्रम लोड हो रहे हैं...' : 'Loading events...'}</Text>
    </View>
  );

  return (
    <FlatList
      data={events}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const data = eventData[item.id] || {};
        const enrolledUids = data.enrolledUids || [];
        const totalEnrolled = enrolledUids.length;
        const isEnrolled = currentUid && enrolledUids.includes(currentUid);

        // Friends enrolled = intersection of enrolledUids and my waved friends
        const friendsEnrolled = enrolledUids.filter(uid => friendUids.includes(uid)).length;

        const displayTitle = isHindi ? item.titleHindi : item.title;
        const displayDesc  = isHindi ? item.descriptionHindi : item.description;
        const displayDate  = isHindi ? item.dateHindi : new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        const displayTime  = isHindi ? item.timeHindi : item.time;
        const displayType  = isHindi ? item.typeHindi : item.type;

        return (
          <View style={styles.eventCard}>
            {/* Top Row */}
            <View style={styles.eventTop}>
              <View style={styles.eventIconBox}>
                <Ionicons name={item.icon} size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.eventTitle}>{displayTitle}</Text>
                <View style={styles.typePill}>
                  <Text style={styles.typeText}>{displayType}</Text>
                </View>
              </View>
              {isEnrolled && (
                <View style={styles.enrolledBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                  <Text style={styles.enrolledBadgeText}>
                    {isHindi ? 'नामांकित' : 'Enrolled'}
                  </Text>
                </View>
              )}
            </View>

            {/* Description */}
            <Text style={styles.eventDesc}>{displayDesc}</Text>

            {/* Date & Time */}
            <View style={styles.eventMeta}>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{displayDate}</Text>
              </View>
              <View style={[styles.metaRow, { marginLeft: 16 }]}>
                <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{displayTime}</Text>
              </View>
            </View>

            {/* Enrolled count + Friends badge */}
            <View style={styles.eventFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Total enrolled */}
                {totalEnrolled > 0 && (
                  <View style={styles.enrollCountRow}>
                    <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.enrollCountText}>
                      {totalEnrolled} {isHindi ? 'नामांकित' : 'enrolled'}
                    </Text>
                  </View>
                )}

                {/* Friends enrolled badge */}
                {friendsEnrolled > 0 && (
                  <View style={styles.friendsBadge}>
                    <Ionicons name="heart" size={13} color="#fff" />
                    <Text style={styles.friendsBadgeText}>
                      {friendsEnrolled} {isHindi ? 'मित्र' : friendsEnrolled === 1 ? 'friend' : 'friends'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Enroll Button */}
              <TouchableOpacity
                style={[styles.enrollBtn, isEnrolled && styles.enrollBtnDone]}
                onPress={() => onEnroll(item)}
                activeOpacity={isEnrolled ? 1 : 0.75}
              >
                <Ionicons
                  name={isEnrolled ? 'checkmark' : 'add-circle-outline'}
                  size={16}
                  color={isEnrolled ? COLORS.primary : '#fff'}
                />
                <Text style={[styles.enrollBtnText, isEnrolled && styles.enrollBtnTextDone]}>
                  {isEnrolled
                    ? (isHindi ? 'नामांकित' : 'Enrolled')
                    : (isHindi ? 'नामांकन करें' : 'Enroll')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 6, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  countBadge: {
    alignItems: 'center', backgroundColor: COLORS.primaryLight,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  countNum: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  countLabel: { fontSize: 10, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },

  // Common
  listContent: { padding: SPACING.md, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 14, fontSize: 15, color: COLORS.textSecondary },
  emptyText: { marginTop: 14, fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },

  // Member card
  memberCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#3E2723', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '900', color: '#fff' },
  cardInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  waveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20,
  },
  waveBtnDone: { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary },
  waveBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  waveBtnTextDone: { color: COLORS.primary },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  interestChip: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  interestText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  // Event card
  eventCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#3E2723', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  eventTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  eventIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  eventTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  typePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  typeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  enrolledBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  enrolledBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  eventDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 10 },
  eventMeta: { flexDirection: 'row', marginBottom: 12 },

  // Event footer
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enrollCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  enrollCountText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  // Friends badge — shown when someone you waved at is enrolled
  friendsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  friendsBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Enroll button
  enrollBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
  },
  enrollBtnDone: { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary },
  enrollBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  enrollBtnTextDone: { color: COLORS.primary },
  // Wave notification banner
  waveBanner: {
    margin: SPACING.md,
    marginBottom: 0,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 2,
  },
  waveBannerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  waveBannerClose: {
    padding: 6,
    marginLeft: 8,
  },

  // Tab badge (friend count)
  tabBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 5, paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },

  // Friend chip on member name
  friendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
  },
  friendChipText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // Friend card highlight
  friendCard: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
});
