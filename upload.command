#!/bin/bash
# Dubbelklik dit bestand om je game-wijzigingen naar GitHub te uploaden.
cd "$(dirname "$0")" || exit 1

echo "🎮 Sumo Beach Volley - uploaden naar GitHub..."
echo ""

git add -A

if git diff --cached --quiet; then
  echo "✅ Geen wijzigingen om te uploaden. Alles is al online."
else
  STAMP=$(date "+%d-%m-%Y %H:%M")
  git commit -q -m "Update $STAMP"
  if git push -q origin main; then
    echo "✅ Klaar! Je game is geüpload."
    echo "📱 Speel op: https://vz5qwyx5yj-netizen.github.io/sumovolleyball-/"
  else
    echo "❌ Uploaden mislukt. Check je internetverbinding."
  fi
fi

echo ""
echo "Je kunt dit venster sluiten."
