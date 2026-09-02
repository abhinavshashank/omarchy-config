import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

// World Clock bar pill — shows saved city time on the bar.
// Click to open the world map panel. Right-click cycles primary city.
BarWidget {
  id: root
  moduleName: "main.worldclock"

  property date now: new Date()
  readonly property var primary: Model.parsePrimary(setting("primary", null), Model.DEFAULT_PRIMARY)
  readonly property var worldClocks: Model.parseWorldClocks(setting("worldClocks", null), Model.DEFAULT_WORLD_CLOCKS)
  readonly property var primaryData: Model.primaryEntry(now, primary)
  readonly property string displayText: primaryData ? primaryData.label + " " + primaryData.time : "—"

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  function open() { if (panelLoader.item) panelLoader.item.open() }
  function close() { if (panelLoader.item) panelLoader.item.close() }
  function togglePanel() { if (panelLoader.item) panelLoader.item.toggle() }
  function cyclePrimary() {
    var clocks = worldClocks
    if (!clocks.length) return
    var idx = -1
    for (var i=0;i<clocks.length;i++) if (clocks[i].timeZone === primary.timeZone && clocks[i].label === primary.label) idx=i
    var next = clocks[(idx+1)%clocks.length]
    var entry = { id: root.moduleName }
    for (var k in root.settings) if (k!=="id") entry[k]=root.settings[k]
    entry["primary"] = { label: next.label, timeZone: next.timeZone, lat: next.lat, lon: next.lon }
    root.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline==="function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function injectPanel() {
    var t = panelLoader.item
    if (!t) return
    if ("bar" in t) t.bar = root.bar
    if ("settings" in t) t.settings = root.settings
    if ("anchorItem" in t) t.anchorItem = button
    if ("hostWidget" in t) t.hostWidget = root
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight
  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
    onDateChanged: root.now = date
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: { root.injectPanel(); Qt.callLater(root.injectPanel) }
  }

  IpcHandler {
    target: "main.worldclock"
    function open(): void { root.open() }
    function close(): void { root.close() }
    function toggle(): void { root.togglePanel() }
    function refresh(): void { root.now = new Date() }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.displayText
    hasVisualContent: text !== ""
    horizontalMargin: 10

    onPressed: function(b) {
      if (b === Qt.RightButton) root.cyclePrimary()
      else root.togglePanel()
    }
  }
}
