/**
 * Family Memory Vault — Yaadein (यादें)
 *
 * Features:
 *  • Multiple photos per memory (horizontal gallery + dot indicators)
 *  • Category filter chips with scroll arrows
 *  • Full-text search
 *  • Add / Edit / Delete with multi-photo picker
 *  • Staggered card entrance animation (slide up + fade)
 *  • Spring press animation on cards
 *  • Pulsing add button
 *  • Chip bounce on select
 *  • Beautiful empty-state illustration (View-only, no SVG library)
 *  • Bilingual Hindi / English
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, FlatList, StatusBar, Modal, Alert,
  KeyboardAvoidingView, Platform, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';

const { width: SW } = Dimensions.get('window');

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',          label: 'All',         labelHi: 'सभी',       icon: 'albums-outline'    },
  { id: 'marriage',     label: 'Marriage',    labelHi: 'विवाह',     icon: 'heart-outline'     },
  { id: 'travel',       label: 'Travel',      labelHi: 'यात्रा',    icon: 'airplane-outline'  },
  { id: 'festivals',    label: 'Festivals',   labelHi: 'त्योहार',   icon: 'sparkles-outline'  },
  { id: 'achievements', label: 'Achievement', labelHi: 'उपलब्धि',   icon: 'trophy-outline'    },
  { id: 'family',       label: 'Family',      labelHi: 'परिवार',    icon: 'people-outline'    },
  { id: 'childhood',    label: 'Childhood',   labelHi: 'बचपन',      icon: 'balloon-outline'   },
];

const CAT_COLORS = {
  marriage:     { bg: '#FDE8E8', accent: '#C94A4A', text: '#8B2020' },
  travel:       { bg: '#E8F4FD', accent: '#2980B9', text: '#1A5276' },
  festivals:    { bg: '#FEF3DC', accent: '#E67E22', text: '#784212' },
  achievements: { bg: '#E8F8F2', accent: '#27AE60', text: '#145A32' },
  family:       { bg: '#F5EBE1', accent: '#C85A32', text: '#7B3A1D' },
  childhood:    { bg: '#EDE8FD', accent: '#8E44AD', text: '#4A235A' },
};

// ─── Seed Memories (multiple photos per memory) ───────────────────────────────

let _id = 100;
const mkId = () => String(++_id);

// Using picsum.photos by ID — always reliable, never removed
const P = (id) => `https://picsum.photos/id/${id}/800/500`;

const SEED_MEMORIES = [
  {
    id: '1',
    title: 'Wedding Day in Jaipur',
    titleHi: 'जयपुर में विवाह',
    category: 'marriage',
    date: '15 Feb 1982',    dateHi: '१५ फरवरी १९८२',
    description: 'The most beautiful day of our lives. Married in a grand ceremony at the family haveli.',
    descriptionHi: 'हमारे जीवन का सबसे सुंदर दिन। पारिवारिक हवेली में एक भव्य समारोह में विवाह हुआ।',
    story: 'Papa had arranged a baraat of 200 people. Amma wore the red Banarasi saree. The shehnai played all night. Dadi cried with joy.',
    storyHi: 'पापा ने 200 लोगों की बारात की व्यवस्था की। अम्मा ने लाल बनारसी साड़ी पहनी। पूरी रात शहनाई बजती रही।',
    tags:   ['Amma', 'Papa', 'Dadi', 'Jaipur'],
    tagsHi: ['अम्मा', 'पापा', 'दादी', 'जयपुर'],
    photos: [P(1005), P(129), P(883)],
  },
  {
    id: '2',
    title: 'Shimla Family Trip',
    titleHi: 'शिमला परिवार यात्रा',
    category: 'travel',
    date: 'December 1995',  dateHi: 'दिसंबर १९९५',
    description: 'First family vacation to the hills. Snow everywhere, children laughing, hot chai at every stop.',
    descriptionHi: 'पहाड़ों पर पहली पारिवारिक छुट्टी। हर जगह बर्फ, बच्चों की हँसी और गरम चाय।',
    story: 'Rohan touched snow for the first time at age 5. Ananya made a tiny snowman. We stayed at a wooden cottage with a fireplace.',
    storyHi: 'रोहन ने 5 साल की उम्र में पहली बार बर्फ छुई। अनन्या ने एक छोटा-सा बर्फ का आदमी बनाया।',
    tags:   ['Rohan', 'Ananya', 'Shimla', 'Winter'],
    tagsHi: ['रोहन', 'अनन्या', 'शिमला', 'सर्दी'],
    photos: [P(167), P(1016), P(376)],
  },
  {
    id: '3',
    title: 'Diwali at the Old House',
    titleHi: 'पुराने घर में दीवाली',
    category: 'festivals',
    date: 'October 2001',   dateHi: 'अक्टूबर २००१',
    description: 'The old kothi lit with a thousand diyas. The whole mohalla gathered for the celebration.',
    descriptionHi: 'पुरानी कोठी हज़ार दियों से जगमगा रही थी। पूरा मोहल्ला जश्न मनाने आया।',
    story: 'Three days making rangoli across the entire courtyard. Chachi made the best gulab jamun. Every child got sparklers.',
    storyHi: 'तीन दिन आँगन में रंगोली बनाई। चाची ने सबसे अच्छे गुलाब जामुन बनाए। हर बच्चे को फुलझड़ी मिली।',
    tags:   ['Chachi', 'Diwali', 'Old House', 'Festival'],
    tagsHi: ['चाची', 'दीवाली', 'पुराना घर', 'त्योहार'],
    photos: [P(259), P(430), P(1041)],
  },
  {
    id: '4',
    title: 'Nana Ji Retires from Railway',
    titleHi: 'नाना जी की रेलवे से सेवानिवृत्ति',
    category: 'achievements',
    date: '30 June 1998',   dateHi: '३० जून १९९८',
    description: '35 years of dedicated service. The entire department came to celebrate.',
    descriptionHi: '35 साल की समर्पित सेवा। पूरा विभाग उनकी सेवानिवृत्ति मनाने आया।',
    story: 'Nana ji received a gold watch. He stood in his uniform and gave a speech that made everyone cry.',
    storyHi: 'नाना जी को सोने की घड़ी मिली। वे वर्दी में सीधे खड़े हुए और भाषण दिया जिसने सबको रुला दिया।',
    tags:   ['Nana Ji', 'Railway', 'Retirement'],
    tagsHi: ['नाना जी', 'रेलवे', 'सेवानिवृत्ति'],
    photos: [P(1074), P(235), P(447)],
  },
  {
    id: '5',
    title: 'Four Generations Together',
    titleHi: 'चार पीढ़ियाँ एक साथ',
    category: 'family',
    date: 'January 2010',   dateHi: 'जनवरी २०१०',
    description: 'Dadi turned 80. Four generations sat together for the first time.',
    descriptionHi: 'दादी 80 साल की हुईं। पहली बार चार पीढ़ियाँ एक साथ बैठीं।',
    story: 'Great-grandmother Shanti Devi held baby Arya in her lap. Five months later, she passed peacefully.',
    storyHi: 'परदादी शांति देवी ने नन्ही आर्या को गोद में बिठाया। पाँच महीने बाद वे शांति से चली गईं।',
    tags:   ['Dadi', 'Shanti Devi', 'Arya', 'Family'],
    tagsHi: ['दादी', 'शांति देवी', 'आर्या', 'परिवार'],
    photos: [P(1002), P(866), P(582)],
  },
  {
    id: '6',
    title: "Papa's First Bicycle",
    titleHi: 'पापा की पहली साइकिल',
    category: 'childhood',
    date: 'Summer 1965',    dateHi: 'गर्मी १९६५',
    description: 'A red bicycle from the local market. Papa rode it every morning for 10 years.',
    descriptionHi: 'स्थानीय बाज़ार से लाल साइकिल। पापा ने 10 साल तक हर सुबह इसे चलाया।',
    story: 'Dadaji saved for six months. It cost 45 rupees. Papa still gets misty-eyed.',
    storyHi: 'दादाजी ने छह महीने बचत की। कीमत थी 45 रुपये। पापा आज भी भावुक हो जाते हैं।',
    tags:   ['Papa', 'Dadaji', 'Childhood', 'Bicycle'],
    tagsHi: ['पापा', 'दादाजी', 'बचपन', 'साइकिल'],
    photos: [P(217), P(180), P(392)],
  },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function YaadeinScreen() {
  const router  = useRouter();
  const { language } = useTranslation();
  const isHindi = language === 'hi';

  const [memories,       setMemories]       = useState(SEED_MEMORIES);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [editingMemory,  setEditingMemory]  = useState(null);
  const [detailMemory,   setDetailMemory]   = useState(null);

  const emptyForm = {
    title: '', titleHi: '', category: 'family', date: '',
    description: '', descriptionHi: '', story: '', storyHi: '',
    tags: '', photos: [],
  };
  const [form, setForm] = useState(emptyForm);

  // Chip scroll
  const chipScrollRef = useRef(null);
  const chipScrollX   = useRef(0);
  const scrollChips   = (dir) => {
    const next = Math.max(0, chipScrollX.current + dir * 140);
    chipScrollRef.current?.scrollTo({ x: next, animated: true });
  };

  // Add-button pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Filtered list
  const filtered = memories.filter(m => {
    const catOk = activeCategory === 'all' || m.category === activeCategory;
    if (!catOk) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const t = (isHindi && m.titleHi ? m.titleHi : m.title).toLowerCase();
    const d = (isHindi && m.descriptionHi ? m.descriptionHi : m.description).toLowerCase();
    const tgs = (m.tags || []).join(' ').toLowerCase();
    return t.includes(q) || d.includes(q) || tgs.includes(q);
  });

  // Photo picker (multi)
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (!result.canceled) {
      setForm(f => ({ ...f, photos: [...f.photos, result.assets[0].uri] }));
    }
  };

  const removePhoto = (index) => {
    setForm(f => ({ ...f, photos: f.photos.filter((_, i) => i !== index) }));
  };

  // Save
  const handleSave = () => {
    if (!form.title.trim()) {
      Alert.alert(isHindi ? 'शीर्षक आवश्यक है' : 'Title required'); return;
    }
    const tagsArr = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (editingMemory) {
      setMemories(prev => prev.map(m =>
        m.id === editingMemory.id ? { ...m, ...form, tags: tagsArr } : m
      ));
    } else {
      setMemories(prev => [{ id: mkId(), ...form, tags: tagsArr }, ...prev]);
    }
    setShowAddModal(false); setEditingMemory(null); setForm(emptyForm);
  };

  const openEdit = (memory) => {
    setEditingMemory(memory);
    setForm({
      title: memory.title, titleHi: memory.titleHi || '',
      category: memory.category, date: memory.date || '',
      description: memory.description, descriptionHi: memory.descriptionHi || '',
      story: memory.story || '', storyHi: memory.storyHi || '',
      tags: (memory.tags || []).join(', '),
      photos: memory.photos || [],
    });
    setDetailMemory(null); setShowAddModal(true);
  };

  const handleDelete = (id) => {
    Alert.alert(
      isHindi ? 'याद हटाएं?' : 'Delete Memory?',
      isHindi ? 'यह याद हमेशा के लिए मिट जाएगी।' : 'This memory will be deleted forever.',
      [
        { text: isHindi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        { text: isHindi ? 'हटाएं' : 'Delete', style: 'destructive',
          onPress: () => { setMemories(prev => prev.filter(m => m.id !== id)); setDetailMemory(null); } },
      ]
    );
  };

  const getCatLabel = (id) => {
    const c = CATEGORIES.find(c => c.id === id);
    return c ? (isHindi ? c.labelHi : c.label) : id;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isHindi ? 'यादें' : 'Family Memory Vault'}</Text>
          <Text style={styles.headerSub}>
            {isHindi ? `${memories.length} यादें संजोई हुई हैं` : `${memories.length} memories preserved`}
          </Text>
        </View>
        {/* Pulsing add button */}
        <View>
          <Animated.View style={[styles.addBtnGlow, { transform: [{ scale: pulseAnim }] }]} />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setEditingMemory(null); setForm(emptyForm); setShowAddModal(true); }}
            activeOpacity={0.82}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={isHindi ? 'यादें, लोग, स्थान खोजें...' : 'Search memories, people, places...'}
          placeholderTextColor={COLORS.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips with arrows */}
      <View style={styles.chipRow}>
        <TouchableOpacity style={styles.chipArrow} onPress={() => scrollChips(-1)} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={17} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <ScrollView
          ref={chipScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={styles.chipContent}
          onScroll={e => { chipScrollX.current = e.nativeEvent.contentOffset.x; }}
          scrollEventThrottle={16}
        >
          {CATEGORIES.map(cat => (
            <CategoryChip
              key={cat.id}
              cat={cat}
              active={activeCategory === cat.id}
              isHindi={isHindi}
              onPress={() => setActiveCategory(cat.id)}
            />
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.chipArrow} onPress={() => scrollChips(1)} activeOpacity={0.8}>
          <Ionicons name="chevron-forward" size={17} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* List or Empty */}
      {filtered.length === 0 ? (
        <EmptyIllustration searchQuery={searchQuery} isHindi={isHindi} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <MemoryCard
              memory={item}
              index={index}
              isHindi={isHindi}
              onPress={() => setDetailMemory(item)}
              getCatLabel={getCatLabel}
            />
          )}
        />
      )}

      {/* Detail Modal */}
      {detailMemory && (
        <DetailModal
          memory={detailMemory}
          isHindi={isHindi}
          getCatLabel={getCatLabel}
          onClose={() => setDetailMemory(null)}
          onEdit={() => openEdit(detailMemory)}
          onDelete={() => handleDelete(detailMemory.id)}
        />
      )}

      {/* Add/Edit Modal */}
      <AddEditModal
        visible={showAddModal}
        isEdit={!!editingMemory}
        form={form}
        setForm={setForm}
        isHindi={isHindi}
        onPickPhoto={pickPhoto}
        onRemovePhoto={removePhoto}
        onSave={handleSave}
        onClose={() => { setShowAddModal(false); setEditingMemory(null); setForm(emptyForm); }}
      />
    </SafeAreaView>
  );
}

// ─── Category Chip (with bounce animation) ────────────────────────────────────

function CategoryChip({ cat, active, isHindi, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 40 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <Ionicons name={cat.icon} size={13} color={active ? '#fff' : COLORS.textSecondary} style={{ marginRight: 4 }} />
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {isHindi ? cat.labelHi : cat.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty State Illustration ─────────────────────────────────────────────────

function EmptyIllustration({ searchQuery, isHindi }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1400, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,   duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.emptyBox}>
      {/* Geometric illustration: layered photo frames */}
      <Animated.View style={[styles.illusWrap, { transform: [{ translateY: floatAnim }] }]}>
        {/* Back frame */}
        <View style={[styles.illusFrame, styles.illusFrameBack]}>
          <Ionicons name="image-outline" size={22} color={COLORS.primaryLight} />
        </View>
        {/* Mid frame */}
        <View style={[styles.illusFrame, styles.illusFrameMid]}>
          <Ionicons name="image-outline" size={20} color={COLORS.primaryLight} />
        </View>
        {/* Front frame */}
        <View style={styles.illusFrameFront}>
          <Ionicons name="heart" size={30} color={COLORS.primary} />
        </View>
        {/* Decorative dots */}
        <View style={[styles.illusDot, { top: 4, right: 4, width: 8, height: 8, backgroundColor: COLORS.primary + '40' }]} />
        <View style={[styles.illusDot, { bottom: 8, left: 0, width: 12, height: 12, backgroundColor: COLORS.primary + '25' }]} />
        <View style={[styles.illusDot, { top: 20, left: -8, width: 6, height: 6, backgroundColor: '#E67E22' + '50' }]} />
      </Animated.View>

      <Text style={styles.emptyTitle}>
        {searchQuery
          ? (isHindi ? 'कोई याद नहीं मिली' : 'No memories found')
          : (isHindi ? 'पहली याद जोड़ें' : 'Add your first memory')}
      </Text>
      <Text style={styles.emptyBody}>
        {searchQuery
          ? (isHindi ? 'अलग शब्द आज़माएं' : 'Try a different search term')
          : (isHindi ? 'परिवार के खास पलों को सहेजें' : 'Preserve precious family moments forever')}
      </Text>
    </View>
  );
}

// ─── Memory Card (staggered entrance + spring press + photo dots) ─────────────

function MemoryCard({ memory, index, isHindi, onPress, getCatLabel }) {
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 380, delay: index * 75, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: index * 75, useNativeDriver: true, damping: 14, stiffness: 90 }),
    ]).start();
  }, []);

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start();

  const catStyle     = CAT_COLORS[memory.category] || CAT_COLORS.family;
  const displayTitle = (isHindi && memory.titleHi) ? memory.titleHi : memory.title;
  const displayDesc  = (isHindi && memory.descriptionHi) ? memory.descriptionHi : memory.description;
  const photos       = memory.photos || [];
  const firstPhoto   = photos[0] || null;

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateY }, { scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Photo */}
        {firstPhoto ? (
          <View>
            <Image source={{ uri: firstPhoto }} style={styles.cardPhoto} resizeMode="cover" />
            {/* Multi-photo dots */}
            {photos.length > 1 && (
              <View style={styles.dotRowCard}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dotCard, i === 0 && styles.dotCardActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.cardPhotoPlaceholder, { backgroundColor: catStyle.bg }]}>
            <Ionicons name={CATEGORIES.find(c => c.id === memory.category)?.icon || 'images-outline'} size={40} color={catStyle.accent} />
            <View style={[styles.decorCircle1, { backgroundColor: catStyle.accent + '18' }]} />
            <View style={[styles.decorCircle2, { backgroundColor: catStyle.accent + '12' }]} />
          </View>
        )}

        {/* Category badge */}
        <View style={[styles.catBadge, { backgroundColor: catStyle.accent }]}>
          <Text style={styles.catBadgeText}>{getCatLabel(memory.category)}</Text>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{displayTitle}</Text>
          {memory.date ? (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textLight} />
              <Text style={styles.metaText}>{isHindi && memory.dateHi ? memory.dateHi : memory.date}</Text>
              {photos.length > 1 && (
                <>
                  <Ionicons name="images-outline" size={12} color={COLORS.textLight} style={{ marginLeft: 8 }} />
                  <Text style={styles.metaText}>{photos.length} photos</Text>
                </>
              )}
            </View>
          ) : null}
          <Text style={styles.cardDesc} numberOfLines={2}>{displayDesc}</Text>
          {(memory.tags || []).length > 0 && (
            <View style={styles.tagRow}>
              {(isHindi ? (memory.tagsHi || memory.tags) : memory.tags).slice(0, 3).map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {(memory.tags || []).length > 3 && (
                <Text style={styles.tagMore}>+{memory.tags.length - 3}</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Detail Modal (photo gallery + full info) ─────────────────────────────────

function DetailModal({ memory, isHindi, getCatLabel, onClose, onEdit, onDelete }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const catStyle     = CAT_COLORS[memory.category] || CAT_COLORS.family;
  const displayTitle = (isHindi && memory.titleHi) ? memory.titleHi : memory.title;
  const displayDesc  = (isHindi && memory.descriptionHi) ? memory.descriptionHi : memory.description;
  const displayStory = (isHindi && memory.storyHi) ? memory.storyHi : memory.story;
  const displayDate  = (isHindi && memory.dateHi) ? memory.dateHi : memory.date;
  const photos       = memory.photos || [];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.detailOverlay}>
        <View style={styles.detailSheet}>
          <View style={styles.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Photo gallery */}
            {photos.length > 0 ? (
              <View>
                <FlatList
                  data={photos}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => String(i)}
                  onMomentumScrollEnd={e => {
                    setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
                  }}
                  renderItem={({ item }) => (
                    <Image source={{ uri: item }} style={{ width: SW, height: 240 }} resizeMode="cover" />
                  )}
                />
                {photos.length > 1 && (
                  <View style={styles.dotRowDetail}>
                    {photos.map((_, i) => (
                      <View key={i} style={[styles.dotDetail, i === photoIdx && styles.dotDetailActive]} />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.detailPhotoPlaceholder, { backgroundColor: catStyle.bg }]}>
                <Ionicons name={CATEGORIES.find(c => c.id === memory.category)?.icon || 'images-outline'} size={64} color={catStyle.accent} />
              </View>
            )}

            <View style={styles.detailBody}>
              {/* Badge + actions */}
              <View style={styles.detailTopRow}>
                <View style={[styles.catBadgeInline, { backgroundColor: catStyle.accent }]}>
                  <Text style={styles.catBadgeText}>{getCatLabel(memory.category)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.8}>
                    <Ionicons name="create-outline" size={19} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.error }]} onPress={onDelete} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={19} color={COLORS.error} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={onClose} activeOpacity={0.8}>
                    <Ionicons name="close" size={19} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.detailTitle}>{displayTitle}</Text>
              {displayDate ? (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={[styles.metaText, { fontSize: 13 }]}>{displayDate}</Text>
                </View>
              ) : null}

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>{isHindi ? 'विवरण' : 'Description'}</Text>
              <Text style={styles.detailText}>{displayDesc}</Text>

              {displayStory ? (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{isHindi ? 'कहानी' : 'Personal Story'}</Text>
                  <View style={[styles.storyBox, { borderLeftColor: catStyle.accent }]}>
                    <Text style={styles.storyText}>{displayStory}</Text>
                  </View>
                </>
              ) : null}

              {(memory.tags || []).length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{isHindi ? 'लोग और स्थान' : 'People & Places'}</Text>
                  <View style={styles.tagRow}>
                    {(isHindi ? (memory.tagsHi || memory.tags) : memory.tags).map((tag, i) => (
                      <View key={i} style={[styles.tag, { backgroundColor: catStyle.bg, borderColor: catStyle.accent + '50' }]}>
                        <Text style={[styles.tagText, { color: catStyle.text }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function AddEditModal({ visible, isEdit, form, setForm, isHindi, onPickPhoto, onRemovePhoto, onSave, onClose }) {
  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <View style={styles.formSheet}>
            <View style={styles.handleBar} />
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {isEdit ? (isHindi ? 'याद संपादित करें' : 'Edit Memory') : (isHindi ? 'नई याद जोड़ें' : 'Add New Memory')}
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>

              {/* Multi-photo row */}
              <Text style={styles.formLabel}>{isHindi ? 'फोटो' : 'Photos'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {(form.photos || []).map((uri, i) => (
                  <View key={i} style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => onRemovePhoto(i)} activeOpacity={0.8}>
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.photoAddThumb} onPress={onPickPhoto} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={26} color={COLORS.primary} />
                  <Text style={styles.photoAddText}>{isHindi ? 'जोड़ें' : 'Add'}</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Category */}
              <Text style={styles.formLabel}>{isHindi ? 'श्रेणी' : 'Category'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                  const sel = form.category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, sel && styles.chipActive, { marginRight: 8 }]}
                      onPress={() => f('category', cat.id)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={cat.icon} size={13} color={sel ? '#fff' : COLORS.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={[styles.chipText, sel && styles.chipTextActive]}>
                        {isHindi ? cat.labelHi : cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.formLabel}>{isHindi ? 'शीर्षक *' : 'Title *'}</Text>
              <TextInput style={styles.formInput} value={form.title} onChangeText={v => f('title', v)}
                placeholder={isHindi ? 'जैसे: शिमला यात्रा' : 'e.g. Shimla Family Trip'}
                placeholderTextColor={COLORS.textLight} />

              <Text style={styles.formLabel}>{isHindi ? 'तारीख / वर्ष' : 'Date / Year'}</Text>
              <TextInput style={styles.formInput} value={form.date} onChangeText={v => f('date', v)}
                placeholder="e.g. December 1995" placeholderTextColor={COLORS.textLight} />

              <Text style={styles.formLabel}>{isHindi ? 'विवरण' : 'Description'}</Text>
              <TextInput style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                value={form.description} onChangeText={v => f('description', v)} multiline
                placeholder={isHindi ? 'इस याद के बारे में लिखें...' : 'Describe this memory...'}
                placeholderTextColor={COLORS.textLight} />

              <Text style={styles.formLabel}>{isHindi ? 'कहानी' : 'Personal Story'}</Text>
              <TextInput style={[styles.formInput, { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }]}
                value={form.story} onChangeText={v => f('story', v)} multiline
                placeholder={isHindi ? 'उस दिन की पूरी कहानी...' : 'Write the full story of that day...'}
                placeholderTextColor={COLORS.textLight} />

              <Text style={styles.formLabel}>{isHindi ? 'लोग और स्थान (अल्पविराम से)' : 'People & Places (comma separated)'}</Text>
              <TextInput style={styles.formInput} value={form.tags} onChangeText={v => f('tags', v)}
                placeholder={isHindi ? 'जैसे: रोहन, जयपुर, दादी' : 'e.g. Rohan, Jaipur, Dadi'}
                placeholderTextColor={COLORS.textLight} />

              <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.82}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                <Text style={styles.saveBtnText}>{isHindi ? 'सहेजें' : 'Save Memory'}</Text>
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
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:    { padding: SPACING.xs, marginRight: SPACING.sm + 2 },
  headerTitle:{ fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerSub:  { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  addBtnGlow: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 26, backgroundColor: COLORS.primary + '28',
  },
  addBtn: {
    backgroundColor: COLORS.primary, borderRadius: 20,
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
  },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    margin: SPACING.md, marginBottom: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md - 2, paddingVertical: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },

  // Category chips
  chipRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 },
  chipArrow: {
    width: 30, height: 30, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 15, marginHorizontal: 5,
  },
  chipContent: { paddingHorizontal: 4, paddingBottom: 4, gap: 8, flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
  },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#fff' },

  // List
  listContent: { padding: SPACING.md, paddingBottom: 80 },

  // Empty illustration
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  illusWrap: { width: 140, height: 140, marginBottom: 28, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  illusFrame: {
    position: 'absolute', borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primaryLight,
  },
  illusFrameBack: {
    width: 80, height: 80, backgroundColor: COLORS.surfaceSecondary,
    transform: [{ rotate: '-15deg' }], top: 10, left: 10,
  },
  illusFrameMid: {
    width: 80, height: 80, backgroundColor: COLORS.primaryLight,
    transform: [{ rotate: '8deg' }], top: 5, right: 5,
  },
  illusFrameFront: {
    width: 70, height: 70, backgroundColor: COLORS.surface,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
    zIndex: 10,
  },
  illusDot: { position: 'absolute', borderRadius: 99 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptyBody:  { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Memory Card
  card: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.cardRadius, marginBottom: SPACING.md,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.textPrimary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardPhoto: { width: '100%', height: 185 },
  cardPhotoPlaceholder: {
    width: '100%', height: 160, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  decorCircle1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -40, right: -40 },
  decorCircle2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, bottom: -30, left: -20 },
  catBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  catBadgeInline: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  catBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBody: { padding: SPACING.md - 2 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  metaText: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
  cardDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 10 },

  // Photo dots on card
  dotRowCard:    { position: 'absolute', bottom: 10, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dotCard:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotCardActive: { backgroundColor: '#fff', width: 18, borderRadius: 3 },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  tagMore: { fontSize: 12, color: COLORS.textLight, alignSelf: 'center', marginLeft: 2 },

  // Detail modal
  detailOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.52)' },
  detailSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '94%', paddingBottom: 32,
  },
  handleBar: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  detailPhotoPlaceholder: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center' },
  detailBody: { padding: SPACING.md },
  detailTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  actionBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: SPACING.sm - 2, backgroundColor: COLORS.background,
  },
  detailTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 6, lineHeight: 28 },
  divider:     { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  sectionLabel:{ fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  detailText:  { fontSize: 15, color: COLORS.textPrimary, lineHeight: 23 },
  storyBox: {
    borderLeftWidth: 3, paddingLeft: 14,
    backgroundColor: COLORS.primaryLight, borderRadius: 8, padding: SPACING.md - 2,
  },
  storyText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, fontStyle: 'italic' },

  // Gallery dots in detail
  dotRowDetail:    { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dotDetail:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.border },
  dotDetailActive: { backgroundColor: COLORS.primary, width: 20, borderRadius: 3.5 },

  // Add/Edit modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  formSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%',
  },
  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingBottom: 12,
  },
  formTitle:  { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  formScroll: { paddingHorizontal: SPACING.md, paddingBottom: 40 },
  formLabel:  { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  formInput: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, marginBottom: 16,
  },

  // Multi-photo picker
  photoThumbWrap: { marginRight: 10, position: 'relative' },
  photoThumb:     { width: 90, height: 90, borderRadius: 12 },
  photoRemoveBtn: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: COLORS.error, borderRadius: 10,
  },
  photoAddThumb: {
    width: 90, height: 90, borderRadius: 12, marginRight: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  photoAddText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginTop: 4 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: SIZES.buttonRadius,
    minHeight: SIZES.minTouchHeight, marginTop: SPACING.sm,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
