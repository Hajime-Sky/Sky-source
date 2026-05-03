# Experimental Scriptable Tests

This directory contains temporary Scriptable test scripts.

- `数字パーツ読み上げテスト.js`
  - Self-contained WebView test for digit-part audio playback.
  - Embeds generated m4a audio for `0`-`9`, `10`, `100`, `1000`, `時`, and `分`.
  - Tests composing seconds, minutes+seconds, and hours+minutes+seconds, then fitting playback to a target duration with `HTMLAudioElement.playbackRate`.
