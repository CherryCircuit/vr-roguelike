# Music & SFX

All audio files are hosted on Cloudflare R2 and streamed at runtime.

Base URL: `https://pub-41b88aefe4524d1bb113747b0e9ba73b.r2.dev/`

## Music
| File | Description |
|------|-------------|
| `00_Main_Menu.mp3` | Main menu theme |
| `0101–0110_Levels_1-4.mp3` | Levels 1–4 tracks |
| `0201–0210_Levels_6-9.mp3` | Levels 6–9 tracks |
| `0301–0310_Levels_11-14.mp3` | Levels 11–14 tracks |
| `0401–0410_Levels_16-19.mp3` | Levels 16–19 tracks |
| `B101–B104_Level_05_Boss.mp3` | Level 5 boss tracks |
| `B201–B203_Level_10_Boss.mp3` | Level 10 boss tracks |
| `B301–B304_Level_15_Boss.mp3` | Level 15 boss tracks |
| `B401–B404_Level_20_Boss.mp3` | Level 20 boss tracks |

## SFX
| File | Description |
|------|-------------|
| `sfx_321.mp3` | 3-2-1 countdown beep |
| `sfx_5-kills-remaining.mp3` | 5 kills remaining alert |
| `sfx_10-kills-remaining.mp3` | 10 kills remaining alert |
| `sfx_15-kills-remaining.mp3` | 15 kills remaining alert |
| `sfx_game-over.mp3` | Game over music |
| `sfx_incoming-boss.mp3` | Boss arrival announcement |
| `sfx_lightning-loop.mp3` | Lightning weapon loop |
| `sfx_no-one-makes-it-to-level-20.mp3` | Name entry (died before level 20) |
| `sfx_you_made_it_to_level_20.mp3` | Name entry (reached level 20) |

## Access
Upload via rclone: `rclone copyto <file> r2:assets/<filename>`
