# Graeme Task Assistant — Build Spec for Codey

## Purpose
Build an ADHD-friendly, visually oriented task assistant for Graeme.

Primary goal: reduce overwhelm by turning messy incoming requests into small, scheduled, manageable tasks with a visual calendar view and chat-driven daily planning.

## Non-Negotiables
- Setup and use must be near-zero effort for Graeme.
- Chat-first workflow; avoid complex configuration UI.
- Strong visual monthly calendar view, similar in spirit to Google Calendar.
- Assistant must handle triage and planning automatically.
- Assistant must never send external messages or make external commitments without explicit approval.
- Optimize for fast useful MVP, not perfect architecture.

## Priority Order

### P0 — MVP only (build these first)
1. Internal task repository (local, simple, reliable)
2. Capture inbox for pasted/raw input
3. Agent triage: raw input -> task/project/waiting/reference
4. Small next-step generation for actionable items
5. Monthly calendar view
6. Weekly calendar view
7. Daily plan generation: 1 must-do + 2 optional
8. One daily check-in
9. Bad Day Mode / safe rescheduling
10. Basic category color-coding
11. Overload warning for obviously crowded days

### P1 — high-value next
1. Multi-day project bars on calendar
2. Better scheduling heuristics
3. Waiting-for / blocked workflow
4. Delegation hooks for Ambi/other agents
5. Better item detail / source traceability
6. Stale follow-up detection

### P2 — later, only if MVP lands well
1. Outlook ingestion
2. Teams ingestion
3. Forwarded email flow
4. Voice-note capture
5. Optional sync to external task tools
6. More advanced automation/drafting

## MVP Delivery Rule
If a feature adds noticeable setup burden, config burden, or conceptual complexity, cut it from MVP unless it is required for the core loop:
- capture
- triage
- schedule visually
- daily plan
- recover from bad day

## User Profile Summary
Graeme is:
- not a developer
- a marketer
- very visual
- likely to lose interest if setup/configuration is heavy
- prone to overwhelm from too many scattered tasks
- wants one trusted place to throw everything
- wants the system to act more like a smart secretary than a generic to-do app

## Product Shape
This is not a normal task manager.
It is a:
1. capture inbox
2. triage/planning agent
3. visual calendar-driven workload view
4. daily coaching/check-in system
5. selective delegation/orchestration layer

## Core User Story
As Graeme, I want to dump emails, Teams messages, meeting notes, and random thoughts into one place, have an agent convert them into small actionable tasks, place them onto a calendar, show me what matters today, check in when I drift, and safely reschedule when I’m having a bad day.

---

# MVP Scope

## 1. Inputs / Capture
Must support:
- pasted email text
- pasted Teams messages/threads
- pasted meeting notes
- freeform brain-dump text
- manual task entry in chat-like form

Nice-to-have later:
- forwarded email ingestion
- voice note transcription
- direct Teams/Outlook connectors

### UX requirement
Capture must require almost no decisions.
User should be able to paste/send raw input without categorizing it.

---

## 2. Agent Triage
For every captured item, the system should attempt to classify it as one of:
- task
- project
- waiting-for
- reference
- ignore/archive

For actionable items, generate:
- title
- first small next step
- suggested effort estimate
- suggested schedule date
- due date if inferable
- category/context
- confidence / ambiguity flag

### Triage principles
- Prefer small next visible actions.
- Reduce vague obligations into concrete steps.
- Avoid creating giant intimidating tasks.
- If unclear, preserve raw source and mark for review instead of hallucinating.

Example transformation:
- Input: “Can you get a case study draft to me next week?”
- Output:
  - Project: Case study draft
  - Next action: Gather source notes and create outline
  - Suggested date: Tuesday morning
  - Due date: Thursday EOD (if inferred)

---

## 3. Canonical Repository
Use a single internal source of truth for tasks.

MVP recommendation:
- local lightweight store (SQLite preferred)
- no external dependency required for basic function

Reason:
- minimizes setup friction
- avoids forcing Graeme into a third-party tool before value is proven
- enables custom scheduling logic and visual calendar rendering

Data model should support at minimum:
- id
- title
- raw_source
- source_type
- status
- category
- priority
- effort_estimate
- due_date
- scheduled_date
- scheduled_start / end (optional)
- multi_day_start / multi_day_end (optional)
- next_action
- notes
- waiting_for
- blocked_reason
- delegation_candidate
- created_at
- updated_at

---

## 4. Visual UI

## Main screens

### A. Inbox
Shows:
- newly captured raw items
- triaged but unscheduled items
- ambiguous items needing clarification

### B. Today
Shows only:
- 1 Must Do
- 2 Optional / If You’ve Got The Energy
- blocked/waiting items
- quick action: “Today is a bad day”

This screen should be extremely clean.

### C. Calendar (critical)
This is a core feature, not an extra.

Must include:
- monthly calendar view
- weekly calendar view
- tasks shown on dates
- deadline visibility
- multi-day bars for larger projects
- color-coded categories
- clear visual signal for overloaded days

Design goal:
- emotionally readable at a glance
- closer to calendar than to enterprise project software
- simple, clean, visual

### D. Item Detail
Shows:
- raw source
- extracted task/project info
- suggested next step
- schedule info
- related items
- delegation status if applicable

---

## 5. Daily Planning Logic
Every morning, generate:
- 1 Must Do
- 2 Optional

Planning should consider:
- deadlines
- scheduled workload
- overdue items
- effort balance
- blocked items
- carry-over from prior day

### Rules
- Never show the full guilt backlog as the default daily view.
- Default to a humane, winnowed plan.
- Protect hard deadlines.
- Avoid overstuffing a day.
- Prefer momentum-generating small wins after the must-do.

---

## 6. Check-ins
One daily check-in, default around 2 PM local time.

Prompt style should be short and useful.
Examples:
- “How’s the must-do going?”
- “Need help breaking it down?”
- “Rough day? I can reshuffle things.”

Supported responses / actions:
- done
- stuck
- bad day
- move it
- help me start

System should react accordingly.

---

## 7. Bad Day Mode
This is required.

When invoked:
- reduce visible workload
- keep only essentials visible
- move flexible tasks forward
- protect hard deadlines
- warn when requested deferral would cause a real problem

Example output:
- Today: pay bill, reply to urgent message
- Everything else moved safely

Bad Day Mode should feel supportive, not punitive.

---

## 8. Scheduling / Calendar Brain
The system should automatically suggest dates for tasks.

Scheduling should account for:
- due dates
- estimated effort
- existing daily load
- multi-day projects
- overdue pressure
- user preference for simple plans

### Overload logic
Need basic heuristics to identify overloaded days/weeks.
Examples:
- too many tasks on one day
- too many high-effort tasks together
- too many hard deadlines clustered

When overload is detected:
- visually flag it
- suggest moving lower-priority items

---

## 9. Delegation / Autonomy
Assistant may autonomously:
- draft internal notes
- prepare outlines
- summarize source material
- break down tasks
- create/update schedules
- mark waiting-for items
- propose delegation

Assistant may delegate suitable tasks to Ambi/other agents when low-risk and clearly useful.

Assistant must NOT autonomously:
- send external messages
- commit to deadlines externally
- delete important items without confirmation
- make confusing broad schedule changes without explanation

---

## 10. Categories / Color Coding
Must support visual categories with color.
Initial default set:
- Work
- Personal
- Family
- Creative / Hobby
- Admin
- Waiting / Blocked

Keep this simple. No heavy taxonomy.

---

## 11. Setup Constraints
MVP must be installable and usable with minimal user effort.

### Strong preference
- one command or one guided setup flow
- no manual config editing required
- no need for Graeme to understand architecture

### Acceptable initial compromise
- local-only MVP first
- manual paste/capture first
- external connectors added later

This is preferable to a feature-rich but high-friction setup.

---

## 12. Technical Recommendations
These are recommendations, not strict mandates.

### Suggested architecture
- small local web app for visual UI
- lightweight backend service
- SQLite datastore
- chat/agent entrypoint via OpenClaw
- modular ingestion adapters
- scheduler for daily planning/check-ins

### Suggested implementation priorities
1. local repository
2. capture inbox
3. triage pipeline
4. monthly/weekly calendar UI
5. daily plan generation
6. check-in / bad day actions
7. delegation hooks
8. external connectors

---

## 13. Delivery Philosophy
Optimize for:
- usable quickly
- visually calming
- minimal user effort
- strong defaults
- safe autonomy

Do NOT optimize for:
- generic enterprise PM features
- massive configurability
- complex onboarding
- perfect integration breadth in v1

---

## 14. Success Criteria for MVP
MVP is successful if Graeme can:
1. paste messy requests into one inbox
2. see them converted into manageable tasks
3. view those tasks on a monthly calendar
4. receive a daily 1+2 plan
5. hit a bad-day control and recover without feeling buried
6. use the system with almost no training

---

## 15. Suggested Build Phases

### Phase 1 — prove the concept fast
- internal task store
- raw capture inbox
- triage to task/next action
- monthly + weekly calendar
- daily 1 must-do + 2 optional
- one check-in
- bad-day reschedule

### Phase 2 — useful automation
- better triage quality
- overload detection
- multi-day projects
- delegation to Ambi
- stale follow-up detection

### Phase 3 — integrations
- Outlook ingestion
- Teams ingestion
- forwarded email flow
- optional sync to external task systems

---

## 16. Instruction to Codey
Bias every decision toward:
- fewer clicks
- fewer settings
- less reading
- stronger defaults
- visually readable calendar-first workflow

If a feature increases configuration burden, skip it unless it delivers huge value.

MVP should feel like a calm assistant, not another system Graeme has to manage.
