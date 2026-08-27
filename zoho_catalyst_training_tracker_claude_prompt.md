# Master Prompt for Claude — Zoho Catalyst Training Tracker

You are helping me build a new application in **Zoho Catalyst**.

I will provide you with:
- an empty GitHub repository,
- a newly created Zoho Catalyst project,
- access to the Catalyst development environment/tools available to you.

Your task is to design and implement a **mobile-first training tracker** focused on simplicity, reliability, and ease of logging workouts on both iOS and Android.

The application should be a responsive web app/PWA rather than separate native mobile applications unless there is a strong technical reason otherwise.

## 1. Product Goal

The app should allow authenticated users to:

- create and manage multiple training plans,
- have only one active training plan at a time,
- define a plan duration in weeks,
- optionally specify a start date,
- work through workouts in sequence without forcing workouts to specific weekdays,
- log actual workout sessions,
- record exercises, sets, weights, reps and other metrics,
- view historical performance for every exercise,
- modify actual workouts independently of the original plan,
- import training plans through JSON,
- export training plans as JSON,
- track body measurements, starting with body weight,
- use the app comfortably from a phone during training.

Authentication must be handled through **Zoho Catalyst Authentication**.

Data for different users must be completely isolated.

Do not implement custom username/password authentication.

---

## 2. Core Design Principle

The most important architectural rule is:

**A training plan is a template. A workout session is a historical snapshot.**

When a user starts a workout, create a session representation of the planned workout.

Any changes made during that session must affect only that session unless the user explicitly chooses to modify the underlying plan.

For example, a plan may specify:

- Machine Chest Press
- 2 working sets
- target 6–10 reps

But during a particular session the user may perform:

- Set 1: 70 kg × 8
- Set 2: skipped
- Note: shoulder discomfort

The historical session must retain this information permanently.

If the training plan is subsequently changed to three sets, the historical session must still show the original two-set session.

Never derive historical workout data dynamically from the current version of a plan.

---

## 3. Users and Data Isolation

Use Catalyst Authentication as the authoritative identity source.

Every piece of user-owned data must belong to the authenticated user.

Important security rule:

**Never trust a `userId` supplied by the frontend.**

The backend must determine the current user's Catalyst identity and use it when querying, inserting, modifying or deleting records.

A user must never be able to retrieve or modify another user's:

- plans,
- workouts,
- workout sessions,
- custom exercises,
- body measurements,
- notes,
- preferences,
- history.

Where possible, enforce this in the backend/data access layer rather than relying only on frontend filtering.

---

## 4. Training Plans

A user can have multiple training plans.

Only **one plan may be active at a time**.

A training plan should contain at least:

- ID
- name
- description
- duration in weeks
- optional start date
- status
- created date
- updated date
- user ownership
- optional schema/import version
- optional plan version

Suggested statuses:

- draft
- active
- completed
- archived

Activating one plan should automatically deactivate the previous active plan.

At the end of the defined duration, the plan may be marked as completed, but the user should still be able to:

- continue using it,
- restart it,
- duplicate it,
- activate another plan.

Do not permanently lock a plan just because its planned duration has elapsed.

---

## 5. Workouts Within Plans

Plans contain ordered workouts.

Examples:

- Workout A
- Workout B
- Workout C

Do **not** force workouts onto weekdays.

Instead, maintain their sequence.

If a plan contains:

A → B → C

and the user completes B, the app should normally suggest C as the next workout.

The user must still be free to manually start another workout.

A workout should contain:

- name
- description
- order
- exercises
- optional workout notes
- optional estimated duration

---

## 6. Exercise Library

Create a comprehensive exercise-library architecture.

There should be two kinds of exercises:

### System exercises

Available to all users.

Examples:

- Machine Chest Press
- Pec Deck
- Lat Pulldown
- Leg Press
- Hack Squat
- Seated Leg Curl
- Cable Curl
- Machine Shoulder Press

### User exercises

Created by an individual user and visible only to that user.

Exercises should support fields such as:

- name
- primary muscle group
- secondary muscle groups
- equipment
- movement/category
- instructions
- metric type
- system/user scope
- aliases
- active/inactive state

Treat equipment variants as different exercises.

For example:

- Dumbbell Chest Press
- Smith Machine Chest Press
- Machine Chest Press

should have independent histories.

Performance between equipment variants should not automatically be considered equivalent.

---

## 7. Exercise Aliases

Support aliases so AI-generated plans can be matched against the exercise library.

Example:

System exercise:

`Machine Lat Pulldown`

Possible aliases:

- Lat Pulldown Machine
- Machine Pulldown
- Lat Pulldown

When importing JSON, attempt to match imported exercise names against:

1. exact names,
2. aliases,
3. sensible normalized names.

Do not silently create duplicates.

If matching is uncertain, present the user with the proposed match before saving.

---

## 8. Plan Exercises and Planned Sets

A plan exercise should be able to specify:

- exercise
- order
- notes
- rest duration
- planned sets
- progression information if applicable

Planned sets should be flexible.

Support set types such as:

- warmup
- working
- backoff
- dropset
- failure
- other

A planned set may contain:

- target reps
- target minimum reps
- target maximum reps
- suggested RIR
- suggested RPE
- optional suggested weight
- duration
- distance
- notes

Do not require every field.

For normal strength-training sets, the UI should remain simple.

---

## 9. Workout Sessions

When the user starts a workout, create a **WorkoutSession**.

Suggested session states:

- planned
- in_progress
- completed
- abandoned

The session should contain:

- user
- originating plan
- originating workout
- start timestamp
- completion timestamp
- duration
- status
- workout-level notes
- session exercises
- session sets

Session data must remain editable after completion.

The user should be able to reopen a historical workout and correct:

- weights,
- reps,
- notes,
- skipped exercises,
- sets,
- timestamps where appropriate.

Record suitable created/updated timestamps.

---

## 10. Session Exercises

A session exercise should retain enough information to reconstruct exactly what happened.

Support:

- original planned exercise
- actual exercise performed
- planned order
- actual order
- substituted status
- exercise-level notes
- sets
- skipped status if needed

Exercise substitution is required.

Example:

Plan:

`Leg Press`

Actual session:

`Hack Squat`

The app should retain that Hack Squat was substituted for Leg Press.

Do not modify the original plan automatically.

---

## 11. Session Sets

A session set should support:

- set number/order
- set type
- weight
- reps
- RIR
- RPE
- duration
- distance
- completed status
- skipped status
- notes

The UI does not need to show all of these fields at once.

For a normal resistance-training exercise, the default entry UI can primarily show:

- Weight
- Reps
- optional RIR

Advanced fields may be available through an expandable control.

Warm-up sets must be visually distinguishable from working sets.

---

## 12. Modifying a Workout During Training

The user must be able to modify the session freely.

Support:

- remove a planned set,
- mark a set skipped,
- add an extra set,
- reorder when appropriate,
- skip an exercise,
- substitute an exercise,
- add an unplanned exercise,
- edit weight,
- edit reps,
- edit notes,
- abandon the workout.

These changes must affect the session only.

The app may later offer an explicit action such as:

**Update plan using this session**

but never modify the plan automatically.

---

## 13. Previous Performance

Ease of logging is a major priority.

When displaying an exercise during a workout, show its most relevant previous performance.

Example:

Machine Chest Press

Previous session:

- 70 kg × 8
- 70 kg × 6

Today:

- `[70] kg × [ ] reps`
- `[70] kg × [ ] reps`

Preferably prefill or provide an easy action to reuse previous weights.

The user should not need to navigate away from the workout to see previous results.

---

## 14. Exercise History

Exercise history is essential.

For each exercise, provide a history view showing previous performances.

For example:

| Date | Performance |
|---|---|
| 27 Aug | 70 kg × 9, 70 kg × 6 |
| 21 Aug | 70 kg × 8, 70 kg × 6 |
| 14 Aug | 67.5 kg × 10, 67.5 kg × 7 |

Historical exercise data should come from actual sessions rather than plans.

Provide a clean mobile presentation rather than forcing a desktop table where inappropriate.

---

## 15. Personal Records

Automatically identify useful personal records where possible.

Examples:

- highest weight performed
- highest reps at a given weight
- best estimated 1RM
- highest session volume

Do not make the entire application powerlifting-focused.

PR indicators should be useful supplemental information.

Use a sensible estimated 1RM formula and document which formula is being used.

---

## 16. Progression Rules

Support optional progression rules in the architecture.

Example:

Target range:

6–10 repetitions.

If the user reaches the upper end of the target range with appropriate performance, the application may suggest increasing the weight next time.

Progression must initially be advisory.

Do not automatically modify future weights without user action.

Keep progression-rule support flexible enough for future expansion.

---

## 17. Notes

Support notes at three levels:

### Workout note

Example:

`Poor sleep today. Shoulder slightly irritated.`

### Exercise note

Example:

`Reduced range of motion due to shoulder discomfort.`

### Set note

Example:

`Stopped because of pain.`

Notes must remain associated with the historical session.

---

## 18. Rest Timer

Include a simple rest timer.

Each exercise can define a default rest duration.

When a set is completed, allow the app to automatically start the timer.

The user must be able to:

- pause,
- stop,
- restart,
- add time,
- skip the timer.

Do not make the rest timer prevent the user from navigating within the workout.

---

## 19. Autosave

Workout entry must be autosaved.

The user should not need to repeatedly press Save during a workout.

Also provide an explicit:

**Finish Workout**

action.

Finishing a workout should:

- mark the session completed,
- record the finish time,
- calculate duration,
- preserve all logged data.

If a user leaves a workout unfinished, it should remain `in_progress`.

Allow the user to resume it.

---

## 20. Offline Behaviour

Gym connectivity can be unreliable.

Implement reasonable offline resilience for active workouts.

At minimum:

- maintain the current in-progress workout locally,
- preserve user-entered set data if connectivity temporarily disappears,
- synchronize with Catalyst when connectivity returns,
- clearly indicate synchronization status.

Avoid building an unnecessarily complex general-purpose offline database for v1.

Focus primarily on preventing the loss of an active workout.

Think carefully about conflict handling.

Prefer predictable behaviour over sophisticated synchronization.

---

## 21. Cardio

Cardio should be supported separately from normal resistance exercises.

Do not force cardio into a `weight × reps` structure.

Cardio activities should be able to contain metrics such as:

- duration
- distance
- average heart rate
- incline
- speed/pace
- resistance level
- calories, optionally
- notes

Examples:

- treadmill
- stationary bike
- elliptical
- rowing machine
- outdoor walk
- outdoor run

Keep the architecture flexible, but cardio does not need to dominate the v1 experience.

---

## 22. Body Measurements

Create a simple body-measurement feature.

For v1, weight is required.

Each entry should contain:

- date/time
- body weight
- optional note

Design the model so additional measurements can be added later, such as:

- waist
- body-fat percentage
- chest
- arm
- thigh

Do not overbuild these measurements now.

Provide a basic weight-history view.

---

## 23. JSON Import

JSON import is a core feature.

The workflow must be:

**Paste JSON → Validate → Match Exercises → Preview → Save**

Never save imported data immediately after pasting.

The user must be able to see what is going to be created.

Show validation errors clearly.

Examples:

- missing workout name
- unsupported schema version
- invalid set type
- invalid target repetition range
- unknown exercise
- malformed JSON

Unknown exercises must go through exercise matching.

Allow the user to:

- accept an existing match,
- select another exercise,
- create a new custom exercise.

---

## 24. JSON Export

Training plans must be exportable as JSON.

The exported structure should be suitable for providing to AI assistants so they can:

- analyse a training plan,
- modify it,
- create a similar plan,
- generate a replacement plan.

Do not export Catalyst-specific database details unnecessarily.

Use a clean application-level schema.

---

## 25. JSON Schema Versioning

Every exported plan must include a schema version.

Example:

```json
{
  "schemaVersion": "1.0"
}
```

Build import logic with schema versioning in mind.

Do not assume the schema will never change.

For the first implementation, support `1.0`.

---

## 26. Initial JSON Format

Use a structure broadly similar to this:

```json
{
  "schemaVersion": "1.0",
  "name": "Heavy Duty Machine Programme",
  "description": "Low-volume hypertrophy programme",
  "durationWeeks": 8,
  "startDate": null,
  "workouts": [
    {
      "name": "Workout A",
      "description": "Chest, back and shoulders",
      "exercises": [
        {
          "exercise": "Machine Chest Press",
          "restSeconds": 120,
          "notes": "Controlled eccentric.",
          "sets": [
            {
              "type": "warmup",
              "targetReps": 10
            },
            {
              "type": "warmup",
              "targetReps": 6
            },
            {
              "type": "working",
              "targetRepsMin": 6,
              "targetRepsMax": 10,
              "targetRIR": 0
            }
          ]
        }
      ]
    }
  ]
}
```

You may improve this structure if needed, but:

- keep it human-readable,
- keep it AI-friendly,
- avoid exposing database implementation details,
- document any changes,
- maintain schema versioning.

---

## 27. Mobile UX

The primary interface is a phone.

Design **mobile first**, then make it responsive for tablets and desktop.

Primary targets:

- iOS Safari/PWA
- Android Chrome/PWA

Prioritize:

- large tap targets,
- minimal typing,
- clear hierarchy,
- very few modal dialogs,
- easy one-handed operation,
- no horizontal scrolling,
- fast interaction during workouts.

Avoid desktop-style administrative interfaces.

---

## 28. Navigation

Use a simple bottom navigation structure similar to:

- Home
- Workout
- History
- Exercises
- More

Adapt this if necessary, but maintain the same simplicity.

---

## 29. Home Screen

The home screen should prioritize the next action.

Suggested structure:

### Active Plan

Plan name

`Week 3 of 8`

### Next Workout

Workout B — Legs

Last trained: 4 days ago

Large primary action:

**Start Workout**

Below that, provide lightweight information such as:

- last completed workout,
- recent body weight,
- recent improvement/PR indicator,
- current in-progress workout if one exists.

Do not create a large analytics dashboard.

The main job of the home screen is to get the user into their next workout quickly.

---

## 30. Active Workout UX

The active workout screen is the most important interface in the application.

For each exercise, show:

- exercise name
- planned target
- previous performance
- current sets
- rest timer when applicable
- notes
- substitution control
- add-set control
- skip controls

Example layout:

```text
Machine Chest Press

Target
2 working sets · 6–10 reps

Previous
70 kg × 8
70 kg × 6

Today

Set 1
[ 70 ] kg   [ 9 ] reps   ✓

Set 2
[ 70 ] kg   [   ] reps

+ Add Set

Exercise Notes
[........................]

Previous Exercise     Next Exercise
```

Do not treat this as an exact visual specification.

Improve the interaction where appropriate while maintaining simplicity.

---

## 31. Workout History

Provide a history screen with previous sessions.

Allow filtering or navigation by:

- date
- training plan
- workout
- exercise where useful

A completed session should be reopenable.

Historical workouts should clearly display:

- date
- plan
- workout
- duration
- exercises performed
- actual sets
- substitutions
- skipped work
- notes

---

## 32. Plan Editing

Users should be able to:

- create plan
- edit plan
- duplicate plan
- activate plan
- archive plan
- delete when appropriate
- change duration
- add/remove workouts
- reorder workouts
- add/remove exercises
- reorder exercises
- add/remove/edit sets

Use safe deletion behaviour where historical data exists.

Deleting a plan must not destroy historical sessions associated with it.

Consider soft deletion or archival where appropriate.

---

## 33. Exercise Creation

Users must be able to add custom exercises manually.

Prevent obvious duplicates where practical.

Custom exercises belong only to the user who created them.

A user-created exercise can be used in:

- plans
- sessions
- substitutions
- JSON imports

---

## 34. Suggested Catalyst Data Model

Do not blindly implement this exact model if Catalyst provides a better pattern, but preserve the domain separation.

Suggested entities/tables:

```text
TrainingPlan
PlanWorkout
PlanExercise
PlanSet

Exercise
ExerciseAlias

WorkoutSession
SessionExercise
SessionSet

BodyMeasurement

UserPreferences
```

Potentially add supporting entities if justified.

Avoid putting an entire application into one giant JSON column simply because it is easier initially.

Use normalized structures where they provide meaningful benefits for:

- history,
- querying,
- exercise analytics,
- user isolation,
- editing.

At the same time, avoid unnecessary enterprise-level normalization.

---

## 35. Data Integrity

Pay particular attention to:

- user ownership,
- ordering,
- plan/session separation,
- deletion behaviour,
- historical integrity,
- duplicate exercise matching,
- partial workouts,
- abandoned sessions,
- JSON validation.

Prefer stable identifiers over relying on names.

Do not make exercise names the permanent relational identifier.

---

## 36. Frontend Technology

Prefer:

- React
- TypeScript
- Vite or the most appropriate Catalyst-supported frontend workflow
- responsive CSS

Use a lightweight, maintainable approach.

Avoid introducing a large dependency solely for a small UI feature.

Create reusable components for commonly repeated workout controls.

---

## 37. Visual Direction

The app should feel:

- clean
- modern
- calm
- compact
- mobile-native
- easy to understand

Avoid:

- excessive gradients,
- excessive animations,
- glassmorphism everywhere,
- crowded dashboards,
- tiny text,
- desktop tables on mobile,
- excessive card nesting,
- excessive decorative UI.

Use clear visual distinctions for:

- warm-up sets,
- working sets,
- completed sets,
- skipped sets,
- PRs,
- unsynced/offline state.

Accessibility and legibility are more important than decorative styling.

---

## 38. PWA

Where practical, configure the frontend as an installable PWA.

Include:

- manifest
- application icons/placeholders
- mobile viewport support
- standalone-friendly layout
- safe handling of iOS viewport areas
- appropriate theme metadata

Do not make full offline application support dependent on the PWA implementation.

---

## 39. Error Handling

Never silently fail.

Provide user-friendly handling for:

- Catalyst API errors
- authentication expiration
- failed autosave
- offline state
- synchronization failure
- invalid JSON
- import mismatch
- data conflicts

During active workouts, preserving user-entered data is the priority.

---

## 40. Loading Behaviour

Avoid unnecessary full-screen loading states.

For mobile logging:

- optimistically update where safe,
- autosave in the background,
- show a subtle sync indicator,
- avoid blocking the user after every set entry.

---

## 41. Performance

Keep the application lightweight.

Do not load the entire workout history on startup.

Fetch only the data required for the current screen.

Exercise search should remain responsive with a substantial library.

Use sensible pagination/lazy loading where appropriate.

---

## 42. Security

Apply normal secure development practices.

Particularly:

- derive user identity server-side,
- validate all write operations,
- validate imported JSON,
- avoid trusting client-generated ownership identifiers,
- sanitize displayed notes/user content where relevant,
- do not expose Catalyst secrets in frontend code,
- keep privileged operations server-side.

---

## 43. Do Not Over-Engineer v1

Do not initially build:

- social features
- public profiles
- trainer/client relationships
- messaging
- payments
- subscriptions
- nutrition tracking
- meal tracking
- wearable integrations
- Apple Health integration
- Google Health Connect integration
- AI-generated workouts inside the application
- complex periodization engines
- advanced machine-learning recommendations
- native iOS or Android apps
- multi-tenant organization management

Architect cleanly enough that useful additions remain possible, but optimize for completing a robust v1.

---

## 44. Implementation Approach

Do not immediately generate the entire application in one uncontrolled pass.

First inspect:

- the repository,
- the Catalyst project,
- available Catalyst capabilities,
- authentication setup,
- Data Store capabilities,
- deployment structure.

Then create a concise implementation plan.

The implementation should be divided into logical phases.

A sensible order would be:

### Phase 1 — Foundation

- Catalyst project integration
- React/TypeScript frontend
- routing
- authentication
- core navigation
- authenticated user identification
- basic data-access architecture

### Phase 2 — Exercise Library

- exercise model
- system exercise seed data
- custom exercises
- search
- exercise detail/history shell

### Phase 3 — Plans

- plan CRUD
- workouts
- plan exercises
- planned sets
- ordering
- active-plan behaviour

### Phase 4 — Workout Logging

- session creation
- session snapshots
- active workout UI
- session sets
- previous performance
- autosave
- finish/abandon/resume

### Phase 5 — History

- session history
- workout detail
- editing completed sessions
- exercise history
- PR calculations

### Phase 6 — JSON

- schema 1.0
- validation
- matching
- preview
- import
- export

### Phase 7 — Quality of Life

- rest timer
- substitutions
- progression suggestions
- body weight
- offline resilience
- PWA polish

This order can be changed if Catalyst constraints make another sequence more appropriate.

---

## 45. Work Incrementally

After completing each significant phase:

1. ensure the application builds,
2. run relevant tests,
3. resolve errors,
4. check mobile layouts,
5. verify Catalyst integration,
6. commit the work to Git with a clear commit message.

Do not accumulate a huge untested change set.

---

## 46. Git

Use the provided GitHub repository properly.

Create meaningful commits.

Examples:

```text
feat: initialise Catalyst training tracker
feat: add exercise library
feat: add training plan management
feat: implement workout sessions
feat: add workout history
feat: add JSON plan import
```

Do not commit:

- secrets,
- credentials,
- temporary files,
- dependency caches,
- local Catalyst credentials.

Maintain a suitable `.gitignore`.

---

## 47. Documentation

Maintain a useful README.

It should eventually explain:

- purpose
- architecture
- technology
- Catalyst services used
- development setup
- authentication
- datastore structure
- JSON import format
- local development
- deployment
- known limitations

Also document the JSON schema separately if useful.

---

## 48. Exercise Seed Library

Create an initial useful strength-training exercise library rather than leaving the system empty.

Include common exercises covering at least:

- chest
- back
- shoulders
- quadriceps
- hamstrings
- glutes
- calves
- biceps
- triceps
- abdominal/core exercises

And common equipment categories:

- machines
- cables
- barbells
- dumbbells
- Smith machine
- bodyweight

Prioritize common gym exercises.

Do not attempt to create thousands of exercises in v1.

A curated initial library of approximately 100–200 sensible exercises is preferable to a low-quality huge database.

---

## 49. Testing

Implement appropriate tests around logic that is particularly easy to break.

Prioritize tests for:

- plan activation
- user isolation
- plan/session separation
- workout progression/order
- JSON validation
- JSON import/export
- exercise matching
- workout completion
- abandoned sessions
- progression-rule logic
- PR calculations where applicable

Do not spend disproportionate effort testing trivial presentational components.

---

## 50. Acceptance Scenarios

The completed v1 should successfully handle scenarios such as:

### Scenario 1

User creates an 8-week plan containing Workout A and Workout B.

They activate it.

Home shows Workout A as next.

### Scenario 2

User starts Workout A.

Machine Chest Press contains:

- two warm-up sets
- two working sets

Previous performance is shown.

The user logs weights and reps.

### Scenario 3

The user only performs one of two planned working sets.

They mark the other as skipped and add:

`Shoulder pain. Stopped early.`

The original plan remains unchanged.

### Scenario 4

The user substitutes:

`Leg Press`

with:

`Hack Squat`

for today's workout.

The substitution appears in session history.

The plan continues to contain Leg Press.

### Scenario 5

User completes Workout A.

The application suggests Workout B next.

### Scenario 6

User edits the underlying Workout A next week and adds another set.

Their old historical Workout A still shows the original session structure.

### Scenario 7

User asks an AI assistant to produce a training plan as JSON.

They paste it into the application.

The application validates it, matches known exercises, identifies unknown exercises, shows a preview and only creates the plan after confirmation.

### Scenario 8

User exports that plan.

The resulting JSON can be pasted into another AI assistant and understood without Catalyst-specific database knowledge.

### Scenario 9

User loses internet connectivity during a workout.

They log another set.

The entered information is not lost.

When connectivity returns, synchronization occurs.

### Scenario 10

Two Catalyst users use the same application.

Neither can access the other's plans, sessions, body measurements or custom exercises.

---

## 51. Important Development Behaviour

When you encounter an implementation question:

1. prefer the simplest architecture that satisfies the requirements,
2. preserve historical data,
3. preserve user isolation,
4. optimize the active-workout user experience,
5. avoid adding features not requested.

If Catalyst imposes an important constraint, explain it and adapt the implementation rather than silently working around it badly.

If you identify a significantly better architectural approach, explain it before making a large change.

---

## 52. First Task

Start by inspecting the empty repository and the Catalyst project.

Then:

1. identify the Catalyst services and structure we should use,
2. propose the concrete datastore schema,
3. propose the frontend structure,
4. define the JSON schema `1.0`,
5. identify any Catalyst-specific constraints or decisions,
6. create an implementation roadmap.

Do **not** implement all application features immediately.

Once the architecture is established, begin implementing **Phase 1 — Foundation**.

Proceed autonomously through reasonable implementation decisions rather than repeatedly asking me minor questions.

Pause for my input only when a decision would materially alter:

- the architecture,
- user experience,
- data integrity,
- security,
- or project scope.
