# Writing good Planton cards

Rules every Planton skill follows when it writes cards.

## Language

- Write in the user's language. Use plain, everyday words; explain any term a beginner wouldn't know.
- Titles: short (aim for under 60 characters), start tasks with a verb ("Marinate the pork", "Book the flights").
  Don't number titles; the app numbers steps.
- Descriptions: one short line, usually an estimate or quantity ("About 20 minutes", "Serves 4").

## Be specific

This matters more than any other rule. Every instruction says exactly what, how much and how long, so the person can
do it without thinking or searching: name the exercise, food, item or place, and give the amount with units.

| Too vague | Right |
| --- | --- |
| Warm up properly. | Do 10 minutes of light movement: 30 arm circles each direction, 15 bodyweight squats, 10 hip hinges, 10 cat-cows and 20 jumping jacks. |
| Eat a high-protein breakfast. | 2 boiled eggs, 1 cup cooked oats with 1 sliced banana, and a glass of water. |
| Prepare documents. | Passport photo printed (2×2 in). |

- When the right amount depends on the user (body weight, fitness, equipment, budget), don't stay vague: plan for a
  sensible default, note it once under "Assumed" in the workflow's notes ("Portions are for about 70 kg; scale up or
  down"), and give the numbers.
- No filler in place of an instruction: "listen to your body", "stay consistent", "adjust as needed".

## Notes

- Start a card's notes with one short paragraph saying what to do and why it matters.
- Use bullets for tips, warnings ("Watch for: …"), and options ("If you don't have a wok, use a wide pan").
- Use checklists for the actions themselves: one item per action, each with its own amount ("30 arm circles each
  direction", "15 bodyweight squats", "2 boiled eggs"), usually 2–10 per card. Each must be concrete and checkable:
  "Sauce coats the back of a spoon", not "Sauce is ready". A card can't be completed until every item is ticked, so
  list only what the person should really do.
- Split a long session into parts with headings ("Warm-up", "Main sets", "Cool-down"), each followed by its checklist.
- Give real numbers with units: amounts, sizes, times, temperatures (°C with °F), distances. Round to what people
  measure at home.
- Timers: add `timerMinutes` to steps that are mostly waiting (marinating, simmering, resting, a focus session).

## Honesty and safety

- Don't invent facts. If something depends on the user's situation or on details you can't check (prices, laws, opening
  hours, medical dosages), say so and add a bullet "Check: …" or "Assumption to verify: …".
- When the user skipped a question, pick a sensible default and record it in the workflow's notes under "Assumed".
- Food: include safe cooking temperatures for meat, poultry, and eggs, and how to store leftovers.
- Health, medication, money, and legal steps: add a note to follow a professional's or the official source's guidance.
  Never invent medication or supplement doses, or legal requirements. Ordinary food amounts and exercise reps are fine
  to give.
- Physical work: include the safety step (turn off power, wear gloves, ventilate) as its own checklist item.

## Size

- Keep plans usable on a phone: most plans have 4–12 top-level cards. Split big cards; merge trivial ones.
- Don't exceed 4 levels of nesting or 400 cards (the importer rejects them).

## Looks

- Optionally set `appearance` with a cover that matches the topic (see format.md). Use
  `"style": "background", "fade": "medium"` for a bold card, or leave `appearance` out for the default look.
