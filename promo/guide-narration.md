# Guide video narration (ElevenLabs) — draft

Narration scripts for `assets/guide-en-30s.mp4` and `assets/guide-ko-30s.mp4`.
Each line is sized to fit its time slot: about 2.5 words per second in English and about 6 syllables per second in Korean.
After generating one audio clip per line, place each clip at its start time and mix into the video (no music).

| # | Slot (s) | English | 한국어 |
|---|---|---|---|
| 0 | 0.3–2.5 | Here's how to make a fair duty roster in five steps. | 다섯 단계로 공정한 당직표를 만드는 방법입니다. |
| 1a | 2.7–5.0 | First, pick the month and mark the public holidays. | 먼저 대상 연월을 고르고 공휴일을 확인합니다. |
| 1b | 5.0–7.6 | Set the rest days after a duty, and your target fairness score. | 당직 후 배정 제외일과 목표 공정성 점수를 정합니다. |
| 2a | 7.6–9.0 | Next, add your staff. | 다음으로 근무자를 입력합니다. |
| 2b | 9.0–11.8 | Type preferred or unavailable dates, and tap weekdays. | 희망일과 제외일을 쓰고, 요일 버튼을 누릅니다. |
| 2c | 11.8–14.6 | Or simply pick the days on a calendar. | 달력에서 날짜를 눌러 고를 수도 있습니다. |
| 3a | 14.6–16.4 | Check for conflicts, then click Generate. | 사전 점검을 확인하고 생성을 누릅니다. |
| 3b | 16.4–18.6 | Thousands of plans are tested in seconds. | 몇 초 만에 수천 개의 안을 시험합니다. |
| 4a | 18.6–20.0 | Compare the top three plans. | 상위 세 개 안을 비교합니다. |
| 4b | 20.0–22.0 | Click a name to see that person's duties. | 이름을 누르면 그 사람의 근무일이 보입니다. |
| 4c | 22.0–23.6 | Swap shifts by hand if you need to. | 필요하면 직접 바꿀 수 있습니다. |
| 4d | 23.6–25.2 | And check the fairness score. | 그리고 공정성 점수를 확인합니다. |
| 5a | 25.2–26.6 | Finally, print or save. | 마지막으로 출력하거나 저장합니다. |
| 5b | 26.6–28.4 | You get a one-page A4 roster. | A4 한 장 당직표가 완성됩니다. |
| end | 28.5–30.0 | Try it free — no sign-up. | 지금 무료로 써 보세요. |

Suggested voice settings: a calm, clear narrator voice; multilingual model for Korean; stability about 0.5, similarity about 0.75.
Mixing: `ffmpeg -i assets/guide-<lang>-30s.mp4 -i narration-<lang>.wav -map 0:v -map 1:a -c:v copy -af loudnorm=I=-16:TP=-1.5 -c:a aac -b:a 160k -shortest out.mp4`
