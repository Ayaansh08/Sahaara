/**
 * Family Screen — परिवार
 * Professional, clean design.
 * • Family members: Wife/Husband, Son, Daughter, Grandchildren + edit/add
 * • Voice notes (expo-speech, Hindi)
 * • Caretaker profile (Firebase-backed, shows elder name on caretaker side)
 * • Live caretaker messages feed (Firestore onSnapshot)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import {
  collection, query, where, orderBy, onSnapshot,
  updateDoc, doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SPACING } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const RELATIONS = ['Wife', 'Husband', 'Son', 'Daughter', 'Grandson', 'Granddaughter', 'Other'];
const RELATIONS_HI = ['पत्नी', 'पति', 'बेटा', 'बेटी', 'पोता', 'पोती', 'अन्य'];

const RELATION_ICONS = {
  Wife: 'heart', Husband: 'heart', Son: 'person',
  Daughter: 'person', Grandson: 'happy', Granddaughter: 'happy', Other: 'people',
};

const DEFAULT_MEMBERS = [
  { id: 'f1', name: 'Sunita',  nameHi: 'सुनीता',  relation: 'Wife',        relationHi: 'पत्नी',  age: '62', phone: '+91 98765 43210', note: '' },
  { id: 'f2', name: 'Rohan',   nameHi: 'रोहन',    relation: 'Son',         relationHi: 'बेटा',   age: '35', phone: '+91 87654 32109', note: 'Lives in Mumbai' },
  { id: 'f3', name: 'Ananya',  nameHi: 'अनन्या',  relation: 'Daughter',    relationHi: 'बेटी',   age: '32', phone: '+91 76543 21098', note: 'Calls every Sunday' },
  { id: 'f4', name: 'Aryan',   nameHi: 'आर्यन',   relation: 'Grandson',    relationHi: 'पोता',   age: '8',  phone: '', note: '' },
  { id: 'f5', name: 'Priya',   nameHi: 'प्रिया',  relation: 'Granddaughter', relationHi: 'पोती', age: '5',  phone: '', note: '' },
];

const VOICE_NOTES = [
  { id: 'v1', memberName: 'Sunita',  memberNameHi: 'सुनीता',  time: 'आज सुबह 9:00',    duration: '0:11', text: 'जी, आज दवाई लेना मत भूलना। मैं दोपहर को आऊँगी।', },
  { id: 'v2', memberName: 'Rohan',   memberNameHi: 'रोहन',    time: 'कल शाम 6:30',     duration: '0:09', text: 'पापा, कोई ज़रूरत हो तो बताना। मैं कल आ रहा हूँ।', },
  { id: 'v3', memberName: 'Ananya',  memberNameHi: 'अनन्या',  time: 'कल दोपहर 2:00',   duration: '0:14', text: 'पापा, आज मंदिर गई थी, आपकी दुआ की। ख्याल रखें।', },
  { id: 'v4', memberName: 'Aryan',   memberNameHi: 'आर्यन',   time: '2 दिन पहले',      duration: '0:07', text: 'दादाजी, आपको बहुत मिस करता हूँ! जल्दी आइए।', },
];

const STORAGE_KEY = '@sahaara_family_members';

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FamilyScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const isHindi = language === 'hi';

  const [activeTab, setActiveTab]         = useState('members');
  const [members, setMembers]             = useState(DEFAULT_MEMBERS);
  const [playingId, setPlayingId]         = useState(null);
  const [caretakerMsgs, setCaretakerMsgs] = useState([]);
  const [elderSentMsgs, setElderSentMsgs] = useState([]);
  const [caretakerProfile, setCaretakerProfile] = useState(null);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm]                   = useState({});
  const [loadingCaretaker, setLoadingCaretaker] = useState(true);
  const [replyText, setReplyText]         = useState('');
  const [sending, setSending]             = useState(false);
  const [activeSos, setActiveSos]         = useState(null); // latest SOS alert

  // Reactive uid — tracks auth state changes, fixes messages not appearing on first open
  const [uid, setUid] = useState(() => auth.currentUser?.uid || null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
    });
    return () => unsubAuth();
  }, []);

  // Load members from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) { try { setMembers(JSON.parse(raw)); } catch (_) {} }
    });
  }, []);

  const saveMembers = (list) => {
    setMembers(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  // Caretaker profile from Firestore (falls back to demo if not linked yet)
  const DEMO_CARETAKER = {
    id: 'demo',
    name: 'Dr. Meera Sharma',
    specialization: 'General & Elderly Care',
    phone: '+91 98765 00000',
    elderUserId: uid,
    isDemo: true,
  };

  useEffect(() => {
    if (!uid || !db) { setCaretakerProfile(DEMO_CARETAKER); setLoadingCaretaker(false); return; }
    const fetchCaretaker = async () => {
      try {
        const elderDoc = await getDoc(doc(db, 'users', uid));
        let caretakerUid = elderDoc.data()?.caretakerUid;

        // Auto-discover and link with registered caregiver in caretakerProfiles
        // (Silently skip if no caretaker exists yet - user must have caretaker set up first)
        if (!caretakerUid) {
          try {
            const { getDocs, query, collection, limit } = await import('firebase/firestore');
            const qAll = query(collection(db, 'caretakerProfiles'), limit(1));
            const snapAll = await getDocs(qAll);
            
            if (!snapAll.empty) {
              caretakerUid = snapAll.docs[0].id;
              // Note: Caretaker must link themselves (elder cannot write to caretaker profile)
              // This is a security feature - only caretaker can modify their profile
            }
          } catch (e) {
            // Silently skip if caretakerProfiles collection cannot be read
            // (This is expected in demo mode or if Firestore is not configured)
            console.log('[Family] Auto-link skipped (demo mode or no caretakers available)');
          }
        }

        if (caretakerUid) {
          let ctDoc = await getDoc(doc(db, 'caretakerProfiles', caretakerUid));
          if (!ctDoc.exists()) {
            ctDoc = await getDoc(doc(db, 'users', caretakerUid));
          }
          if (ctDoc.exists()) {
            setCaretakerProfile({ id: ctDoc.id, ...ctDoc.data(), isDemo: false });
          } else {
            setCaretakerProfile(DEMO_CARETAKER);
          }
        } else {
          setCaretakerProfile(DEMO_CARETAKER);
        }
      } catch (_) {
        setCaretakerProfile(DEMO_CARETAKER);
      }
      setLoadingCaretaker(false);
    };
    fetchCaretaker();
  }, [uid]);

  // Demo messages (only shown when in demo mode)
  const DEMO_MSGS = [
    { id: 'd1', fromName: 'Dr. Meera Sharma', text: 'आज की दवाई ले ली? Blood pressure check करना है।', read: false, timestamp: { toDate: () => new Date(Date.now() - 1800000) } },
    { id: 'd2', fromName: 'Dr. Meera Sharma', text: 'BP reading 130/85 — bilkul theek hai. Koi chinta nahi.', read: true, timestamp: { toDate: () => new Date(Date.now() - 86400000) } },
    { id: 'd3', fromName: 'Dr. Meera Sharma', text: 'Kal subah 10 baje clinic mein aana hai. Khaana kha ke aana.', read: true, timestamp: { toDate: () => new Date(Date.now() - 172800000) } },
  ];

  // Fetch real messages from Firebase (or show empty state if offline)
  useEffect(() => {
    // In demo mode or offline, show demo messages
    if (!uid || !db) {
      setCaretakerMsgs(DEMO_MSGS);
      setUnreadCount(1);
      return;
    }

    try {
      // Load ALL caretakerMessages — Firestore rules ensure only auth users can read.
      // We show messages addressed to this uid OR with no specific target (broadcast).
      // Old messages with stale toUserId are still shown (better UX).
      const q = query(
        collection(db, 'caretakerMessages'),
        limit(50)
      );
      const unsub = onSnapshot(q,
        snap => {
          // Show ALL messages that are for this user OR general/broadcast messages
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const mine = all.filter(m =>
            // Message explicitly for this user
            m.toUserId === uid || m.toUid === uid ||
            // Broadcast message (no specific target)
            !m.toUserId || m.toUserId === 'all' || m.toUserId === ''
          );
          // Sort oldest first so chat reads naturally (newest at bottom)
          const sorted = mine.sort((a, b) => {
            const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
            const tb = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
            return ta - tb;
          });
          console.log('[CaretakerMsgs] uid=' + uid + ' total=' + all.length + ' mine=' + sorted.length);
          setCaretakerMsgs(sorted);
          setUnreadCount(sorted.filter(m => !m.read).length);
        },
        (err) => {
          console.log('[CaretakerMsgs Error]:', err?.message || err);
          setCaretakerMsgs([]);
          setUnreadCount(0);
        }
      );
      return () => unsub();
    } catch (e) {
      console.log('[CaretakerMsgs Init Error]:', e);
      setCaretakerMsgs([]);
      setUnreadCount(0);
    }
  }, [uid]);

  // Fetch elder's sent messages from Firestore (messages elder sent to caretaker)
  useEffect(() => {
    if (!uid || !db) { setElderSentMsgs([]); return; }
    try {
      const q = query(
        collection(db, 'elderToCaretakerMessages'),
        where('fromUserId', '==', uid),
        orderBy('timestamp', 'desc'),
        limit(30)
      );
      const unsub = onSnapshot(q,
        snap => {
          const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setElderSentMsgs(msgs);
        },
        (err) => {
          console.log('[ElderSentMsgs Error]:', err?.message || err);
          setElderSentMsgs([]);
        }
      );
      return () => unsub();
    } catch (e) {
      console.log('[ElderSentMsgs Init Error]:', e);
      setElderSentMsgs([]);
    }
  }, [uid]);

  // Mark read when tab opened
  useEffect(() => {
    if (activeTab !== 'caretaker' || !uid || !db) return;
    caretakerMsgs.filter(m => !m.read).forEach(m => {
      updateDoc(doc(db, 'caretakerMessages', m.id), { read: true }).catch(() => {});
    });
    setUnreadCount(0);
  }, [activeTab]);

  // SOS alert listener — banner in caretaker tab
  useEffect(() => {
    if (!uid || !db) return;
    const q = query(
      collection(db, 'sos_alerts'),
      where('userId', '==', uid),
      orderBy('timestamp', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const latest = { id: snap.docs[0].id, ...snap.docs[0].data() };
        const ts = latest.timestamp?.toDate?.();
        if (ts && (Date.now() - ts) < 1800000) {
          setActiveSos(latest);
          setActiveTab('caretaker'); // auto-show caretaker tab
        } else {
          setActiveSos(null);
        }
      }
    }, () => {});
    return () => unsub();
  }, [uid]);

  // Voice playback
  const handlePlay = async (note) => {
    if (playingId === note.id) {
      await Speech.stop(); setPlayingId(null); return;
    }
    if (playingId) await Speech.stop();
    setPlayingId(note.id);
    Speech.speak(note.text, {
      language: 'hi-IN', rate: 0.85,
      onDone: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  // Elder sends message to caretaker
  const handleSendReply = async () => {
    if (!replyText.trim() || sending) return;
    const text = replyText.trim();
    setReplyText('');
    setSending(true);

    const localMsg = {
      id: `local_${Date.now()}`,
      text,
      senderType: 'elder',
      fromName: auth.currentUser?.displayName || 'You',
      timestamp: { toDate: () => new Date() },
      read: false,
    };
    setElderSentMsgs(prev => [localMsg, ...prev]);

    if (uid && db) {
      try {
        const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'elderToCaretakerMessages'), {
          fromUserId:    uid,
          fromName:      auth.currentUser?.displayName || 'Senior',
          toCaretakerId: caretakerProfile?.id || 'all',
          text,
          timestamp:     serverTimestamp(),
          read:          false,
        });
      } catch (err) {
        console.log('[ElderMsg Write Error]:', err);
      }
    }
    setSending(false);
  };

  // Edit member
  const openEdit = (member) => {
    setEditingMember(member);
    setForm({ ...member });
    setShowEditModal(true);
  };

  const openAdd = () => {
    const newMember = { id: `f${Date.now()}`, name: '', nameHi: '', relation: 'Son', relationHi: 'बेटा', age: '', phone: '', note: '' };
    setEditingMember(null);
    setForm(newMember);
    setShowEditModal(true);
  };

  const handleSaveMember = () => {
    if (!form.name?.trim()) { Alert.alert('Name required'); return; }
    // Map relation to Hindi
    const relIdx = RELATIONS.indexOf(form.relation);
    const formWithHi = { ...form, relationHi: RELATIONS_HI[relIdx] || form.relation };

    if (editingMember) {
      saveMembers(members.map(m => m.id === editingMember.id ? formWithHi : m));
    } else {
      saveMembers([...members, formWithHi]);
    }
    setShowEditModal(false);
  };

  const handleDeleteMember = (id) => {
    Alert.alert(
      isHindi ? 'हटाएं?' : 'Remove member?', '',
      [
        { text: isHindi ? 'रद्द' : 'Cancel', style: 'cancel' },
        { text: isHindi ? 'हटाएं' : 'Remove', style: 'destructive',
          onPress: () => saveMembers(members.filter(m => m.id !== id)) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isHindi ? 'परिवार' : 'My Family'}</Text>
          <Text style={styles.headerSub}>{members.length} {isHindi ? 'सदस्य' : 'members'}</Text>
        </View>
        {activeTab === 'members' && (
          <TouchableOpacity style={styles.addMemberBtn} onPress={openAdd}>
            <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
            <Text style={styles.addMemberText}>{isHindi ? 'जोड़ें' : 'Add'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {[
          { id: 'members', label: isHindi ? 'सदस्य' : 'Members', icon: 'people-outline' },
          { id: 'voice',   label: isHindi ? 'संदेश' : 'Voice Notes', icon: 'mic-outline' },
          { id: 'caretaker', label: isHindi ? 'देखभाल' : 'Caretaker', icon: 'shield-checkmark-outline', badge: unreadCount },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <View>
              <Ionicons
                name={tab.icon}
                size={17}
                color={activeTab === tab.id ? COLORS.primary : '#9CA3AF'}
              />
              {tab.badge > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeDotText}>{tab.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {activeTab === 'members' && (
          <MembersTab
            members={members}
            isHindi={isHindi}
            onEdit={openEdit}
            onDelete={handleDeleteMember}
          />
        )}
        {activeTab === 'voice' && (
          <VoiceTab notes={VOICE_NOTES} playingId={playingId} isHindi={isHindi} onPlay={handlePlay} />
        )}
        {activeTab === 'caretaker' && (
          <CaretakerTabContent
            messages={caretakerMsgs}
            sentMessages={elderSentMsgs}
            profile={caretakerProfile}
            loading={loadingCaretaker}
            isHindi={isHindi}
            activeSos={activeSos}
            demoMessages={DEMO_MSGS}
          />
        )}
      </ScrollView>

      {/* ── Reply bar (caretaker tab only) ── */}
      {activeTab === 'caretaker' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.replyBar}>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder={isHindi ? 'संदेश लिखें...' : 'Type a message...'}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.replyBtn, (!replyText.trim() || sending) && styles.replyBtnDisabled]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── Edit / Add Member Modal ── */}
      <EditMemberModal
        visible={showEditModal}
        form={form}
        setForm={setForm}
        isEdit={!!editingMember}
        isHindi={isHindi}
        onSave={handleSaveMember}
        onClose={() => setShowEditModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ members, isHindi, onEdit, onDelete }) {
  // Group by relation type
  const groups = [
    { key: 'spouse',      label: isHindi ? 'जीवनसाथी' : 'Spouse',        rels: ['Wife', 'Husband'] },
    { key: 'children',    label: isHindi ? 'बच्चे' : 'Children',          rels: ['Son', 'Daughter'] },
    { key: 'grandchildren', label: isHindi ? 'पोते-पोतियाँ' : 'Grandchildren', rels: ['Grandson', 'Granddaughter'] },
    { key: 'other',       label: isHindi ? 'अन्य' : 'Others',             rels: ['Other'] },
  ];

  return (
    <View>
      {groups.map(group => {
        const groupMembers = members.filter(m => group.rels.includes(m.relation));
        if (groupMembers.length === 0) return null;
        return (
          <View key={group.key} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {groupMembers.map((m, i) => (
              <MemberRow key={m.id} member={m} index={i} isHindi={isHindi} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function MemberRow({ member, index, isHindi, onEdit, onDelete }) {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: index * 60, useNativeDriver: true, damping: 14 }),
    ]).start();
  }, []);

  const initials = (isHindi && member.nameHi ? member.nameHi : member.name)
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const relationLabel = isHindi ? member.relationHi : member.relation;
  const icon          = RELATION_ICONS[member.relation] || 'person';

  return (
    <Animated.View style={[styles.memberCard, { opacity, transform: [{ translateY }] }]}>
      {/* Avatar */}
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName}>{isHindi && member.nameHi ? member.nameHi : member.name}</Text>
          <View style={styles.relationPill}>
            <Ionicons name={icon} size={10} color={COLORS.primary} style={{ marginRight: 3 }} />
            <Text style={styles.relationPillText}>{relationLabel}</Text>
          </View>
        </View>
        {member.age ? <Text style={styles.memberMeta}>{isHindi ? `आयु ${member.age}` : `Age ${member.age}`}</Text> : null}
        {member.phone ? (
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={12} color="#6B7280" />
            <Text style={styles.phoneText}>{member.phone}</Text>
          </View>
        ) : null}
        {member.note ? <Text style={styles.memberNote}>{member.note}</Text> : null}
      </View>

      {/* Actions */}
      <View style={styles.memberActions}>
        <TouchableOpacity style={styles.actionIcon} onPress={() => onEdit(member)}>
          <Ionicons name="pencil-outline" size={16} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionIcon} onPress={() => onDelete(member.id)}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Voice Notes Tab ──────────────────────────────────────────────────────────

function VoiceTab({ notes, playingId, isHindi, onPlay }) {
  return (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>{isHindi ? 'परिवार के संदेश' : 'Family Voice Messages'}</Text>
        <Text style={styles.sectionSubtitle}>{isHindi ? 'प्ले दबाएं' : 'Tap to listen'}</Text>
      </View>
      {notes.map(note => (
        <VoiceNoteBubble
          key={note.id}
          note={note}
          playing={playingId === note.id}
          isHindi={isHindi}
          onPlay={() => onPlay(note)}
        />
      ))}
    </View>
  );
}

function VoiceNoteBubble({ note, playing, isHindi, onPlay }) {
  const b0 = useRef(new Animated.Value(3));
  const b1 = useRef(new Animated.Value(3));
  const b2 = useRef(new Animated.Value(3));
  const b3 = useRef(new Animated.Value(3));
  const b4 = useRef(new Animated.Value(3));
  const b5 = useRef(new Animated.Value(3));
  const b6 = useRef(new Animated.Value(3));
  const barRefs = [b0, b1, b2, b3, b4, b5, b6];

  useEffect(() => {
    if (playing) {
      const heights = [6, 14, 9, 18, 7, 13, 10];
      const anims = barRefs.map((ref, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(ref.current, { toValue: heights[i], duration: 200 + i * 40, useNativeDriver: false }),
            Animated.timing(ref.current, { toValue: 3, duration: 200 + i * 40, useNativeDriver: false }),
          ])
        )
      );
      anims.forEach(a => a.start());
      return () => { anims.forEach(a => a.stop()); };
    } else {
      barRefs.forEach(ref => ref.current.setValue(3));
    }
  }, [playing]);

  const initials = (isHindi ? note.memberNameHi : note.memberName).charAt(0);

  return (
    <View style={[styles.voiceBubble, playing && styles.voiceBubblePlaying]}>
      <View style={styles.voiceTopRow}>
        <View style={styles.voiceAvatar}>
          <Text style={styles.voiceAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.voiceSender}>{isHindi ? note.memberNameHi : note.memberName}</Text>
          <Text style={styles.voiceTime}>{note.time}</Text>
        </View>
        <Text style={styles.voiceDuration}>{note.duration}</Text>
      </View>

      <View style={styles.voicePlayerRow}>
        <TouchableOpacity
          style={[styles.voicePlayBtn, playing && styles.voicePlayBtnActive]}
          onPress={onPlay}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={16} color={playing ? '#fff' : COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.waveformWrap}>
          {barRefs.map((ref, i) => (
            <Animated.View
              key={i}
              style={[styles.waveBar, {
                height: ref.current,
                backgroundColor: playing ? COLORS.primary : '#D1D5DB',
              }]}
            />
          ))}
        </View>
      </View>

      <Text style={styles.voiceTranscript}>{note.text}</Text>
    </View>
  );
}

// ─── Caretaker Tab (two-way chat) ─────────────────────────────────────────────

function CaretakerTabContent({ messages, sentMessages, profile, loading, isHindi, activeSos, demoMessages }) {
  const formatTime = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      const diff = Date.now() - d;
      if (diff < 60000)    return isHindi ? 'अभी' : 'just now';
      if (diff < 3600000)  return `${Math.round(diff / 60000)}m`;
      if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleDateString();
    } catch { return ''; }
  };

  // Prioritize real Firestore messages; only show demo placeholders if no real messages exist
  const displayMessages = (messages && messages.length > 0) ? messages : (profile?.isDemo ? demoMessages : []);

  // Merge caretaker messages + elder sent messages, sort oldest-first for chat UX
  const allMessages = [
    ...displayMessages.map(m => ({ ...m, senderType: 'caretaker' })),
    ...sentMessages.map(m => ({ ...m, senderType: 'elder' })),
  ].sort((a, b) => {
    const ta = a.timestamp?.toDate?.() || new Date(0);
    const tb = b.timestamp?.toDate?.() || new Date(0);
    return ta - tb; // oldest first = natural chat order
  });

  return (
    <View style={{ paddingBottom: 8 }}>

      {/* ── SOS Alert Banner ── */}
      {activeSos && (
        <View style={styles.sosBanner}>
          <View style={styles.sosBannerLeft}>
            <Ionicons name="warning" size={22} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.sosBannerTitle}>
                {isHindi ? 'SOS अलर्ट भेजा गया!' : 'SOS Alert Triggered!'}
              </Text>
              <Text style={styles.sosBannerSub}>
                {formatTime(activeSos.timestamp)} •{' '}
                {activeSos.locationAvailable
                  ? (isHindi ? 'स्थान उपलब्ध' : 'Location captured')
                  : (isHindi ? 'स्थान नहीं मिला' : 'No location')}
              </Text>
            </View>
          </View>
          {activeSos.mapsLink && (
            <TouchableOpacity
              style={styles.sosMapsBtn}
              onPress={() => { const { Linking } = require('react-native'); Linking.openURL(activeSos.mapsLink); }}
            >
              <Ionicons name="location" size={16} color="#DC2626" />
              <Text style={styles.sosMapsBtnText}>{isHindi ? 'नक्शा' : 'Map'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Caretaker Profile Card */}
      {loading ? (
        <View style={styles.caretakerCard}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : profile ? (
        <View style={styles.caretakerCard}>
          <View style={styles.caretakerAvatarWrap}>
            <View style={styles.caretakerAvatar}>
              <Ionicons name="shield-checkmark" size={24} color="#fff" />
            </View>
            <View style={styles.caretakerOnline} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.caretakerName}>{profile.name}</Text>
              {profile.isDemo && (
                <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>DEMO</Text>
                </View>
              )}
            </View>
            <Text style={styles.caretakerRole}>{profile.specialization || (isHindi ? 'देखभालकर्ता' : 'Personal Caretaker')}</Text>
            {profile.phone ? (
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={12} color="#6B7280" />
                <Text style={styles.phoneText}>{profile.phone}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.caretakerStatusBadge}>
            <Text style={styles.caretakerStatusText}>{isHindi ? 'सक्रिय' : 'Active'}</Text>
          </View>
        </View>
      ) : null}

      {/* Chat header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>{isHindi ? 'बातचीत' : 'Conversation'}</Text>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{isHindi ? 'लाइव' : 'Live'}</Text>
        </View>
      </View>

      {allMessages.length === 0 ? (
        <View style={styles.emptyMsgs}>
          <Ionicons name="chatbubble-outline" size={36} color="#D1D5DB" />
          <Text style={styles.emptyMsgsText}>{isHindi ? 'बातचीत शुरू करें' : 'Start the conversation'}</Text>
        </View>
      ) : (
        allMessages.map(msg => {
          const isElderMsg = msg.senderType === 'elder';
          return (
            <View key={msg.id} style={[styles.chatRow, isElderMsg && styles.chatRowRight]}>
              {!isElderMsg && (
                <View style={styles.chatAvatar}>
                  <Ionicons name="shield-checkmark" size={13} color="#fff" />
                </View>
              )}
              <View style={[styles.chatBubble, isElderMsg ? styles.chatBubbleRight : styles.chatBubbleLeft]}>
                {!isElderMsg && (
                  <Text style={styles.chatSenderLabel}>{msg.fromName || 'Caretaker'}</Text>
                )}
                <Text style={[styles.chatText, isElderMsg && styles.chatTextRight]}>{msg.text}</Text>
                <Text style={[styles.chatTime, isElderMsg && styles.chatTimeRight]}>
                  {formatTime(msg.timestamp)}
                  {isElderMsg && <Text>  <Ionicons name="checkmark-done" size={11} color="rgba(255,255,255,0.7)" /></Text>}
                </Text>
              </View>
              {isElderMsg && (
                <View style={[styles.chatAvatar, { backgroundColor: COLORS.primary }]}>
                  <Ionicons name="person" size={13} color="#fff" />
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

// ─── Edit / Add Member Modal ──────────────────────────────────────────────────

function EditMemberModal({ visible, form, setForm, isEdit, isHindi, onSave, onClose }) {
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.handleBar} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEdit ? (isHindi ? 'सदस्य संपादित करें' : 'Edit Member') : (isHindi ? 'सदस्य जोड़ें' : 'Add Member')}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>{isHindi ? 'नाम *' : 'Name *'}</Text>
              <TextInput
                style={styles.formInput} value={form.name}
                onChangeText={v => f('name', v)}
                placeholder={isHindi ? 'जैसे: रोहन' : 'e.g. Rohan'}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.formLabel}>{isHindi ? 'रिश्ता' : 'Relation'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {RELATIONS.map((rel, i) => {
                  const sel = form.relation === rel;
                  return (
                    <TouchableOpacity
                      key={rel}
                      style={[styles.relChip, sel && styles.relChipActive]}
                      onPress={() => f('relation', rel)}
                    >
                      <Text style={[styles.relChipText, sel && styles.relChipTextActive]}>
                        {isHindi ? RELATIONS_HI[i] : rel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.formLabel}>{isHindi ? 'आयु' : 'Age'}</Text>
              <TextInput
                style={styles.formInput} value={form.age}
                onChangeText={v => f('age', v)} keyboardType="numeric"
                placeholder={isHindi ? 'जैसे: 35' : 'e.g. 35'}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.formLabel}>{isHindi ? 'फ़ोन नंबर' : 'Phone Number'}</Text>
              <TextInput
                style={styles.formInput} value={form.phone}
                onChangeText={v => f('phone', v)} keyboardType="phone-pad"
                placeholder="+91 98765 43210"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.formLabel}>{isHindi ? 'नोट' : 'Note'}</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 }]}
                value={form.note} onChangeText={v => f('note', v)} multiline
                placeholder={isHindi ? 'कोई विशेष जानकारी...' : 'Any special note...'}
                placeholderTextColor="#9CA3AF"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>{isHindi ? 'सहेजें' : 'Save'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn:       { padding: 4, marginRight: 14 },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSub:     { fontSize: 12, color: '#6B7280', marginTop: 1 },
  addMemberBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.primary },
  addMemberText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6,
  },
  tabBtnActive: { borderBottomWidth: 2.5, borderBottomColor: COLORS.primary },
  tabLabel:       { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  tabLabelActive: { color: COLORS.primary, fontWeight: '800' },
  badgeDot: {
    position: 'absolute', top: -5, right: -7,
    backgroundColor: '#EF4444', borderRadius: 8, width: 15, height: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  scroll: { padding: 20, paddingBottom: 80 },

  // Member groups
  group:      { marginBottom: 24 },
  groupLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },

  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  memberAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2, borderColor: COLORS.primary + '30',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  memberInfo:    { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  memberName:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  relationPill:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  relationPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  memberMeta:    { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  phoneRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  phoneText:     { fontSize: 12, color: '#6B7280' },
  memberNote:    { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 3 },
  memberActions: { gap: 6 },
  actionIcon:    { padding: 8 },

  // Section heading
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionHeading:   { fontSize: 16, fontWeight: '800', color: '#111827' },
  sectionSubtitle:  { fontSize: 12, color: '#9CA3AF' },

  // Voice note bubble
  voiceBubble: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  voiceBubblePlaying: { borderColor: COLORS.primary, borderWidth: 1.5 },
  voiceTopRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  voiceAvatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  voiceAvatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  voiceSender:   { fontSize: 14, fontWeight: '700', color: '#111827' },
  voiceTime:     { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  voiceDuration: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  voicePlayerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  voicePlayBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.5, borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  voicePlayBtnActive: { backgroundColor: COLORS.primary },
  waveformWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar:      { width: 4, borderRadius: 2 },
  voiceTranscript: { fontSize: 13, color: '#6B7280', lineHeight: 19, fontStyle: 'italic' },

  // Caretaker
  caretakerCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  caretakerAvatarWrap: { position: 'relative', marginRight: 0 },
  caretakerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  caretakerOnline: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff',
  },
  caretakerName: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  caretakerRole: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  caretakerStatusBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  caretakerStatusText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  noCaretakerTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 3 },
  noCaretakerSub:   { fontSize: 12, color: '#9CA3AF' },

  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  liveText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  msgBubble: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  msgBubbleUnread: { borderColor: COLORS.primary + '60', backgroundColor: COLORS.primaryLight + '30' },
  msgRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  msgSender: { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1 },
  msgTime:   { fontSize: 11, color: '#9CA3AF' },
  msgText:   { fontSize: 14, color: '#111827', lineHeight: 21 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },

  emptyMsgs:     { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyMsgsText: { fontSize: 14, color: '#9CA3AF' },

  // Two-way chat bubbles
  chatRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 8 },
  chatRowRight: { flexDirection: 'row-reverse' },
  chatAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#6B7280', justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  chatBubble: { maxWidth: '72%', borderRadius: 16, padding: 12, paddingBottom: 8 },
  chatBubbleLeft: {
    backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  chatBubbleRight: {
    backgroundColor: COLORS.primary, borderBottomRightRadius: 4,
  },
  chatSenderLabel:{ fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  chatText:       { fontSize: 14, color: '#111827', lineHeight: 21 },
  chatTextRight:  { color: '#FFFFFF' },
  chatTime:       { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'left' },
  chatTimeRight:  { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },

  // Reply bar
  replyBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  replyInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#111827', maxHeight: 100,
    backgroundColor: '#F9FAFB',
  },
  replyBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  replyBtnDisabled: { backgroundColor: '#D1D5DB' },

  // SOS alert banner
  sosBanner: {
    backgroundColor: '#DC2626', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
    gap: 12,
  },
  sosBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sosBannerTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  sosBannerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  sosMapsBtn: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  sosMapsBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  // Edit modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '92%', paddingBottom: 32,
  },
  handleBar: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalBody:   { paddingHorizontal: 20, paddingBottom: 20 },
  formLabel:   { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  formInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  relChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  relChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  relChipText:       { fontSize: 13, fontWeight: '600', color: '#374151' },
  relChipTextActive: { color: '#fff' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
