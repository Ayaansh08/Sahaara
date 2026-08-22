
const CONSONANTS = [
  ['ksh', 'क्ष'],
  ['kh', 'ख'], ['gh', 'घ'],
  ['chh', 'छ'], ['ch', 'च'], ['jh', 'झ'],
  ['th', 'थ'], ['dh', 'ध'],
  ['ph', 'फ'], ['bh', 'भ'],
  ['sh', 'श'],
  ['ng', 'ङ'], ['ny', 'ञ'],
  ['k', 'क'], ['g', 'ग'],
  ['c', 'क'], ['j', 'ज'],
  ['t', 'त'], ['d', 'द'], ['n', 'न'],
  ['p', 'प'], ['b', 'ब'], ['m', 'म'],
  ['y', 'य'], ['r', 'र'], ['l', 'ल'],
  ['v', 'व'], ['w', 'व'],
  ['s', 'स'], ['h', 'ह'],
  ['f', 'फ'], ['z', 'ज'],
];

// [latin, standalone-vowel, matra]  —  matra='' means inherent /a/ (no mark)
const VOWELS = [
  ['aa', 'आ', 'ा'], ['ee', 'ई', 'ी'], ['oo', 'ऊ', 'ू'],
  ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'], ['oa', 'ओ', 'ो'],
  ['a', 'अ', ''], ['i', 'इ', 'ि'], ['u', 'उ', 'ु'],
  ['e', 'ए', 'े'], ['o', 'ओ', 'ो'],
];

const HALANT = '्';

function matchCons(s, i) {
  for (const [lat, dev] of CONSONANTS) {
    if (s.startsWith(lat, i)) return [lat, dev];
  }
  return null;
}

function matchVowel(s, i) {
  for (const v of VOWELS) {
    if (s.startsWith(v[0], i)) return v;
  }
  return null;
}

function transliterateWord(word) {
  const w = word.toLowerCase(); // normalise case — names use standard English caps
  let out = '';
  let i = 0;
  let pendingCons = null; // consonant waiting to see what follows

  while (i <= w.length) {
    const cons = i < w.length ? matchCons(w, i) : null;
    const vowel = i < w.length ? matchVowel(w, i) : null;

    if (cons) {
      // Previous consonant has no following vowel → halant (virama)
      if (pendingCons) out += pendingCons[1] + HALANT;
      pendingCons = cons;
      i += cons[0].length;

    } else if (vowel) {
      if (pendingCons) {
        // Consonant + vowel
        out += pendingCons[1];
        const isLastChar = (i + vowel[0].length) >= w.length;
        if (vowel[2] !== '') {
          out += vowel[2]; // explicit matra
        } else if (isLastChar) {
          // 'a' at end of word → add ā matra (Priya→प्रिया, Sunita→सुनिता)
          out += 'ा';
        }
        // else: inherent /a/ in middle of word → no mark needed
        pendingCons = null;
      } else {
        // Standalone vowel (word-initial or after another vowel)
        out += vowel[1];
      }
      i += vowel[0].length;

    } else {
      // End of string or unknown character — flush pending consonant
      if (pendingCons) {
        out += pendingCons[1];
        // If word ends with a bare consonant that had an original trailing 'a',
        // add ā matra (common in Indian names: Priya→प्रिया, Sunita→सुनिता)
        // We detect this by checking if the source word actually ends in 'a'
        if (i >= w.length && w.endsWith('a')) out += 'ा';
        pendingCons = null;
      }
      if (i < w.length) out += word[i]; // pass unknown chars through unchanged
      i++;
    }
  }

  return out;
}

/**
 * Transliterates an English-script Indian name to Devanagari.
 * If the string already contains Devanagari, it is returned as-is.
 *
 * @param {string} name - e.g. "Tanmay Sharma"
 * @returns {string}    - e.g. "तन्मय शर्मा"
 */
export function transliterateToHindi(name) {
  if (!name) return name;
  if (/[\u0900-\u097F]/.test(name)) return name; // already Devanagari
  return name.split(' ').map(transliterateWord).join(' ');
}
