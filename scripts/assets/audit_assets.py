"""Audit public/assets against 13_IMAGE_PROMPTS.md / 14_ASSET_MANIFEST.md."""
import json
from pathlib import Path

PUBLIC = Path(r"C:\Users\pasha\Desktop\Echo Tower\public")

HEROES = ["belquist","iria","morvain","cassian","sylvana","tess","orpheus","nira","garm","lian","selena","dorn","mirella","kai","vale","astra","rock","fenn","yuki","bran","thorn","pip","lissa","grom","neya","kron","zip","mara","ugolyok","strela","briz","ten"]
ENEMY_FAMILIES = ["shards","hounds","frost-priests","ash-legion","rot-gardeners","lightbearers","echo-doubles","tower-machines"]
BOSSES = ["warden","glass-choir","frost-mother","ash-knight","rot-smith","master-double","light-keeper","silent-master","archivist","tower-heart","oblivion-tree","nira-reflection"]
CURRENCY = ["gold","crystal","seal","shards","essence","dust","key","arena","marks"]
STATS = ["hp","atk","def","spd","crit","cdmg","er","lifesteal","elem","dr","heal","shield"]

groups = {}

groups["A. Ключевой арт (10)"] = [
    "assets/marketing/keyart-main.webp","assets/marketing/keyart-portrait.webp","assets/marketing/cover-yandex.webp",
    "assets/marketing/cover-crazy.webp","assets/marketing/cover-poki.webp","assets/marketing/app-icon.webp",
    "assets/marketing/tg-avatar.webp","assets/marketing/season-banner.webp","assets/marketing/store-bg-portrait.webp",
    "assets/marketing/poster-choice.webp",
]
groups["Бренд (6)"] = [f"assets/brand/{n}.webp" for n in ["logo","logo-ru","emblem","loading","favicon","social"]]
groups["B. Лобби и окружение (8)"] = [
    f"assets/bg/{n}.webp" for n in ["lobby-tower","title","altar","barracks","forge","archive","rift-map","arena"]
]
groups["C. Фоны боя (10)"] = [f"assets/bg/battle/ch{i:02d}.webp" for i in range(1, 11)]
groups["D. Карточки героев (32)"] = [f"assets/heroes/{h}/card.webp" for h in HEROES]
groups["E. Портреты (32)"] = [f"assets/heroes/{h}/portrait.webp" for h in HEROES]
groups["E. Спрайты героев (32)"] = [f"assets/heroes/{h}/sprite.webp" for h in HEROES]
groups["F. Боссы (12)"] = [f"assets/enemies/boss/{b}.webp" for b in BOSSES]
groups["G. Враги (24)"] = [f"assets/enemies/{f}/{v}.webp" for f in ENEMY_FAMILIES for v in ("a","b","c")]
groups["UI: панели/кнопки (18)"] = [f"assets/ui/{n}.webp" for n in ["panel","panel-inner","btn-primary","btn-gold","btn-danger","card-frame","star","hex-slot","hex-slot-active","hp-bar","hp-bar-boss","energy-orb","tabbar","resource-pill","modal","toast","btn-back","lock"]]
groups["UI: иконки статов (12)"] = [f"assets/ui/icons/{s}.webp" for s in STATS]
groups["UI: валюта (9)"] = [f"assets/ui/currency/{c}.webp" for c in CURRENCY]
groups["VFX (10)"] = [f"assets/vfx/{n}.webp" for n in ["slash","ult-burst","heal","shield","shatter","echo-summon","crit","death-ash","star-up","portal"]]
groups["Звук: музыка (3)"] = [f"assets/audio/music/{n}.ogg" for n in ["lobby","battle","boss"]]
groups["Звук: SFX (10)"] = [f"assets/audio/sfx/{n}.ogg" for n in ["ui-click","ui-error","coin","hit","crit","ult","heal","shatter","star-up","summon"]]
groups["Шрифты (4)"] = [f"assets/fonts/{n}.woff2" for n in ["oswald-600","oswald-700","manrope-500","manrope-700"]]

total_expected = 0
total_have = 0
lines = []
for name, paths in groups.items():
    have = sum(1 for p in paths if (PUBLIC / p).exists())
    total_expected += len(paths)
    total_have += have
    mark = "OK " if have == len(paths) else "   "
    lines.append(f"{mark}{name}: {have}/{len(paths)}")

lines.append("")
lines.append(f"ИТОГО: {total_have}/{total_expected} файлов")

print("\n".join(lines))
