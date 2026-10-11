# Permissioned water-system pilot

Status: collection plan, not completed field validation.

1. Get the site's written permission for collection and separately for any publication. Record a site alias, collection owner, equipment/method, units, timezone, measurement uncertainty and any missing intervals. Keep private documents outside Git and screenshots.
2. Record tank capacity and actual storage at a consistent timestamp. Supply and consumption are liters for the preceding daily interval, not lifetime meter totals. Confirm whether loss is already included in demand; do not count it twice. Never fill missing observations with demo values.
3. Use operational-records.csv (blank header only). For whole-site daily totals use zone=site. Keep source meter readings separately with consent; only derived interval totals enter this CSV. Record explicit reserve decisions with the responsible operator.
4. Review units, timezone offsets, gaps and rejected rows in Real Analysis. Begin with entered demand if history is insufficient. Historical demand requires the application's validated daily-series coverage; no automatic extrapolation of missing days.
5. Compare a frozen forecast against later readings using the same initial inputs. Record delivery changes, consumption changes, measurement error and policy changes. A mismatch alone does not diagnose a leak. Report sample size, duration, absolute storage error and all exclusions. Do not call hypothetical scenario differences measured savings.
6. Interview the operator before and after the task: Can they explain the reserves? Identify the next action? Find data provenance? Complete setup? Record consented, verbatim feedback and task completion time. Blank or unanswered responses remain blank.
7. Stop if data permission is withdrawn. Export/share only reviewed aggregates. The current cloud record is a single-operator site; do not overwrite it as a testing fixture.

## Operator interview form

Site alias: ____  Date: ____  Publication consent: ____
Role (non-identifying): ____  Task completed: ____  Completion time: ____
What decision would you make from these results? ____
What information is missing or unclear? ____
What assumptions do you disagree with? ____
Exact consented feedback: ____

## Evaluation record

Number of actual readings: ____  Coverage: ____  Instrument/method: ____
Missing intervals: ____  Uncertainty: ____  Forecast frozen at: ____
Observed versus forecast storage error: ____  Operational changes: ____
Confirmed measured benefit (only with evidence): ____
