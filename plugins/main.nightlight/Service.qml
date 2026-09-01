import QtQuick
import Quickshell
import Quickshell.Io
import "NightlightModel.js" as NightlightModel

Item {
  id: root

  // Injected by omarchy-shell (the first-party service loader).
  property var shell: null

  // Keep in sync with bin/omarchy-toggle-nightlight, which sets the same
  // temperatures for callers outside the shell (keybindings, menu, ssh).
  property int nightTemperature: 4000
  readonly property int dayTemperature: 6500
  readonly property int minTemperature: 2500
  readonly property int maxTemperature: 6500

  property bool stateLoaded: false
  property var temperature: null
  readonly property bool enabled: stateLoaded && NightlightModel.isNightlight(temperature)

  property bool hasPendingTemperature: false
  property int pendingTemperature: 0

  function refresh() {
    if (!statusProbe.running) statusProbe.running = true
  }

  function setNightlight(value) {
    applyTemperature(value ? nightTemperature : dayTemperature)
  }

  function toggle() {
    setNightlight(!enabled)
  }

  function clampTemperature(t) {
    var v = Number(t)
    if (isNaN(v)) return nightTemperature
    return Math.max(minTemperature, Math.min(maxTemperature, Math.round(v)))
  }

  function setTemperature(temp) {
    var t = clampTemperature(temp)
    nightTemperature = t
    // persist for 19:00 profile so automation keeps chosen intensity
    persistNightTemperature(t)
    if (enabled) {
      applyTemperature(t)
    }
    // also allow adjusting while in day mode -> preview immediately
    // if user wants to test intensity, apply even when disabled
    // keep enabled logic: caller decides via enabled check, but provide direct apply
  }

  function setTemperatureAndApply(temp) {
    var t = clampTemperature(temp)
    nightTemperature = t
    persistNightTemperature(t)
    applyTemperature(t)
  }

  function persistNightTemperature(temp) {
    var t = clampTemperature(temp)
    var script = Quickshell.env("HOME") + "/.config/omarchy/plugins/main.nightlight/persist.sh"
    persistProcess.command = [script, String(t)]
    persistProcess.running = true
  }

  function applyTemperature(temp) {
    root.temperature = temp
    root.stateLoaded = true

    if (applyProcess.running) {
      root.pendingTemperature = temp
      root.hasPendingTemperature = true
      return
    }

    runApply(temp)
  }

  function runApply(temp) {
    applyProcess.command = ["bash", "-lc",
      "pgrep -x hyprsunset >/dev/null || { setsid uwsm-app -- hyprsunset >/dev/null 2>&1 & sleep 1; }; " +
      "hyprctl hyprsunset temperature " + Number(temp)]
    applyProcess.running = true
  }

  Process {
    id: persistProcess
  }

  Process {
    id: statusProbe
    command: ["hyprctl", "hyprsunset", "temperature"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.temperature = NightlightModel.temperatureFromOutput(text)
        root.stateLoaded = true
      }
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) {
        root.temperature = null
        root.stateLoaded = true
      }
    }
  }

  Process {
    id: applyProcess
    onExited: function() {
      if (root.hasPendingTemperature) {
        root.hasPendingTemperature = false
        root.runApply(root.pendingTemperature)
        return
      }

      root.refresh()
    }
  }

  function loadPersistedNightTemperature() {
    // read hyprsunset.conf 19:00 temperature if present
    loadProbe.running = true
  }

  Process {
    id: loadProbe
    command: ["bash", "-lc", "grep -A2 'time = 19:00' \"$HOME/.config/hypr/hyprsunset.conf\" 2>/dev/null | grep -oE '[0-9]+' | head -n1"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var t = Number(String(text).trim())
        if (!isNaN(t) && t >= root.minTemperature && t <= root.maxTemperature) {
          root.nightTemperature = t
        }
        // also alias for backward-compat omarchy.nightlight
        if (root.shell) {
          var next = {}
          for (var k in root.shell._services) next[k] = root.shell._services[k]
          next["omarchy.nightlight"] = root
          next["main.nightlight"] = root
          root.shell._services = next
        }
      }
    }
  }

  Component.onCompleted: {
    refresh()
    loadPersistedNightTemperature()
  }

  onShellChanged: {
    if (shell) {
      var next2 = {}
      for (var k in shell._services) next2[k] = shell._services[k]
      next2["omarchy.nightlight"] = root
      next2["main.nightlight"] = root
      shell._services = next2
    }
  }

  IpcHandler {
    target: "nightlight"

    function status(): string {
      return JSON.stringify({ enabled: root.enabled, temperature: root.temperature, nightTemperature: root.nightTemperature, minTemperature: root.minTemperature, maxTemperature: root.maxTemperature })
    }

    function refresh(): void {
      root.refresh()
    }

    function enable(): string {
      root.setNightlight(true)
      return "enabled"
    }

    function disable(): string {
      root.setNightlight(false)
      return "disabled"
    }

    function toggle(): string {
      var enabling = !root.enabled
      root.setNightlight(enabling)
      return enabling ? "enabled" : "disabled"
    }

    function temperature(temp: string): string {
      var t = Number(temp)
      if (isNaN(t)) return JSON.stringify({ error: "invalid temperature", temperature: root.temperature })
      root.setTemperatureAndApply(t)
      return JSON.stringify({ temperature: t, enabled: root.enabled })
    }

    function setTemperature(temp: string): string {
      return temperature(temp)
    }

    function setNightTemperature(temp: string): string {
      return temperature(temp)
    }
  }
}
