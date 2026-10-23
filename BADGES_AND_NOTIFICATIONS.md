# AlumnUSB Gamification — Badges & Notifications

Reference list for the prototype. Items marked **🆕** are new suggestions not discussed yet; everything else comes from the brainstorm (including the voice note and the Duolingo-style ranking comment).

---

## General badge rules

- **Badges are permanent.** Once earned, never removed (e.g. you keep "Gold Recurring" even if your donation later stops). Live *status* (active / paused / inactive) is shown separately.
- **Repeatable badges** show a counter (e.g. "Donor of the Month ×3").
- **Locked badges** are visible with progress (e.g. "$180 / $250").
- Every badge shows its **rarity** ("8% of donors have this").
- Every badge has an **ES / EN name and description**, and a **share card** (see notifications N2).
- Social badges can't be auto-verified: the user clicks "I followed", and the admin approves it in the backoffice.
- The admin can edit names, thresholds and icons, and award badges manually.

---

## Badges

### 1. Lifetime donation milestones

| ID | EN | ES | Rule |
|---|---|---|---|
| B-M0 | First Gift | Primera Donación | First successful donation |
| B-M1 | $100 Club | Club de los $100 | Lifetime total ≥ $100 |
| B-M2 | $250 Club | Club de los $250 | Lifetime total ≥ $250 |
| B-M3 | $500 Club | Club de los $500 | Lifetime total ≥ $500 |
| B-M4 | $1K Club | Club de los $1K | Lifetime total ≥ $1,000 |
| B-M5 | $2.5K Club | Club de los $2.5K | Lifetime total ≥ $2,500 |
| B-M6 | $5K Club | Club de los $5K | Lifetime total ≥ $5,000 |
| B-M7 | $10K Club | Club de los $10K | Lifetime total ≥ $10,000 |

### 2. Recurring tiers (from the voice note)

Tier = current monthly recurring amount (annual subscriptions ÷ 12; multiple subscriptions are summed).

| ID | EN | ES | Rule |
|---|---|---|---|
| B-R1 | Recurring | Recurrente | Active recurring ≥ $20/month |
| B-R2 | Silver Recurring | Recurrente Plata | ≥ $50/month |
| B-R3 | Gold Recurring | Recurrente Oro | ≥ $100/month |
| B-R4 | Platinum Recurring | Recurrente Platino | ≥ $250/month |
| B-R5 | Diamond Recurring | Recurrente Diamante | ≥ $500/month |

### 3. Streaks (consecutive months of successful recurring donations)

| ID | EN | ES | Rule |
|---|---|---|---|
| B-S1 | 3-Month Streak | Racha de 3 meses | 3 consecutive months |
| B-S2 | 6-Month Streak | Racha de 6 meses | 6 consecutive months |
| B-S3 | 12-Month Streak | Racha de 12 meses | 12 consecutive months |
| B-S4 | 24-Month Streak | Racha de 24 meses | 24 consecutive months |

A failed charge starts a 7-day grace period before the streak breaks.

### 4. Competition (ranking-based, repeatable)

| ID | EN | ES | Rule |
|---|---|---|---|
| B-C1 | Donor of the Week | Donante de la Semana | Highest $ donated in the week |
| B-C2 | Donor of the Month | Donante del Mes | Highest $ donated in the month |
| B-C3 | Monthly Top 10 | Top 10 del Mes | Finished the month in the top 10 (Impact Points) |
| B-C4 | Monthly Top 10% | Top 10% del Mes | Finished the month in the top 10% |
| B-C5 | Biggest Climber | Mayor Ascenso | Most positions gained in the **all-time** ranking during the month (start of month vs end). The monthly ranking resets every month, so climbing can't be measured there |
| B-C6 🆕 | Yearly Top 10 | Top 10 del Año | Finished the calendar year in the top 10 |

Donor of the Week/Month is chosen by highest dollar amount for now (to be tuned later).

### 5. Loyalty

| ID | EN | ES | Rule |
|---|---|---|---|
| B-L1 | 3-Year Supporter | Fiel por 3 Años | Donated in 3 different calendar years |
| B-L2 | 5-Year Supporter | Fiel por 5 Años | Donated in 5 different calendar years |
| B-L3 | 10-Year Supporter | Fiel por 10 Años | Donated in 10 different calendar years |
| B-L4 | Anniversary | Aniversario | Anniversary of first donation (repeatable, yearly) |

### 6. Programs & campaigns

| ID | EN | ES | Rule |
|---|---|---|---|
| B-P1 | Scholarship Supporter | Aliado de las Becas | Donated to Becas Estudiantiles |
| B-P2 | Teacher Champion | Aliado de los Profesores | Donated to Premio Enrique Planchart |
| B-P3 | On the Move | En Ruta | Donated to Transporte |
| B-P4 | Builder | Constructor | Donated to Infraestructura |
| B-P5 | First Responder | Respuesta Rápida | Donated to Fondo General y de Emergencia |
| B-P6 | Project Backer | Impulsor de Proyectos | Donated to Concurso de Proyectos |
| B-P7 | Event Supporter | Presente | Donated through Eventos |
| B-P8 | Full Spectrum | Espectro Completo | Donated to all 4 permanent programs (Becas, Planchart, Transporte, Infraestructura) |
| B-P9 | Campaign Hero: {campaign} | Héroe de Campaña: {campaña} | Contributed to a time-limited campaign/challenge (e.g. earthquake relief). One per campaign |

### 7. Matching gifts (Double the Donation / Benevity; yes/no once per year)

| ID | EN | ES | Rule |
|---|---|---|---|
| B-G1 | Double Impact {year} | Doble Impacto {año} | At least one employer-matched gift that year (one per year) |
| B-G2 | Matching Streak | Racha de Doble Impacto | Matched gifts in 3 different years |

### 8. Social & community

| ID | EN | ES | Rule |
|---|---|---|---|
| B-SO1 | Instagram Follower | Seguidor en Instagram | Follows @alumn_usb (admin-approved) |
| B-SO2 | TikTok Follower | Seguidor en TikTok | Follows @alumn_usb (admin-approved) |
| B-SO3 | X Follower | Seguidor en X | Follows @Alumn_USB (admin-approved) |
| B-SO4 | YouTube Subscriber | Suscriptor en YouTube | Subscribed to AlumnUSB (admin-approved) |
| B-SO5 🆕 | Facebook Follower | Seguidor en Facebook | Follows alumnusb (admin-approved) |
| B-SO6 🆕 | Fully Connected | Totalmente Conectado | Holds all social follower badges |
| B-SO7 | Proud Supporter | Orgulloso de Apoyar | Shared a badge on social media for the first time |
| B-SO8 | Ambassador | Embajador | **Awarded manually by the admin** to AlumnUSB local ambassadors |
| B-SO9 | Recruiter | Reclutador | Referred a friend who donated (via referral link) |
| B-SO10 🆕 | Super Recruiter | Súper Reclutador | Referred 5 friends who donated |

### 9. Special

| ID | EN | ES | Rule |
|---|---|---|---|
| B-X1 | Back in the Game | De Vuelta en el Juego | Reactivated a failed or cancelled recurring donation |
| B-X2 | Early Adopter | Pionero | Joined the platform in its first month |

### Later phases (not in the prototype)

- **Class League Champion / Campeón de Promoción**: your graduating class or degree program won the cohort league.
- **Year in Review / Tu Año con AlumnUSB**: not a badge; a shareable yearly summary.

---

## Notifications

**Channels in the prototype:** in-app only.
- **Feed**: chronological list.
- **Bell**: unread counter.
- **Banner**: persistent alert at the top of the dashboard; used only for payment problems.

Email/WhatsApp come in a later phase.

Rank changes are checked **every time the data updates**.
- A change of even 1 position sends a notification.
- There is one notification per ranking (Monthly, Yearly, All-time) that changed.
- The gap to the next position is calculated in Impact Points and shown in dollars, rounded up: the amount of a one-time donation that would pass that donor. Recurring donations earn 1.5 pts per $1, so donating that amount as recurring passes them too.

### Badges & progress

| ID | Trigger | Channel | Example (EN / ES) |
|---|---|---|---|
| N1 | Badge earned | Feed + Bell | "You earned **Gold Recurring**! 🏅" / "¡Ganaste **Recurrente Oro**! 🏅" |
| N2 | Badge earned → share prompt | Inside N1 | Share card with pre-written text + link to `/dona` with referral code. Buttons: WhatsApp, Instagram story (image download), X, Facebook, LinkedIn. E.g. "I just became a Gold Recurring donor of @alumn_usb 🎓 Think you can beat me? Donate here →" |
| N3 | Close to a locked badge (within ~10%) | Feed | "You're $20 away from the **$250 Club**" / "Te faltan $20 para el **Club de los $250**" |

### Rankings (Monthly · Yearly · All-time)

| ID | Trigger | Channel | Example |
|---|---|---|---|
| N4 | Moved up in a ranking (even 1 position) | Feed + Bell | "⬆ You moved up in the monthly ranking: **#215 → #214 of 2,000**" / "⬆ Subiste en el ranking mensual: **#215 → #214 de 2.000**" |
| N5 | Moved down in a ranking (even 1 position) | Feed + Bell | "⬇ Someone passed you in the monthly ranking: **#214 → #215 of 2,000**" / "⬇ Alguien te pasó en el ranking mensual: **#214 → #215 de 2.000**" |
| N6 | Gap to the next position (sent with N4/N5, and when the gap is small) | Feed + Bell | "You're only **$12** away from #213. [Donate]" / "Estás a solo **$12** del puesto #213. [Dona]". If the user is #1: "You're #1! Keep your lead." |
| N7 | Month closed | Feed + Bell | "You finished March at **#31 of 1,840** (Top 2%)" |
| N8 🆕 | Year closed | Feed + Bell | "You finished 2026 at #120 of 3,100" |
| N9 | Won Donor of the Week / Month | Feed + Bell | "🏆 You're the **Donor of the Month**!" |
| N10 | Won Biggest Climber | Feed + Bell | "🚀 You were the biggest climber of March: +340 positions" |
| N11 🆕 | New month started | Feed | "A new month's ranking starts today. Your next donation puts you back on the board." |

### Recurring donations & payments (from the voice note)

| ID | Trigger | Channel | Example |
|---|---|---|---|
| N12 | Recurring charge failed / no charge in 35+ days | **Banner** + Feed + Bell (high priority) | "Your monthly donation isn't going through. Your **Gold** status and **8-month streak** are at risk. [Update your card]" |
| N13 🆕 | Grace period ending (e.g. 2 days left) | Banner + Bell | "2 days left to save your 8-month streak." |
| N14 | Grace period expired | Feed + Bell | "Your streak was reset and your recurring status is now inactive. Your badges are still yours. Reactivate anytime." |
| N15 | Payment recovered | Feed + Bell | "Your donation is back on track! Status and streak restored. 🎉" |
| N16 | Moved up a recurring tier | Feed + Bell (+ share) | "You moved up to **Gold Recurring**!" |
| N17 | Near the next tier (upgrade nudge) | Feed | "You're **$15 away from Silver**. [Increase my donation]" |

### Donations & impact

| ID | Trigger | Channel | Example |
|---|---|---|---|
| N18 🆕 | Donation received | Feed | "We received your $50 donation to Becas. Thank you!" |
| N19 | Impact equivalence reached | Feed | "Your donations so far ≈ **2 months of a scholarship**" (equivalences set by the admin) |
| N20 | Donation anniversary | Feed + Bell | "3 years ago today you made your first donation to AlumnUSB 💛" |
| N21 🆕 | Lapsed donor (no donation in X months, admin-configurable) | Feed | "We miss you! Students are still counting on you. [Donate]" |

### Matching gifts

| ID | Trigger | Channel | Example |
|---|---|---|---|
| N22 | Matched gift recorded | Feed + Bell | "Your employer matched your gift. **Double Impact 2026** unlocked!" |
| N23 🆕 | Yearly matching reminder (admin picks the date) | Feed + Bell | "Does your company match donations? Many do through Double the Donation or Benevity. [Learn how]" |

### Social & referrals

| ID | Trigger | Channel | Example |
|---|---|---|---|
| N24 | Social follow claim approved | Feed + Bell | "Confirmed: thanks for following us on Instagram! +5 pts" |
| N25 | Social follow claim rejected | Bell | "We couldn't confirm your Instagram follow. Try again?" |
| N26 | Referred friend donated | Feed + Bell | "A friend you invited just donated! **Recruiter** unlocked" |

### Organization & admin content

| ID | Trigger | Channel | Example |
|---|---|---|---|
| N27 | Admin post (news) | Feed + Bell | Bilingual post written in the backoffice |
| N28 | New campaign / challenge launched | Feed + Bell | "Earthquake relief: help us reach $20K by Dec 31" (progress bar) |
| N29 🆕 | Campaign progress (50% / 100%) or ending soon | Feed | "We're at 80% of the goal, 5 days left!" |
| N30 | Organization milestone | Feed | "Together we passed **$1M** raised! 🎓" |
| N31 🆕 | Welcome (first login) | Feed | "Welcome! Here's your rank, your badges and how to earn more." |

---

## Reference: Impact Points (ranking metric)

| Source | Points |
|---|---|
| One-time donation | 1 pt per $1 |
| Recurring donation | 1.5 pts per $1 |
| Matched gift (employer) | 1 pt per $1 |
| Streak bonus | +5 pts per streak month, max +60 per month |
| Engagement (approved social follow, badge shared, referred donor) | +5 each, max 20 pts per month |

- You must donate in the period to be ranked.
- Users see only their own position ("#258 of 2,500 · Top 11%"). They never see other donors' names. The only amount they learn is the gap to the next position (N6), and that donor stays anonymous.
- The dashboard always shows real dollars too.
- All values are admin-configurable.
