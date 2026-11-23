# Guide video narration (ElevenLabs)

Narration for `assets/guide-en-30s.mp4` and `assets/guide-ko-30s.mp4`.
Each caption has one short line, generated as a separate clip with ElevenLabs (`eleven_v4`) and saved as `narration/<lang>-<key>.mp3`.
`python3 promo/narrate.py <lang>` places the clips on the timeline and muxes them into the video (see `promo/README.md`).
The actual placement of each line is written to `narration/plan-<lang>.json`.

- English voice: Andrew – Clear & Trustworthy (`WIi4Wzyjc860r5dZ3gjK`)
- Korean voice: Hani – warm, intelligent, trustworthy, gentle (`Ldr6pbPAWs2LIP4OPHYn`)

| Key | Caption starts (s) | English | 한국어 |
|---|---|---|---|
| 00 | 0.4 | Five steps to a fair duty roster. | 공정한 당직표, 다섯 단계면 됩니다. |
| 1a | 2.7 | Pick the month, and mark the holidays. | 연월을 고르고, 공휴일을 확인합니다. |
| 1b | 5.0 | Set rest days, and a target fairness score. | 배정 제외일과 목표 점수를 정합니다. |
| 2a | 7.6 | Add your staff. | 근무자를 입력합니다. |
| 2b | 9.0 | Type preferred dates, and tap weekdays. | 희망일을 쓰고, 요일 버튼을 누릅니다. |
| 2c | 11.8 | Or pick the days on a calendar. | 달력에서 고를 수도 있습니다. |
| 3a | 14.6 | Check, then generate. | 점검 후, 생성을 누릅니다. |
| 3b | 16.4 | Thousands of plans, in seconds. | 몇 초 만에 수천 개 안을 시험합니다. |
| 4a | 18.6 | Compare the top three. | 상위 세 안을 비교합니다. |
| 4b | 20.0 | Click a name to see their duties. | 이름을 누르면 근무일이 보입니다. |
| 4c | 22.0 | Swap shifts if needed. | 직접 바꿀 수도 있습니다. |
| 4d | 23.6 | Check the fairness score. | 공정성 점수를 확인합니다. |
| 5a | 25.2 | Then print, or save. | 출력하거나 저장합니다. |
| 5b | 26.6 | A one-page A4 roster. | 에이포 한 장 당직표, 완성. |
| zz | 28.6 | Try it free. | 지금 무료로 써 보세요. |
