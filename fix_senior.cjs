const fs = require('fs');
const content = fs.readFileSync('src/pages/SeniorHome.tsx', 'utf8');
const lines = content.split('\n');

// Keep everything up to and including line 238 (index 237)
const logicLines = lines.slice(0, 238);

const returnJSX = `
  return (
    <div className={\`senior-home-page text-scale-\${textSize} contrast-\${contrast} \${motion === 'reduced' ? 'motion-reduced' : ''}\`}>

      {/* ACCESSIBILITY BAR */}
      <div className="glass-card" style={{ padding: '0.9rem 1.5rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderBottom: '3px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-dark)', fontWeight: 700, fontSize: '0.9rem' }}>
          <Settings size={16} />
          <span>{lang === 'en' ? 'Accessibility' : 'सुविधा सेटिंग्स'}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Language</span>
            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
              <button onClick={() => setLang('en')} style={{ padding: '0.3rem 0.7rem', border: 'none', backgroundColor: lang === 'en' ? 'var(--color-primary)' : 'var(--bg-secondary)', color: lang === 'en' ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>EN</button>
              <button onClick={() => setLang('hi')} style={{ padding: '0.3rem 0.7rem', border: 'none', backgroundColor: lang === 'hi' ? 'var(--color-primary)' : 'var(--bg-secondary)', color: lang === 'hi' ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>हिं</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Text</span>
            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
              {(['normal','large','xlarge'] as const).map((s, i) => (
                <button key={s} onClick={() => setTextSize(s)} style={{ padding: '0.3rem 0.6rem', border: 'none', borderLeft: i > 0 ? '1px solid var(--border-color)' : 'none', backgroundColor: textSize === s ? 'var(--color-primary)' : 'var(--bg-secondary)', color: textSize === s ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: [600,700,900][i], fontSize: ['0.75rem','0.8rem','0.9rem'][i] }}>A</button>
              ))}
            </div>
          </div>
          <button onClick={() => setContrast(prev => prev === 'standard' ? 'high' : 'standard')} style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: contrast === 'high' ? 'var(--text-primary)' : 'var(--bg-secondary)', color: contrast === 'high' ? 'var(--bg-primary)' : 'var(--text-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
            {contrast === 'high' ? 'High Contrast' : 'Standard'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

        {/* MAIN COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* HERO */}
          <section style={{ position: 'relative', overflow: 'hidden', minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '2rem', borderRadius: 'var(--radius-lg)', backgroundImage: \`linear-gradient(to right, rgba(0,0,0,0.88) 40%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.1) 100%), url(\${seniorHomeHeroImg})\`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              <Activity size={14} style={{ color: 'var(--color-primary-light)' }} />
              <span>Lucknow, 32°C</span>
            </div>
            <span style={{ color: 'var(--color-primary-light)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '2px', display: 'block', marginBottom: '0.4rem' }}>{lang === 'en' ? 'Senior Wellness Portal' : 'वृद्ध कल्याण केंद्र'}</span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: '#fff', lineHeight: 1.2 }}>
              {lang === 'en' ? \`\${getGreeting()}, \${seniorName.split(' ')[0]} Ji.\` : \`\${getGreeting()}, \${seniorName.split(' ')[0]} जी।\`}
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
              {lang === 'en' ? 'Your family is only one conversation away.' : 'आपका परिवार आपसे बस एक बातचीत की दूरी पर है।'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', fontSize: '0.85rem', marginTop: '1rem', opacity: 0.85 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Shield size={13} />{location}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} />
                {lang === 'en' ? 'Connected to Care Circle' : 'केयर सर्कल से जुड़े हैं'}
              </span>
            </div>
          </section>

          {/* DAILY QUOTE + FAMILY MESSAGE */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--color-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Bookmark size={12} />Daily Inspiration</span>
              <p style={{ fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{quote}</p>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--color-accent)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Send size={12} />{lang === 'en' ? 'Latest Family Message' : 'नवीनतम पारिवारिक संदेश'}</span>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {lang === 'en' ? '"Dadu! Hope you had your calcium pill. Call me tonight!" — Ananya' : '"दादू! आशा है आपने अपनी कैल्शियम की गोली ले ली। आज रात मुझे कॉल करना!" — अनन्या'}
              </p>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{lang === 'en' ? 'Quick Actions' : 'त्वरित विकल्प'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {[
                { icon: <Mic size={22} />, label: lang === 'en' ? 'Talk to SAATHI' : 'साथी से बात करें', sub: lang === 'en' ? 'AI voice companion' : 'आवाज में बात करें', color: 'var(--color-primary)', bg: 'var(--color-primary-light)', action: () => navigate('/senior/saathi') },
                { icon: <Phone size={22} />, label: lang === 'en' ? 'Call Family' : 'परिवार को कॉल करें', sub: lang === 'en' ? 'Connect with Rohan' : 'रोहन से जुड़ें', color: 'var(--color-secondary-dark)', bg: 'var(--color-secondary-light)', action: () => startMockCall('Rohan', 'audio') },
                { icon: <ImageIcon size={22} />, label: lang === 'en' ? 'Memories' : 'यादें देखें', sub: lang === 'en' ? 'Photo album' : 'फोटो एल्बम', color: 'var(--color-accent-dark)', bg: 'var(--color-accent-light)', action: () => navigate('/senior/nostalgia') },
                { icon: <Volume2 size={22} />, label: lang === 'en' ? 'Spiritual Corner' : 'आध्यात्मिक कोना', sub: lang === 'en' ? 'Bhajan & prayers' : 'भजन एवं प्रार्थना', color: 'var(--color-primary)', bg: 'var(--color-primary-light)', action: () => navigate('/senior/devotion') },
                { icon: <Users size={22} />, label: lang === 'en' ? 'Elder Circle' : 'वृद्ध मंडली', sub: lang === 'en' ? 'Senior community' : 'वरिष्ठ समुदाय', color: 'var(--color-secondary-dark)', bg: 'var(--color-secondary-light)', action: () => document.getElementById('elder-circle')?.scrollIntoView({ behavior: 'smooth' }) },
                { icon: <Shield size={22} />, label: lang === 'en' ? 'Legacy Vault' : 'विरासत तिजोरी', sub: lang === 'en' ? 'Life stories' : 'जीवन कहानियाँ', color: 'var(--color-accent-dark)', bg: 'var(--color-accent-light)', action: () => navigate('/senior/legacy') },
              ].map((item, i) => (
                <button key={i} onClick={item.action} className="glass-card hover-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', textAlign: 'left', border: 'none', borderLeft: \`3px solid \${item.color}\`, transition: 'var(--transition-smooth)' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.label}</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.sub}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* SOS Button - full width, prominent */}
            <button onClick={() => setShowSosConfirm(true)} style={{ width: '100%', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', cursor: 'pointer', border: '2px solid var(--color-danger)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', fontWeight: 800, fontSize: '1rem', transition: 'var(--transition-smooth)' }}>
              <AlertTriangle size={20} className="animate-pulse-soft" />
              {lang === 'en' ? 'Emergency SOS — Alert Family & Emergency Services' : 'आपातकालीन सहायता — परिवार को तुरंत सूचित करें'}
            </button>
          </section>

          {/* SAATHI AI CARD */}
          <section className="glass-card" style={{ padding: '1.75rem', display: 'flex', alignItems: 'center', gap: '2rem', border: '2px solid var(--color-primary)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
              <div className="animate-pulse-soft" style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'radial-gradient(circle, var(--color-primary) 0%, var(--color-primary-dark) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 0 32px rgba(13,148,136,0.4)' }}>
                <Sparkles size={38} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{lang === 'en' ? 'Active' : 'सक्रिय'}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '240px', textAlign: 'left' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>SAATHI — {lang === 'en' ? 'Your AI Companion' : 'आपका एआई साथी'}</h3>
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.9rem 1.1rem', borderRadius: '0 12px 12px 12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {lang === 'en' ? \`Good afternoon, \${seniorName.split(' ')[0]} Ji. How are you feeling today?\` : \`नमस्कार, \${seniorName.split(' ')[0]} जी। आज आपका मन कैसा है?\`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => navigate('/senior/saathi')} style={{ backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <Mic size={16} /> {lang === 'en' ? 'Talk Now' : 'बात करें'}
                </button>
                <button onClick={() => navigate('/senior/saathi')} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <Video size={16} /> {lang === 'en' ? 'Video Chat' : 'वीडियो चैट'}
                </button>
              </div>
            </div>
          </section>

          {/* WELLNESS SNAPSHOT */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{lang === 'en' ? 'Today\'s Wellness' : 'आज का स्वास्थ्य'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              {[
                { icon: <Heart size={18} />, label: lang === 'en' ? 'Heart Rate' : 'हृदय गति', value: '72 bpm', color: 'var(--color-danger)', status: lang === 'en' ? 'Normal' : 'सामान्य' },
                { icon: <Moon size={18} />, label: lang === 'en' ? 'Sleep' : 'नींद', value: '7.5h', color: 'var(--color-secondary)', status: lang === 'en' ? 'Good' : 'अच्छी' },
                { icon: <Activity size={18} />, label: lang === 'en' ? 'Steps' : 'कदम', value: '3,840', color: 'var(--color-primary)', status: lang === 'en' ? '76% goal' : '76% लक्ष्य' },
                { icon: <Droplet size={18} />, label: lang === 'en' ? 'Water' : 'पानी', value: \`\${waterGlasses}/8\`, color: 'var(--color-accent-dark)', status: lang === 'en' ? 'On track' : 'सही राह' },
              ].map((w, i) => (
                <div key={i} className="glass-card" style={{ padding: '1rem', textAlign: 'left', borderTop: \`3px solid \${w.color}\` }}>
                  <div style={{ color: w.color, marginBottom: '0.5rem' }}>{w.icon}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{w.value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{w.label}</div>
                  <div style={{ fontSize: '0.72rem', color: w.color, fontWeight: 700, marginTop: '0.2rem' }}>{w.status}</div>
                </div>
              ))}
            </div>
          </section>

          {/* MOOD CHECK-IN */}
          <section className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{lang === 'en' ? 'How are you feeling today?' : 'आज आप कैसा महसूस कर रहे हैं?'}</h3>
              {currentMood && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-success)', backgroundColor: 'var(--color-success-light)', padding: '0.2rem 0.7rem', borderRadius: '20px' }}>{lang === 'en' ? 'Shared with family' : 'परिवार से साझा किया'}</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { label: lang === 'en' ? 'Happy' : 'खुश', icon: <Heart size={18} />, color: 'var(--color-success)' },
                { label: lang === 'en' ? 'Calm' : 'शांत', icon: <Moon size={18} />, color: 'var(--color-primary)' },
                { label: lang === 'en' ? 'Sad' : 'उदास', icon: <AlertCircle size={18} />, color: 'var(--color-secondary-dark)' },
                { label: lang === 'en' ? 'Anxious' : 'बेचैन', icon: <Activity size={18} />, color: 'var(--color-danger)' },
                { label: lang === 'en' ? 'Grateful' : 'आभारी', icon: <Sparkles size={18} />, color: 'var(--color-accent-dark)' },
              ].map((m, i) => (
                <button key={i} onClick={() => handleMoodSelect(m.label, '')} style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: \`2px solid \${currentMood === m.label ? m.color : 'var(--border-color)'}\`, backgroundColor: currentMood === m.label ? m.color : 'var(--bg-secondary)', color: currentMood === m.label ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'var(--transition-smooth)' }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            {moodSummary && currentMood && (
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '0.7rem 1rem', borderRadius: '6px', borderLeft: '3px solid var(--color-primary)' }}>{moodSummary}</p>
            )}
          </section>

          {/* FAMILY CIRCLE */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{lang === 'en' ? 'Family Circle' : 'पारिवारिक मंडली'}</h2>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {familyMembers.map((member, i) => (
                <div key={i} className="glass-card hover-card" style={{ flex: '1 1 160px', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', textAlign: 'center', cursor: 'pointer' }} onClick={() => startMockCall(member.name, 'audio')}>
                  <div style={{ position: 'relative' }}>
                    <img src={member.avatar} alt={member.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }} />
                    <span style={{ position: 'absolute', bottom: '2px', right: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: member.status === 'online' ? 'var(--color-success)' : member.status === 'active' ? 'var(--color-secondary)' : 'var(--color-danger)', border: '2px solid var(--bg-secondary)', display: 'block' }} />
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>{member.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.relation}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.15rem' }}>{member.lastContact}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={e => { e.stopPropagation(); startMockCall(member.name, 'audio'); }} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}><Phone size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); startMockCall(member.name, 'video'); }} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}><Video size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '1.5rem' }}>

          {/* MEDICATION */}
          <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CalendarDays size={14} /> {lang === 'en' ? 'Medications Today' : 'आज की दवाइयाँ'}
            </h3>
            {[
              { name: lang === 'en' ? 'BP Tablet (Amlodipine)' : 'बी.पी. गोली', time: '08:00 AM', done: true },
              { name: lang === 'en' ? 'Calcium Supplement' : 'कैल्शियम', time: '02:00 PM', done: false },
              { name: lang === 'en' ? 'Vitamin D3' : 'विटामिन डी३', time: '06:00 PM', done: false },
            ].map((med, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', borderRadius: '8px', backgroundColor: med.done ? 'var(--color-success-light)' : 'var(--bg-tertiary)', border: \`1px solid \${med.done ? 'var(--color-success)' : 'var(--border-color)'}\` }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>{med.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{med.time}</span>
                </div>
                <div style={{ color: med.done ? 'var(--color-success)' : 'var(--text-muted)' }}>
                  {med.done ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                </div>
              </div>
            ))}
          </div>

          {/* NOSTALGIA PREVIEW */}
          <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ImageIcon size={14} /> {lang === 'en' ? 'Memory Corner' : 'स्मृति कोना'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {memories.map((m, i) => (
                <div key={i} onClick={() => navigate('/senior/nostalgia')} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'background 0.2s' }} className="hover-card">
                  <img src={m.imageUrl} alt={m.title} style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <strong style={{ fontSize: '0.82rem', display: 'block', color: 'var(--text-primary)' }}>{m.title}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.date}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/senior/nostalgia')} style={{ padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <ChevronRight size={14} /> {lang === 'en' ? 'View All Memories' : 'सभी यादें देखें'}
            </button>
          </div>

          {/* BHAJAN / DEVOTION */}
          <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Volume2 size={14} /> {lang === 'en' ? 'Spiritual Corner' : 'आध्यात्मिक कोना'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {devotionList.map((item) => {
                const isCurrent = globalTrack?.src === item.src;
                const isActive = isCurrent && globalIsPlaying;
                return (
                  <button key={item.id} onClick={() => togglePlayback(item)} style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', border: \`1px solid \${isActive ? 'var(--color-primary)' : 'var(--border-color)'}\`, backgroundColor: isActive ? 'var(--color-primary-light)' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition-smooth)' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: isActive ? 'var(--color-primary)' : 'var(--bg-secondary)', color: isActive ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                      {isActive ? <Pause size={15} /> : <Play size={15} />}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>{item.title}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.artist}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* WATER TRACKER */}
          <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Droplet size={14} /> {lang === 'en' ? 'Water Intake' : 'पानी'}
            </h3>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {Array.from({ length: 8 }, (_, i) => (
                <button key={i} onClick={() => setWaterGlasses(i + 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: i < waterGlasses ? 'var(--color-primary)' : 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Droplet size={14} style={{ color: i < waterGlasses ? '#fff' : 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{waterGlasses} / 8 {lang === 'en' ? 'glasses today' : 'गिलास आज'}</p>
          </div>

        </div>
      </div>

      {/* ELDER CIRCLE SECTION */}
      <section id="elder-circle" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{lang === 'en' ? 'Elder Circle — Community Events' : 'वृद्ध मंडली — सामुदायिक कार्यक्रम'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { icon: <Activity size={20} />, title: lang === 'en' ? 'Morning Yoga' : 'प्रातःकालीन योग', sub: lang === 'en' ? 'Tomorrow, 6:30 AM' : 'कल, 6:30 बजे', badge: lang === 'en' ? '12 members' : '12 सदस्य', color: 'var(--color-primary)' },
            { icon: <Users size={20} />, title: lang === 'en' ? 'Bhajan Mandali' : 'भजन मंडली', sub: lang === 'en' ? 'Friday, 5:00 PM' : 'शुक्रवार, 5:00 बजे', badge: lang === 'en' ? '8 members' : '8 सदस्य', color: 'var(--color-secondary-dark)' },
            { icon: <CalendarDays size={20} />, title: lang === 'en' ? 'Park Walk' : 'पार्क भ्रमण', sub: lang === 'en' ? 'Daily, 7:00 AM' : 'प्रतिदिन, 7 बजे', badge: lang === 'en' ? '6 members' : '6 सदस्य', color: 'var(--color-accent-dark)' },
          ].map((ev, i) => (
            <div key={i} className="glass-card hover-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer', borderTop: \`3px solid \${ev.color}\`, textAlign: 'left' }}>
              <div style={{ color: ev.color }}>{ev.icon}</div>
              <div>
                <strong style={{ fontSize: '1rem', display: 'block' }}>{ev.title}</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ev.sub}</span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: ev.color, backgroundColor: 'var(--bg-tertiary)', padding: '0.2rem 0.6rem', borderRadius: '20px', display: 'inline-block', width: 'fit-content' }}>{ev.badge}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SOS CONFIRM MODAL */}
      {showSosConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div className="glass-card animate-slide-up" style={{ width: '90%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', border: '2px solid var(--color-danger)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <AlertTriangle size={32} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-danger)' }}>{lang === 'en' ? 'Confirm Emergency SOS' : 'आपातकालीन सहायता की पुष्टि करें'}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{lang === 'en' ? 'This will immediately alert Rohan, Priya & emergency services. Are you sure?' : 'यह रोहन, प्रिया और आपातकालीन सेवाओं को तुरंत सूचित करेगा। क्या आप सुनिश्चित हैं?'}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowSosConfirm(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 700, cursor: 'pointer' }}>{lang === 'en' ? 'Cancel' : 'रद्द करें'}</button>
              <button onClick={triggerSos} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--color-danger)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{lang === 'en' ? 'Send SOS Now' : 'SOS भेजें'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SOS ACTIVE */}
      {sosActive && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(220,38,38,0.15)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div className="glass-card animate-slide-up" style={{ width: '90%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center', border: '3px solid var(--color-danger)' }}>
            <div className="animate-pulse-soft" style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: 'var(--color-danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <AlertTriangle size={36} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-danger)' }}>{lang === 'en' ? 'SOS Sent!' : 'SOS भेजा गया!'}</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{lang === 'en' ? 'Rohan & Priya have been notified via WhatsApp. Emergency services alerted.' : 'रोहन और प्रिया को WhatsApp पर सूचित किया गया। आपातकालीन सेवाएं सतर्क हैं।'}</p>
            <button onClick={() => setSosActive(false)} style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--color-success)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{lang === 'en' ? "I'm Safe Now" : 'मैं अब सुरक्षित हूँ'}</button>
          </div>
        </div>
      )}

      {/* CALL MODAL */}
      {showCallModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div className="glass-card animate-slide-up" style={{ width: '90%', maxWidth: '360px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto' }}>
              <img src={familyMembers.find(m => m.name === callContact)?.avatar || ''} alt={callContact} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary)' }} />
              {callActive && <span className="animate-pulse-soft" style={{ position: 'absolute', bottom: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'var(--color-success)', border: '2px solid var(--bg-secondary)' }} />}
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 800 }}>{callContact}</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {callActive ? (callType === 'video' ? 'Video Connected' : 'Audio Connected') + \` — \${formatDuration(callDuration)}\` : lang === 'en' ? 'Connecting...' : 'जोड़ रहे हैं...'}
              </p>
            </div>
            {callType === 'video' && callActive && (
              <div style={{ height: '160px', backgroundColor: '#1e293b', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', border: '1px solid var(--border-color)' }}>👴</div>
            )}
            <button onClick={endMockCall} style={{ padding: '0.8rem', borderRadius: '50%', width: '56px', height: '56px', border: 'none', backgroundColor: 'var(--color-danger)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <X size={24} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default SeniorHome;
`;

const newContent = logicLines.join('\n') + returnJSX;
fs.writeFileSync('src/pages/SeniorHome.tsx', newContent, 'utf8');
console.log('Done. Lines:', newContent.split('\n').length);
