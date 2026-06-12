# KRP Weekly Time Helper

Chrome MV3 extension that injects a floating helper panel on:

- `https://krp.kaist.ac.kr/krp/main_page/home*`

The panel reads the existing KRP page and shows:

- Remaining average counted work time for the rest of the week
- If you are checked in and not yet checked out:
  - Finish time to complete the weekly `40H` target today, when possible
  - Finish times for adding `6H` through `12H` counted work today, omitting impossible cases

## Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this extension folder
5. Open or refresh `https://krp.kaist.ac.kr/krp/main_page/home`

## Data Sources

- Weekly remaining target: `.work_remain_hr`
- Start time: `.cul_time`
- End time: `.lvf_time`
- Today marker for weekdays-left counting: `.fc_day_top p.today`

## Calculation Rules

- `금주 잔여 복무시간` is treated as the authoritative remaining weekly target.
- Weekday holidays are inferred from current-week calendar entries.
- Credited time before today includes actual attendance, business trips, and paid leave/holiday entries shown on the calendar.
  - `worked_minutes_before_today + remaining_minutes = inferred_weekly_required_minutes`
  - `holiday_count = round((40H - inferred_weekly_required_minutes) / 8H)`
- Remaining average time is:
  - `ceil(remaining_minutes / holiday_adjusted_weekdays_left_including_today)`
- Counted work windows are:
  - `06:00-12:00`
  - `13:00-18:00`
  - `19:00-24:00`
- Counted time between `12:00-13:00` and `18:00-19:00` is excluded.
- Maximum counted work in a day is `12H`.
- Finish-time predictions are hidden when:
  - You are not checked in
  - You already checked out
  - The target exceeds the `12H` daily counted cap
  - The target cannot be reached before `24:00`

## Notes

- If the calendar `today` marker is missing, the extension falls back to the browser weekday.
- Weekdays-left counting assumes Monday through Friday only, then subtracts inferred holidays that have not already passed.
- Other leave and special schedules are not modeled separately.
