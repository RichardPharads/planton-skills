# Scheduled plans (`"type": "scheduled"`)

For anything with real dates and times: daily routines, habits, study timetables, workout or training programs,
challenges over a set number of days, care or medication times, and one-off appointments. Build a routine the Planton
app can bring up at the right time each day. Read "Schedules" in [format.md](../../planton/reference/format.md).

## 1. Know today's date

Dates must be real. Use today's date from your context, and confirm the local date, time, and time zone with:

```bash
node -e "console.log(new Date().toString())"
```

## 2. Ask when and how often

One AskUserQuestion round with up to 4 questions. Skip any the request already answers ("every weekday at 6 am
starting Monday" answers all of them). Put the most likely choice first with "(Recommended)".

| Question | Choices |
| --- | --- |
| When do you want to start? | Today (only if there's still time today) · Tomorrow · Next Monday · Pick a date (Other) |
| How often? | Every day · Weekdays · Specific days (Other) · Just once |
| For how long? | 1 week · 30 days · No end date · Until a date (Other) |
| What time of day? | Morning (e.g. 06:30) · Midday (12:00) · Evening (e.g. 19:00) · A specific time (Other) |

Ask a second round only if needed, e.g. different times for different sessions, or which days for "specific days".

## 3. Turn answers into exact dates

- **Today / tomorrow**: today's date, or today + 1 day, as `YYYY-MM-DD`.
- **Next Monday** (or any weekday): the first such day after today.
- **For N days** starting on day D: `endDate` = D + (N − 1) days. **1 week** = 7 days. **No end date**: leave
  `endDate` out.
- **Just once**: use `{ "at": "YYYY-MM-DDTHH:MM" }` in local time, with no `Z` or offset.
- Double-check weekdays for the dates you computed (e.g. with `node -e "console.log(new Date(2026, 8, 21).toDateString())"`).

## 4. Design the cards

- **One card per session or meal.** Each card has its own `schedule` ("Breakfast" at 07:00, "Lower-body workout" at
  18:00 on `[1, 3, 5]`). Its checklist is what to do *each time*, because a repeating card, and every card inside it,
  starts fresh at every occurrence.
- **Exact contents.** A workout card lists each exercise with sets, reps and load ("Goblet squats 4×10 at 16 kg, rest
  90 s"); a meal card lists each food with its amount ("2 boiled eggs", "150 g grilled chicken"). Split a session into
  parts with headings ("Warm-up", "Main sets", "Cool-down"), each followed by its checklist. See "Be specific" in
  [writing.md](../../planton/reference/writing.md).
- **Progressive programs** (e.g. a running plan that gets harder): make one card per stage with back-to-back date
  ranges ("Week 1–2: Walk-run" 2026-09-16 → 2026-09-29, "Week 3–4: Run 20 min" 2026-09-30 → 2026-10-13).
- **Reviews and milestones**: add a weekly review card (e.g. Sunday evening) and a one-off card for the final day or
  event.
- **Realistic timing**: a card is due for 2 hours from its time, then marked missed. Leave buffers between sessions,
  keep to about 6 or fewer cards per day, and avoid times the user said they're busy.
- Each card's notes: a short paragraph (what and why), optional tips, one checklist item per action (usually 2–10),
  and `timerMinutes` for timed sessions (a 25-minute focus block, a 20-minute workout).
- **Health and medication**: use the times and amounts the user gives; never invent doses. Add a note to follow their
  doctor's or pharmacist's instructions.
- Workflow notes: overview, the date range in words ("Every day at 6:30 AM, Sep 16 – Oct 15"), and "Assumed" bullets.
- Planton can remind the user when a card is due: tell them to turn on Settings → Reminders in the app.

## 5. Confirm before saving

Show a short summary with the real dates before writing ("Starts Wed, Sep 16 · every day at 6:30 AM · ends Thu, Oct 15
· 3 cards"). Adjust if the user corrects anything.
