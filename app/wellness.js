/**
 * app/wellness.js
 * Wellness hub: water, breathing, gentle exercises, medicines, sleep.
 *
 * Frontend-only. State lives in a module-level store, so it survives leaving
 * and re-opening this screen during one app session, and it resets every new day.
 * To persist for real later, replace the body of `update()` with a Firestore write.
 *
 * Needs nothing new: Ionicons ships with Expo, everything else is React Native core.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  Alert,
  Vibration,
  AccessibilityInfo,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../context/LanguageContext';
import { colors, spacing, radius, border, sizes, textStyle } from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';

/* -------------------------------------------------------------------------- */
/* Constants and content                                                       */
/* -------------------------------------------------------------------------- */
const WATER_GOAL = 8;
const STRETCH_GOAL = 3; // exercises needed for "done" today
const GOLD_LIGHT = colors.goldLight || '#E8CF8E';

const EXERCISES = [
  {
    id: 'neck',
    icon: 'body-outline',
    en: 'Neck rolls',
    hi: 'गर्दन घुमाना',
    stepsEn: [
      'Sit tall with your shoulders relaxed.',
      'Slowly turn your head to the right, then to the left.',
      'Go gently and stop if you feel dizzy.',
    ],
    stepsHi: [
      'कंधे ढीले रखकर सीधे बैठें।',
      'सिर को धीरे से दाईं ओर, फिर बाईं ओर घुमाएँ।',
      'आराम से करें। चक्कर आए तो रुक जाएँ।',
    ],
  },
  {
    id: 'shoulder',
    icon: 'body-outline',
    en: 'Shoulder rolls',
    hi: 'कंधे घुमाना',
    stepsEn: [
      'Lift both shoulders up toward your ears.',
      'Roll them back and down in a slow circle.',
      'Repeat slowly, breathing normally.',
    ],
    stepsHi: [
      'दोनों कंधों को कानों की ओर ऊपर उठाएँ।',
      'उन्हें धीरे से पीछे और नीचे की ओर घुमाएँ।',
      'सामान्य सांस के साथ धीरे-धीरे दोहराएँ।',
    ],
  },
  {
    id: 'arms',
    icon: 'hand-left-outline',
    en: 'Arm raises',
    hi: 'हाथ ऊपर उठाना',
    stepsEn: [
      'Sit with both feet flat on the floor.',
      'Raise both arms slowly overhead as you breathe in.',
      'Lower them as you breathe out.',
    ],
    stepsHi: [
      'दोनों पैर ज़मीन पर रखकर बैठें।',
      'सांस लेते हुए दोनों हाथ धीरे से ऊपर उठाएँ।',
      'सांस छोड़ते हुए हाथ नीचे लाएँ।',
    ],
  },
  {
    id: 'ankle',
    icon: 'footsteps-outline',
    en: 'Ankle circles',
    hi: 'टखने घुमाना',
    stepsEn: [
      'Lift one foot a little off the floor.',
      'Draw slow circles with your toes.',
      'Switch to the other foot halfway.',
    ],
    stepsHi: [
      'एक पैर को ज़मीन से थोड़ा ऊपर उठाएँ।',
      'पंजे से धीरे-धीरे गोल घेरे बनाएँ।',
      'आधे समय बाद दूसरा पैर लें।',
    ],
  },
  {
    id: 'legs',
    icon: 'walk-outline',
    en: 'Seated leg lifts',
    hi: 'बैठकर पैर उठाना',
    stepsEn: [
      'Hold the sides of your chair.',
      'Straighten one leg and hold for a moment.',
      'Lower it slowly, then switch legs.',
    ],
    stepsHi: [
      'कुर्सी के दोनों किनारे पकड़ें।',
      'एक पैर सीधा करके थोड़ी देर रोकें।',
      'धीरे से नीचे लाएँ, फिर दूसरा पैर लें।',
    ],
  },
  {
    id: 'stretch',
    icon: 'accessibility-outline',
    en: 'Seated stretch',
    hi: 'बैठकर स्ट्रेच',
    stepsEn: [
      'Sit tall and clasp your hands in front.',
      'Stretch your arms forward and round your back gently.',
      'Breathe slowly and relax your shoulders.',
    ],
    stepsHi: [
      'सीधे बैठें और हाथों को आगे जोड़ें।',
      'हाथ आगे फैलाएँ और पीठ को हल्का सा गोल करें।',
      'धीरे-धीरे सांस लें और कंधे ढीले छोड़ें।',
    ],
  },
];
const EXERCISE_SECONDS = 30;

const BREATH_MODES = {
  calm: {
    en: 'Calm breathing',
    hi: 'शांत सांस',
    descEn: 'In for 4, hold for 4, out for 6',
    descHi: '4 सेकंड अंदर, 4 रोकें, 6 बाहर',
    phases: [
      { type: 'in', sec: 4, en: 'Breathe in', hi: 'सांस अंदर लें' },
      { type: 'hold', sec: 4, en: 'Hold', hi: 'रोकें' },
      { type: 'out', sec: 6, en: 'Breathe out', hi: 'सांस बाहर छोड़ें' },
    ],
  },
  anulom: {
    en: 'Anulom Vilom',
    hi: 'अनुलोम-विलोम',
    descEn: 'Breathe through alternate nostrils',
    descHi: 'बारी-बारी से दोनों नथुनों से सांस',
    phases: [
      { type: 'in', sec: 4, en: 'Breathe in through the left nostril', hi: 'बाएँ नथुने से सांस लें' },
      { type: 'hold', sec: 4, en: 'Hold', hi: 'रोकें' },
      { type: 'out', sec: 4, en: 'Breathe out through the right nostril', hi: 'दाएँ नथुने से सांस छोड़ें' },
      { type: 'in', sec: 4, en: 'Breathe in through the right nostril', hi: 'दाएँ नथुने से सांस लें' },
      { type: 'hold', sec: 4, en: 'Hold', hi: 'रोकें' },
      { type: 'out', sec: 4, en: 'Breathe out through the left nostril', hi: 'बाएँ नथुने से सांस छोड़ें' },
    ],
  },
};

const SLOTS = [
  { id: 'morning', en: 'Morning', hi: 'सुबह' },
  { id: 'afternoon', en: 'Afternoon', hi: 'दोपहर' },
  { id: 'night', en: 'Night', hi: 'रात' },
];

const SLEEP_OPTIONS = [4, 5, 6, 7, 8, 9];
const SLEEP_QUALITY = [
  { id: 'good', en: 'Good', hi: 'अच्छी' },
  { id: 'okay', en: 'Okay', hi: 'ठीक' },
  { id: 'poor', en: 'Poor', hi: 'खराब' },
];

/* -------------------------------------------------------------------------- */
/* Session store (resets each new day)                                         */
/* -------------------------------------------------------------------------- */
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const freshDay = (meds = []) => ({
  date: todayKey(),
  water: 0,
  breathingMinutes: 0,
  stretches: 0,
  meds, // [{ id, name, slot }]  (kept across days)
  taken: {}, // { [medId]: true }  (resets daily)
  sleepHours: null,
  sleepQuality: null,
});

let store = freshDay();

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                         */
/* -------------------------------------------------------------------------- */
function Btn({ label, onPress, lang, tone = 'primary', icon, disabled, style }) {
  const tones = {
    primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary, line: colors.primary },
    outline: { bg: colors.paper, pressed: colors.paperDeep, fg: colors.primary, line: colors.primary },
    green: { bg: colors.calm, pressed: '#17493D', fg: colors.onPrimary, line: colors.calm },
  };
  const c = tones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: pressed ? c.pressed : c.bg, borderColor: c.line, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={24} color={c.fg} style={{ marginRight: spacing.xs }} /> : null}
      <Text style={textStyle('button', lang, c.fg)}>{label}</Text>
    </Pressable>
  );
}

function Choice({ label, selected, onPress, lang, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceOn,
        pressed && !selected && { backgroundColor: colors.paperDeep },
        style,
      ]}
    >
      <Text style={textStyle('bodyStrong', lang, selected ? colors.onPrimary : colors.ink)}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ children, lang }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={textStyle('subheading', lang, colors.ink)}>{children}</Text>
      <View style={styles.goldBar} />
    </View>
  );
}

function Notice({ tone = 'calm', icon = 'checkmark-circle', text, lang }) {
  const green = tone === 'calm';
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: green ? colors.calmSoft : colors.paperDeep, borderColor: green ? colors.calm : colors.line },
      ]}
    >
      <Ionicons name={icon} size={30} color={green ? colors.calm : colors.primary} />
      <Text style={[textStyle('bodyStrong', lang, colors.ink), { flex: 1 }]}>{text}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Home hub                                                                    */
/* -------------------------------------------------------------------------- */
function HubRow({ tone, icon, title, status, done, onPress, lang }) {
  const tones = {
    green: { bg: colors.calm, fg: colors.onPrimary, sub: colors.calmSoft, disc: 'rgba(250,243,227,0.18)' },
    gold: { bg: colors.gold, fg: colors.ink, sub: colors.ink, disc: 'rgba(42,20,23,0.12)' },
    maroon: { bg: colors.primary, fg: colors.onPrimary, sub: GOLD_LIGHT, disc: 'rgba(250,243,227,0.18)' },
  };
  const c = tones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.hubRow, { backgroundColor: c.bg, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={[styles.hubDisc, { backgroundColor: c.disc }]}>
        <Ionicons name={icon} size={30} color={c.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={textStyle('subheading', lang, c.fg)}>{title}</Text>
        <Text style={textStyle('label', lang, c.sub)}>{status}</Text>
      </View>
      {done ? (
        <Ionicons name="checkmark-circle" size={30} color={c.fg} style={{ marginRight: spacing.xs }} />
      ) : null}
      <Ionicons name="chevron-forward" size={26} color={c.fg} />
    </Pressable>
  );
}

function Hub({ data, done, t, lang, open }) {
  const count = done.filter(Boolean).length;
  const taken = data.meds.filter((m) => data.taken[m.id]).length;

  return (
    <>
      <View style={styles.hero}>
        <Text style={textStyle('heading', lang, colors.onPrimary)}>
          {count === 5 ? t('All done for today', 'आज सब पूरा हो गया') : t("Let's look after you today", 'आज अपना ध्यान रखें')}
        </Text>
        <Text style={[textStyle('bodyLarge', lang, GOLD_LIGHT), { marginTop: spacing.xs }]}>
          {t(`${count} of 5 done today`, `आज ${count}/5 पूरे`)}
        </Text>
        <View style={styles.dots}>
          {done.map((d, i) => (
            <View key={i} style={[styles.dot, d && styles.dotOn]} />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <HubRow
          tone="green"
          icon="water-outline"
          lang={lang}
          title={t('Drink water', 'पानी पीना')}
          status={t(`${data.water} of ${WATER_GOAL} glasses`, `${data.water}/${WATER_GOAL} गिलास`)}
          done={done[0]}
          onPress={() => open('water')}
        />
        <HubRow
          tone="maroon"
          icon="leaf-outline"
          lang={lang}
          title={t('Breathing', 'सांस का अभ्यास')}
          status={
            data.breathingMinutes > 0
              ? t(`${data.breathingMinutes} min today`, `आज ${data.breathingMinutes} मिनट`)
              : t('Not done yet', 'अभी नहीं किया')
          }
          done={done[1]}
          onPress={() => open('breathing')}
        />
        <HubRow
          tone="gold"
          icon="body-outline"
          lang={lang}
          title={t('Gentle exercises', 'हल्के व्यायाम')}
          status={t(`${data.stretches} of ${EXERCISES.length} done`, `${data.stretches}/${EXERCISES.length} पूरे`)}
          done={done[2]}
          onPress={() => open('stretch')}
        />
        <HubRow
          tone="green"
          icon="medkit-outline"
          lang={lang}
          title={t('Medicines', 'दवाई का समय')}
          status={
            data.meds.length === 0
              ? t('Add your medicines', 'अपनी दवाइयाँ जोड़ें')
              : t(`${taken} of ${data.meds.length} taken`, `${taken}/${data.meds.length} ली गईं`)
          }
          done={done[3]}
          onPress={() => open('medicine')}
        />
        <HubRow
          tone="maroon"
          icon="moon-outline"
          lang={lang}
          title={t('Sleep', 'नींद')}
          status={
            data.sleepHours != null
              ? t(`${data.sleepHours >= 9 ? '9+' : data.sleepHours} hours last night`, `कल रात ${data.sleepHours >= 9 ? '9+' : data.sleepHours} घंटे`)
              : t('Not logged yet', 'अभी दर्ज नहीं')
          }
          done={done[4]}
          onPress={() => open('sleep')}
        />
      </View>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Water                                                                       */
/* -------------------------------------------------------------------------- */
function WaterView({ data, update, t, lang }) {
  const w = data.water;
  const setGlass = (i) => update({ water: w === i + 1 ? i : i + 1 });

  return (
    <View>
      <View style={styles.bigCounter}>
        <Text style={textStyle('display', lang, colors.primary)}>
          {w} / {WATER_GOAL}
        </Text>
        <Text style={textStyle('bodyLarge', lang, colors.inkSoft)}>{t('glasses today', 'गिलास आज')}</Text>
      </View>

      <View style={styles.glassGrid}>
        {Array.from({ length: WATER_GOAL }).map((_, i) => {
          const filled = i < w;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={t(`Glass ${i + 1}`, `गिलास ${i + 1}`)}
              accessibilityState={{ selected: filled }}
              onPress={() => setGlass(i)}
              style={[styles.glass, filled && styles.glassOn]}
            >
              <Ionicons name={filled ? 'water' : 'water-outline'} size={34} color={filled ? colors.onPrimary : colors.calm} />
              <Text style={textStyle('label', lang, filled ? colors.onPrimary : colors.inkSoft)}>{i + 1}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Btn
          lang={lang}
          tone="green"
          icon="add"
          label={t('Add a glass', 'एक गिलास जोड़ें')}
          disabled={w >= WATER_GOAL + 4}
          onPress={() => update({ water: w + 1 })}
        />
        <Btn
          lang={lang}
          tone="outline"
          icon="remove"
          label={t('Remove a glass', 'एक गिलास घटाएँ')}
          disabled={w <= 0}
          onPress={() => update({ water: Math.max(0, w - 1) })}
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        {w >= WATER_GOAL ? (
          <Notice lang={lang} text={t('Well done! You reached today’s goal.', 'शाबाश! आज का लक्ष्य पूरा हुआ।')} />
        ) : (
          <Notice
            lang={lang}
            tone="neutral"
            icon="information-circle-outline"
            text={t(`${WATER_GOAL - w} more to reach today’s goal.`, `आज के लक्ष्य के लिए ${WATER_GOAL - w} गिलास और।`)}
          />
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Breathing                                                                   */
/* -------------------------------------------------------------------------- */
function BreathingView({ data, update, t, lang }) {
  const [mode, setMode] = useState('calm');
  const [minutes, setMinutes] = useState(1);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scale = useRef(new Animated.Value(0.6)).current;
  const reduceMotion = useRef(false);

  const phases = BREATH_MODES[mode].phases;
  const cycle = phases.reduce((s, p) => s + p.sec, 0);
  const total = minutes * 60;

  // Which phase are we in, and how many seconds are left in it
  const pos = elapsed % cycle;
  let acc = 0;
  let idx = 0;
  for (let i = 0; i < phases.length; i += 1) {
    if (pos < acc + phases[i].sec) {
      idx = i;
      break;
    }
    acc += phases[i].sec;
  }
  const phase = phases[idx];
  const secLeft = acc + phase.sec - pos;
  const remaining = Math.max(0, total - elapsed);
  const mm = String(Math.floor(remaining / 60)).padStart(1, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceMotion.current = !!v;
      })
      .catch(() => {});
  }, []);

  // One tick per second while running
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Finish when the chosen time is up
  useEffect(() => {
    if (running && elapsed >= total) {
      setRunning(false);
      setFinished(true);
      update({ breathingMinutes: data.breathingMinutes + minutes });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, running]);

  // Animate the circle and nudge the phone at each new phase
  useEffect(() => {
    if (!running) return;
    Vibration.vibrate(25);
    if (reduceMotion.current) return;
    if (phase.type === 'in') {
      Animated.timing(scale, { toValue: 1, duration: phase.sec * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    } else if (phase.type === 'out') {
      Animated.timing(scale, { toValue: 0.6, duration: phase.sec * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, running, mode]);

  const start = () => {
    setElapsed(0);
    setFinished(false);
    scale.setValue(0.6);
    setRunning(true);
  };
  const stop = () => {
    setRunning(false);
    setElapsed(0);
    scale.stopAnimation();
    scale.setValue(0.6);
  };

  if (finished) {
    return (
      <View style={{ gap: spacing.lg }}>
        <View style={styles.bigCounter}>
          <Ionicons name="checkmark-circle" size={88} color={colors.calm} />
          <Text style={textStyle('heading', lang, colors.ink)}>{t('Well done', 'बहुत अच्छे')}</Text>
          <Text style={[textStyle('bodyLarge', lang, colors.inkSoft), { textAlign: 'center' }]}>
            {t(`You breathed calmly for ${minutes} minute${minutes > 1 ? 's' : ''}.`, `आपने ${minutes} मिनट शांत सांस ली।`)}
          </Text>
        </View>
        <Btn lang={lang} tone="green" icon="refresh" label={t('Do it again', 'फिर से करें')} onPress={() => setFinished(false)} />
      </View>
    );
  }

  if (running) {
    return (
      <View style={{ alignItems: 'center', gap: spacing.lg }}>
        <Text style={textStyle('bodyLarge', lang, colors.inkSoft)}>
          {t('Time left', 'बचा समय')} {mm}:{ss}
        </Text>
        <View style={styles.circleWrap}>
          <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
          <View style={styles.circleCenter}>
            <Text style={textStyle('display', lang, colors.calm)}>{secLeft}</Text>
          </View>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[textStyle('heading', lang, colors.ink), { textAlign: 'center', minHeight: 100 }]}
        >
          {t(phase.en, phase.hi)}
        </Text>
        <Btn lang={lang} tone="outline" icon="stop" label={t('Stop', 'रोकें')} onPress={stop} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <View>
      <SectionTitle lang={lang}>{t('Choose a style', 'अभ्यास चुनें')}</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {Object.keys(BREATH_MODES).map((k) => {
          const m = BREATH_MODES[k];
          const on = mode === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setMode(k)}
              style={[styles.modeCard, on && styles.modeCardOn]}
            >
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={28} color={on ? colors.onPrimary : colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={textStyle('subheading', lang, on ? colors.onPrimary : colors.ink)}>{t(m.en, m.hi)}</Text>
                <Text style={textStyle('label', lang, on ? GOLD_LIGHT : colors.inkSoft)}>{t(m.descEn, m.descHi)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionTitle lang={lang}>{t('How long?', 'कितनी देर?')}</SectionTitle>
        <View style={styles.choiceRow}>
          {[1, 3, 5].map((m) => (
            <Choice
              key={m}
              lang={lang}
              selected={minutes === m}
              onPress={() => setMinutes(m)}
              label={t(`${m} min`, `${m} मिनट`)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Btn lang={lang} tone="green" icon="play" label={t('Start', 'शुरू करें')} onPress={start} />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Gentle exercises                                                            */
/* -------------------------------------------------------------------------- */
function StretchView({ data, update, t, lang }) {
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(EXERCISE_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const ex = EXERCISES[idx];

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id);
          setRunning(false);
          Vibration.vibrate(60);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, idx]);

  const next = () => {
    update({ stretches: Math.max(data.stretches, idx + 1) });
    setRunning(false);
    if (idx + 1 >= EXERCISES.length) {
      setFinished(true);
    } else {
      setIdx(idx + 1);
      setLeft(EXERCISE_SECONDS);
    }
  };

  const restart = () => {
    setIdx(0);
    setLeft(EXERCISE_SECONDS);
    setRunning(false);
    setFinished(false);
  };

  if (finished) {
    return (
      <View style={{ gap: spacing.lg }}>
        <View style={styles.bigCounter}>
          <Ionicons name="checkmark-circle" size={88} color={colors.calm} />
          <Text style={textStyle('heading', lang, colors.ink)}>{t('All exercises done', 'सभी व्यायाम पूरे')}</Text>
          <Text style={[textStyle('bodyLarge', lang, colors.inkSoft), { textAlign: 'center' }]}>
            {t('Take a sip of water and rest for a moment.', 'थोड़ा पानी पिएँ और कुछ देर आराम करें।')}
          </Text>
        </View>
        <Btn lang={lang} tone="green" icon="refresh" label={t('Start again', 'फिर से शुरू करें')} onPress={restart} />
      </View>
    );
  }

  const steps = lang === 'hi' ? ex.stepsHi : ex.stepsEn;
  const timeUp = left === 0;

  return (
    <View>
      <View style={styles.stepper}>
        {EXERCISES.map((_, i) => (
          <View key={i} style={[styles.stepperDot, i < idx && styles.stepperDone, i === idx && styles.stepperNow]} />
        ))}
      </View>
      <Text style={[textStyle('label', lang, colors.inkSoft), { marginBottom: spacing.sm }]}>
        {t(`Exercise ${idx + 1} of ${EXERCISES.length}`, `व्यायाम ${idx + 1}/${EXERCISES.length}`)}
      </Text>

      <View style={styles.exCard}>
        <View style={styles.exIcon}>
          <Ionicons name={ex.icon} size={40} color={colors.primary} />
        </View>
        <Text style={textStyle('heading', lang, colors.ink)}>{t(ex.en, ex.hi)}</Text>
        <View style={styles.goldBar} />
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepLine}>
              <View style={styles.stepNum}>
                <Text style={textStyle('label', lang, colors.onPrimary)}>{i + 1}</Text>
              </View>
              <Text style={[textStyle('bodyLarge', lang, colors.ink), { flex: 1 }]}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.timerBox}>
        <Text style={textStyle('display', lang, timeUp ? colors.calm : colors.primary)}>
          {timeUp ? t('Done', 'हो गया') : `0:${String(left).padStart(2, '0')}`}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {!timeUp ? (
          <Btn
            lang={lang}
            tone="green"
            icon={running ? 'pause' : 'play'}
            label={running ? t('Pause', 'रुकें') : left === EXERCISE_SECONDS ? t('Start', 'शुरू करें') : t('Resume', 'जारी रखें')}
            onPress={() => setRunning((r) => !r)}
          />
        ) : null}
        <Btn
          lang={lang}
          tone={timeUp ? 'green' : 'outline'}
          icon="arrow-forward"
          label={idx + 1 >= EXERCISES.length ? t('Finish', 'पूरा करें') : t('Next exercise', 'अगला व्यायाम')}
          onPress={next}
        />
      </View>

      <Text style={[textStyle('label', lang, colors.dangerText), { marginTop: spacing.md, textAlign: 'center' }]}>
        {t('Stop if you feel pain or dizziness.', 'दर्द या चक्कर हो तो रुक जाएँ।')}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Medicines                                                                   */
/* -------------------------------------------------------------------------- */
function MedicineView({ data, update, t, lang }) {
  const [name, setName] = useState('');
  const [slot, setSlot] = useState('morning');
  const [focus, setFocus] = useState(false);

  const add = () => {
    const clean = name.trim();
    if (!clean) return;
    update({ meds: [...data.meds, { id: String(Date.now()), name: clean, slot }] });
    setName('');
  };

  const toggle = (id) => {
    const taken = { ...data.taken };
    if (taken[id]) delete taken[id];
    else taken[id] = true;
    update({ taken });
  };

  const remove = (m) => {
    Alert.alert(
      t('Remove this medicine?', 'यह दवाई हटाएँ?'),
      m.name,
      [
        { text: t('No, keep it', 'नहीं, रहने दें'), style: 'cancel' },
        {
          text: t('Yes, remove', 'हाँ, हटाएँ'),
          style: 'destructive',
          onPress: () => {
            const taken = { ...data.taken };
            delete taken[m.id];
            update({ meds: data.meds.filter((x) => x.id !== m.id), taken });
          },
        },
      ],
    );
  };

  return (
    <View>
      {data.meds.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="medkit-outline" size={48} color={colors.primary} />
          <Text style={[textStyle('bodyLarge', lang, colors.ink), { textAlign: 'center' }]}>
            {t('No medicines yet. Add the first one below.', 'अभी कोई दवाई नहीं है। नीचे पहली दवाई जोड़ें।')}
          </Text>
        </View>
      ) : (
        SLOTS.map((s) => {
          const list = data.meds.filter((m) => m.slot === s.id);
          if (list.length === 0) return null;
          return (
            <View key={s.id} style={{ marginBottom: spacing.lg }}>
              <SectionTitle lang={lang}>{t(s.en, s.hi)}</SectionTitle>
              <View style={{ gap: spacing.sm }}>
                {list.map((m) => {
                  const on = !!data.taken[m.id];
                  return (
                    <View key={m.id} style={[styles.medRow, on && styles.medRowOn]}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={m.name}
                        onPress={() => toggle(m.id)}
                        style={styles.medMain}
                      >
                        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={44} color={on ? colors.calm : colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={textStyle('bodyLarge', lang, colors.ink)}>{m.name}</Text>
                          <Text style={textStyle('label', lang, on ? colors.calm : colors.inkSoft)}>
                            {on ? t('Taken', 'ली गई') : t('Not taken yet', 'अभी बाकी')}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => remove(m)} style={styles.medRemove}>
                        <Text style={textStyle('label', lang, colors.dangerText)}>{t('Remove', 'हटाएँ')}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })
      )}

      <View style={styles.addBox}>
        <SectionTitle lang={lang}>{t('Add a medicine', 'दवाई जोड़ें')}</SectionTitle>
        <Text style={[textStyle('label', lang, colors.ink), { marginBottom: spacing.xs }]}>{t('Medicine name', 'दवाई का नाम')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={t('For example: BP tablet', 'जैसे: बीपी की गोली')}
          placeholderTextColor={colors.inkSoft}
          style={[styles.input, textStyle('bodyLarge', lang, colors.ink), focus && { borderColor: colors.primary }]}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <Text style={[textStyle('label', lang, colors.ink), { marginTop: spacing.md, marginBottom: spacing.xs }]}>
          {t('When do you take it?', 'कब लेनी है?')}
        </Text>
        <View style={styles.choiceRow}>
          {SLOTS.map((s) => (
            <Choice key={s.id} lang={lang} selected={slot === s.id} onPress={() => setSlot(s.id)} label={t(s.en, s.hi)} style={{ flex: 1 }} />
          ))}
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Btn lang={lang} tone="primary" icon="add" label={t('Add medicine', 'दवाई जोड़ें')} onPress={add} disabled={!name.trim()} />
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sleep                                                                       */
/* -------------------------------------------------------------------------- */
function SleepView({ data, update, t, lang }) {
  const label = (h) => (h >= 9 ? '9+' : h <= 4 ? t('Under 5', '5 से कम') : String(h));
  return (
    <View>
      <SectionTitle lang={lang}>{t('How many hours did you sleep last night?', 'कल रात कितने घंटे नींद आई?')}</SectionTitle>
      <View style={styles.sleepGrid}>
        {SLEEP_OPTIONS.map((h) => (
          <Choice
            key={h}
            lang={lang}
            selected={data.sleepHours === h}
            onPress={() => update({ sleepHours: h })}
            label={label(h)}
            style={{ width: '31%', minHeight: 72 }}
          />
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionTitle lang={lang}>{t('How was your sleep?', 'नींद कैसी रही?')}</SectionTitle>
        <View style={styles.choiceRow}>
          {SLEEP_QUALITY.map((q) => (
            <Choice
              key={q.id}
              lang={lang}
              selected={data.sleepQuality === q.id}
              onPress={() => update({ sleepQuality: q.id })}
              label={t(q.en, q.hi)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>

      {data.sleepHours != null ? (
        <View style={{ marginTop: spacing.lg }}>
          <Notice
            lang={lang}
            text={t(
              `Saved: ${label(data.sleepHours)} hours${data.sleepQuality ? `, ${SLEEP_QUALITY.find((q) => q.id === data.sleepQuality).en.toLowerCase()}` : ''}.`,
              `दर्ज हुआ: ${label(data.sleepHours)} घंटे${data.sleepQuality ? `, ${SLEEP_QUALITY.find((q) => q.id === data.sleepQuality).hi}` : ''}।`,
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                      */
/* -------------------------------------------------------------------------- */
export default function WellnessScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const lang = language === 'hi' ? 'hi' : 'en';
  const t = (en, hi) => (lang === 'hi' ? hi : en);

  const [view, setView] = useState('home');
  const [data, setData] = useState(() => {
    if (store.date !== todayKey()) store = freshDay(store.meds);
    return store;
  });

  // Replace this with a Firestore write later; screens only call update(patch)
  const update = (patch) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      store = next;
      return next;
    });
  };

  const goBack = () => {
    if (view === 'home') router.back();
    else setView('home');
  };

  // Android hardware back returns to the hub first
  useEffect(() => {
    if (view === 'home') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setView('home');
      return true;
    });
    return () => sub.remove();
  }, [view]);

  const done = [
    data.water >= WATER_GOAL,
    data.breathingMinutes >= 1,
    data.stretches >= STRETCH_GOAL,
    data.meds.length > 0 && data.meds.every((m) => data.taken[m.id]),
    data.sleepHours != null,
  ];

  const titles = {
    home: t("Today's Wellness", 'आज की सेहत'),
    water: t('Drink water', 'पानी पीना'),
    breathing: t('Breathing', 'सांस का अभ्यास'),
    stretch: t('Gentle exercises', 'हल्के व्यायाम'),
    medicine: t('Medicines', 'दवाई का समय'),
    sleep: t('Sleep', 'नींद'),
  };

  const common = { data, update, t, lang };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={titles[view]} showBack onBack={goBack} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {view === 'home' && <Hub data={data} done={done} t={t} lang={lang} open={setView} />}
        {view === 'water' && <WaterView {...common} />}
        {view === 'breathing' && <BreathingView {...common} />}
        {view === 'stretch' && <StretchView {...common} />}
        {view === 'medicine' && <MedicineView {...common} />}
        {view === 'sleep' && <SleepView {...common} />}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: spacing.screenX, paddingBottom: spacing.xxl * 2 },

  // hero
  hero: { backgroundColor: colors.primary, borderRadius: radius.card, padding: spacing.lg },
  dots: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: GOLD_LIGHT },
  dotOn: { backgroundColor: colors.gold, borderColor: colors.gold },

  // hub rows
  hubRow: {
    minHeight: 84,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hubDisc: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },

  // shared
  goldBar: { height: 4, width: 36, borderRadius: 2, backgroundColor: colors.gold, marginTop: spacing.xs },
  btn: {
    minHeight: sizes.button,
    borderRadius: radius.button,
    borderWidth: border.width,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  choice: {
    minHeight: sizes.touchMin,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.primary,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: colors.primary },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: border.width,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  bigCounter: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  emptyBox: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  // water
  glassGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  glass: {
    width: '23%',
    minHeight: 88,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.calm,
    backgroundColor: colors.calmSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassOn: { backgroundColor: colors.calm },

  // breathing
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 84,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    backgroundColor: colors.paperDeep,
  },
  modeCardOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  circleWrap: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.calmSoft,
    borderWidth: 4,
    borderColor: colors.calm,
  },
  circleCenter: { alignItems: 'center', justifyContent: 'center' },

  // exercises
  stepper: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  stepperDot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.line },
  stepperDone: { backgroundColor: colors.calm },
  stepperNow: { backgroundColor: colors.primary },
  exCard: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  exIcon: {
    width: 72,
    height: 88,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  stepLine: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timerBox: { alignItems: 'center', marginVertical: spacing.lg },

  // medicines
  medRow: {
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
  },
  medRowOn: { borderColor: colors.calm, backgroundColor: colors.calmSoft },
  medMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 76, padding: spacing.md },
  medRemove: {
    minHeight: sizes.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: border.width,
    borderTopColor: colors.line,
  },
  addBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  input: {
    minHeight: sizes.input,
    borderRadius: radius.input,
    borderWidth: border.width,
    borderColor: colors.line,
    backgroundColor: colors.paperDeep,
    paddingHorizontal: spacing.md,
  },

  // sleep
  sleepGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
});