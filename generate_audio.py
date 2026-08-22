import math
import struct
import wave
import os

def generate_wav(path, tone_type, duration=5.0):
    sample_rate = 22050
    num_samples = int(duration * sample_rate)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    with wave.open(path, 'w') as f:
        f.setparams((1, 2, sample_rate, num_samples, 'NONE', 'not compressed'))
        
        frames = []
        for i in range(num_samples):
            t = i / sample_rate
            val = 0.0
            
            if tone_type == 'devotion':
                # Meditative sound: A low drone (110 Hz and 165 Hz) + slow high chime (440 Hz modulated)
                drone = 0.5 * math.sin(2 * math.pi * 110 * t) + 0.3 * math.sin(2 * math.pi * 165 * t)
                chime_envelope = math.exp(-2.0 * (t % 2.5))
                chime = 0.2 * math.sin(2 * math.pi * 440 * t) * chime_envelope
                val = drone + chime
            elif tone_type == 'memories':
                # Nostalgic Music Box arpeggio: E4 (329.63 Hz), G4 (392.00 Hz), B4 (493.88 Hz), E5 (659.25 Hz)
                notes = [329.63, 392.00, 493.88, 659.25]
                note_idx = int(t / 0.6) % len(notes)
                freq = notes[note_idx]
                env = math.exp(-4.0 * (t % 0.6))
                val = 0.5 * math.sin(2 * math.pi * freq * t) * env
            elif tone_type == 'family':
                # Friendly chime: Dual-tone chime (660 Hz and 880 Hz) pulsing
                env = math.exp(-3.0 * (t % 1.2))
                val = 0.4 * (math.sin(2 * math.pi * 660 * t) + math.sin(2 * math.pi * 880 * t)) * env
            elif tone_type == 'events':
                # Ding Dong chime: ding (587.33 Hz) and dong (440 Hz)
                is_ding = (t % 2.5) < 1.05
                freq = 587.33 if is_ding else 440.0
                env = math.exp(-3.0 * (t % 1.25))
                val = 0.5 * math.sin(2 * math.pi * freq * t) * env
            elif tone_type == 'saathi':
                # Ambient sweet notification sweep: frequency sliding from 330 Hz to 660 Hz
                phase = t % 3.0
                if phase < 1.5:
                    freq = 330.0 + 330.0 * (phase / 1.5)
                    env = 0.4 * math.sin(math.pi * (phase / 1.5))
                    val = math.sin(2 * math.pi * freq * t) * env
                else:
                    val = 0.0
            
            # Clip value to -1.0 to 1.0
            val = max(-1.0, min(1.0, val))
            # Convert to 16-bit signed integer
            packed = struct.pack('<h', int(val * 32767))
            frames.append(packed)
            
        f.writeframes(b''.join(frames))
    print(f"Generated: {path}")

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'public', 'audio'))
    
    # Devotion Tracks
    devotion_dir = os.path.join(base_dir, 'devotion')
    devotion_tracks = [
        'hanuman_chalisa.wav',
        'gayatri_mantra.wav',
        'shiv_bhajan.wav',
        'krishna_bhajan.wav',
        'ram_bhajan.wav',
        'ganesh_aarti.wav',
        'morning_prayers.wav',
        'evening_prayers.wav',
        'festival_bhajans.wav'
    ]
    for track in devotion_tracks:
        generate_wav(os.path.join(devotion_dir, track), 'devotion', duration=6.0)

    # Memories Tracks
    memories_dir = os.path.join(base_dir, 'memories')
    memory_tracks = [
        'anniversary_1981.wav',
        'shimla_trip_1995.wav',
        'graduation_2018.wav',
        'holi_2005.wav',
        'bhu_college_1968.wav',
        'granddaughter_first_step_1999.wav'
    ]
    for track in memory_tracks:
        generate_wav(os.path.join(memories_dir, track), 'memories', duration=5.0)

    # Family Tracks
    family_dir = os.path.join(base_dir, 'family')
    family_tracks = [
        'ananya_granddaughter.wav',
        'rohan_son.wav',
        'sushila_spouse.wav',
        'daughter_in_law.wav',
        'caregiver.wav',
        'jagdish_sharma.wav',
        'nirmala_verma.wav'
    ]
    for track in family_tracks:
        generate_wav(os.path.join(family_dir, track), 'family', duration=4.0)

    # Events Tracks
    events_dir = os.path.join(base_dir, 'events')
    event_tracks = [
        'morning_walk_intro.wav',
        'bhajan_mandali_prayer.wav',
        'storytelling_intro.wav',
        'health_talk_intro.wav',
        'monsoon_feast_intro.wav'
    ]
    for track in event_tracks:
        generate_wav(os.path.join(events_dir, track), 'events', duration=5.0)

    # Saathi Tracks
    saathi_dir = os.path.join(base_dir, 'saathi')
    saathi_tracks = [
        'saathi_lunch.wav',
        'saathi_happy.wav',
        'saathi_lonely.wav',
        'saathi_worried.wav',
        'saathi_story.wav',
        'saathi_bhajan.wav',
        'saathi_family.wav',
        'saathi_shimla.wav',
        'saathi_graduation.wav',
        'saathi_anniversary.wav',
        'saathi_day.wav',
        'saathi_helpless.wav',
        'saathi_default.wav'
    ]
    for track in saathi_tracks:
        generate_wav(os.path.join(saathi_dir, track), 'saathi', duration=5.0)

    print("All audio chimes generated successfully!")

if __name__ == '__main__':
    main()
