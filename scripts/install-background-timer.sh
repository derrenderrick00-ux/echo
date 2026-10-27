#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$root" == *$'\n'* || "$root" == *' '* || "$root" == *'|'* ]]; then
  echo 'For safety, move Echo to a path without spaces/newlines before installing the timer.' >&2
  exit 1
fi
if [[ ! -e "$root/scripts/background-tick.js" ]]; then
  echo 'Echo background worker missing.' >&2
  exit 1
fi
mkdir -p "$HOME/.config/systemd/user"
sed "s|__ECHO_ROOT__|$root|g" "$root/systemd/echo-background.service" > "$HOME/.config/systemd/user/echo-background.service"
cp "$root/systemd/echo-background.timer" "$HOME/.config/systemd/user/echo-background.timer"
systemctl --user daemon-reload
systemctl --user enable --now echo-background.timer
systemctl --user list-timers --all echo-background.timer
printf '\nThe timer runs approved local report jobs while your user manager is active.\n'
printf 'To keep your user manager running after logout (opt in): loginctl enable-linger "$USER"\n'
printf 'To stop: systemctl --user disable --now echo-background.timer\n'
