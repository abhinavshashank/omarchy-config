#!/bin/bash
TEMP="$1"
CONF="$HOME/.config/hypr/hyprsunset.conf"
if grep -q 'time = 19:00' "$CONF" 2>/dev/null; then
  # replace existing temperature line after 19:00 block
  sed -i "s/temperature = .*/temperature = $TEMP/" "$CONF"
else
  printf "\nprofile {\n    time = 19:00\n    temperature = %s\n}\n" "$TEMP" >> "$CONF"
fi
echo "persisted $TEMP to $CONF"
