import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Beautiful World Clock panel — bar pill + popup with world map and all zones
Panel {
  id: root
  moduleName: "main.worldclock"
  ipcTarget: "main.worldclock"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  property date now: new Date()
  readonly property var worldClocks: Model.parseWorldClocks(setting("worldClocks", null), Model.DEFAULT_WORLD_CLOCKS)
  readonly property var primary: Model.parsePrimary(setting("primary", null), Model.DEFAULT_PRIMARY)
  readonly property var entries: Model.worldClockEntries(now, worldClocks)
  readonly property var primaryData: Model.primaryEntry(now, primary)

  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family

  function open() { root.now = new Date(); root.controller.show(); Qt.callLater(function(){ if(root.opened) setCenterHoverRevealSuppressed(true) }) }
  function close() { setCenterHoverRevealSuppressed(false); root.controller.hide() }
  function toggle() { if (root.opened) root.close(); else root.open() }
  function switchPanel(d) { if (root.bar && typeof root.bar.switchPanelFrom==="function") return root.bar.switchPanelFrom(root.barIdentity, d); return false }
  function setCenterHoverRevealSuppressed(v) { if (root.bar && "centerHoverRevealSuppressed" in root.bar) root.bar.centerHoverRevealSuppressed = v }

  SystemClock { id: clock; precision: SystemClock.Minutes; onDateChanged: root.now = date }

  function setPrimary(entry) {
    var e = { id: root.moduleName }
    for (var k in root.settings) if (k!=="id") e[k]=root.settings[k]
    e["primary"] = { label: entry.label, timeZone: entry.timeZone, lat: entry.lat, lon: entry.lon }
    root.settings = e
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = e
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline==="function")
      root.bar.shell.updateEntryInline(root.moduleName, e)
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(640))
    contentHeight: panel.fittedContentHeight(col.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(d){ root.switchPanel(d) }

      Flickable {
        anchors.fill: parent
        contentWidth: col.width
        contentHeight: col.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height

        Column {
          id: col
          width: Style.space(620)
          spacing: Style.space(14)

          // Header
          Item {
            width: parent.width
            height: 56
            Row {
              anchors.centerIn: parent
              spacing: Style.space(12)
              Text { text: "󰃭"; color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: 28; anchors.verticalCenter: parent.verticalCenter }
              Column {
                anchors.verticalCenter: parent.verticalCenter
                Text { text: "WORLD CLOCK"; color: Qt.darker(root.contentForeground, 1.4); font.family: root.contentFontFamily; font.pixelSize: Style.font.caption; font.letterSpacing: 2; font.bold: true }
                Text {
                  text: primaryData ? primaryData.label + " · " + primaryData.time + " · " + primaryData.offset : ""
                  color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: Style.font.title; font.bold: true
                }
              }
            }
          }

          // Map — stylized world with city pins positioned by lon/lat
          Rectangle {
            id: map
            anchors.horizontalCenter: parent.horizontalCenter
            width: parent.width - Style.space(24)
            height: Style.space(220)
            radius: Style.cornerRadius
            color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06)
            border.width: Style.spacing.hairline
            border.color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.10)

            // Subtle grid lines
            Canvas {
              anchors.fill: parent
              onPaint: {
                var ctx = getContext("2d")
                ctx.clearRect(0,0,width,height)
                ctx.strokeStyle = Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.07)
                ctx.lineWidth = 1
                // Vertical meridians
                for (var x=0;x<width;x+=width/6) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke() }
                // Horizontal
                for (var y=0;y<height;y+=height/4) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke() }
                // Equator highlight
                ctx.strokeStyle = Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.25)
                ctx.beginPath(); ctx.moveTo(0,height/2); ctx.lineTo(width,height/2); ctx.stroke()
              }
            }

            // Day/night terminator — simple vertical line at UTC noon
            Rectangle {
              width: 2; height: parent.height; color: Color.accent; opacity: 0.18
              x: {
                var utcH = root.now.getUTCHours() + root.now.getUTCMinutes()/60
                var lon = (utcH - 12) * 15 // noon lon
                return ((lon + 180)/360)*parent.width
              }
            }

            // City pins
            Repeater {
              model: root.entries
              delegate: Item {
                required property var modelData
                width: 1; height: 1
                // lon -180..180 -> x 0..width, lat 90..-90 -> y 0..height
                x: {
                  var lon = modelData.lon
                  if (lon===undefined || lon===null) lon = (modelData.offset ? parseInt(modelData.offset.replace("UTC",""))*15 : 0)
                  return ((lon + 180)/360)*map.width
                }
                y: {
                  var lat = modelData.lat
                  if (lat===undefined || lat===null) lat = 20
                  return ((90 - lat)/180)*map.height
                }

                Rectangle {
                  anchors.centerIn: parent
                  width: modelData.label === root.primary.label ? 14 : 10
                  height: width
                  radius: width/2
                  color: modelData.label === root.primary.label ? Color.accent : Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.9)
                  border.width: 2
                  border.color: Qt.rgba(1,1,1,0.9)
                  // Pulse for primary
                  SequentialAnimation on opacity {
                    running: modelData.label === root.primary.label
                    loops: Animation.Infinite
                    NumberAnimation { from: 1; to: 0.6; duration: 900; easing.type: Easing.InOutQuad }
                    NumberAnimation { from: 0.6; to: 1; duration: 900; easing.type: Easing.InOutQuad }
                  }
                }
                // Label
                Rectangle {
                  anchors.horizontalCenter: parent.horizontalCenter
                  anchors.top: parent.top
                  anchors.topMargin: 12
                  width: label.implicitWidth + 8
                  height: label.implicitHeight + 4
                  radius: 4
                  color: Qt.rgba(0,0,0,0.65)
                  visible: true
                  Text {
                    id: label
                    anchors.centerIn: parent
                    text: modelData.label
                    color: "white"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption - 1
                    font.bold: true
                  }
                }
                // Time tooltip on hover
                MouseArea {
                  anchors.centerIn: parent
                  width: 22; height: 22
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.setPrimary(modelData)
                  PanelToolTip {
                    visible: parent.containsMouse
                    text: modelData.label + " " + modelData.time + " " + modelData.offset
                    fontFamily: root.contentFontFamily
                  }
                }
              }
            }

            // Map caption
            Text {
              anchors.bottom: parent.bottom
              anchors.horizontalCenter: parent.horizontalCenter
              anchors.bottomMargin: 6
              text: "Click a pin to set bar time · terminator shows night/day"
              color: Qt.darker(root.contentForeground, 1.8)
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption - 1
            }
          }

          // Primary detail
          Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            width: parent.width - Style.space(24)
            height: Style.space(64)
            radius: Style.cornerRadius
            color: Style.selectedStateColor(root.contentForeground, Color.accent)
            border.width: Style.spacing.hairline
            border.color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08)

            Row {
              anchors.fill: parent
              anchors.leftMargin: Style.space(16)
              anchors.rightMargin: Style.space(16)
              spacing: Style.space(12)

              Column {
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width * 0.55
                Text { text: primaryData ? primaryData.label : ""; color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: Style.font.body; font.bold: true }
                Text { text: primaryData ? primaryData.timeZone + " · " + primaryData.offset : ""; color: Qt.darker(root.contentForeground, 1.5); font.family: root.contentFontFamily; font.pixelSize: Style.font.caption; elide: Text.ElideRight; width: parent.width }
              }
              Item { width: Style.space(8); height: 1 }
              Column {
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width * 0.45 - Style.space(8)
                Text {
                  anchors.right: parent.right
                  text: primaryData ? primaryData.time : ""
                  color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: 32; font.bold: true
                  horizontalAlignment: Text.AlignRight; width: parent.width
                }
                Text {
                  anchors.right: parent.right
                  text: primaryData ? primaryData.weekday + " " + primaryData.dateLabel + (primaryData.delta!==0 ? (primaryData.delta>0?" +"+primaryData.delta+"d":" "+primaryData.delta+"d"):"") : ""
                  color: primaryData && primaryData.delta!==0 ? Color.accent : Qt.darker(root.contentForeground, 1.5)
                  font.family: root.contentFontFamily; font.pixelSize: Style.font.caption; horizontalAlignment: Text.AlignRight; width: parent.width
                }
              }
            }
          }

          // World grid
          Grid {
            anchors.horizontalCenter: parent.horizontalCenter
            width: parent.width - Style.space(24)
            columns: 2
            columnSpacing: Style.space(8)
            rowSpacing: Style.space(8)

            Repeater {
              model: root.entries
              delegate: Rectangle {
                required property var modelData
                width: (parent.width - Style.space(8))/2
                height: Style.space(72)
                radius: Style.cornerRadius
                color: modelData.label === root.primary.label ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.12) : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06)
                border.width: modelData.label === root.primary.label ? 1 : Style.spacing.hairline
                border.color: modelData.label === root.primary.label ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08)

                MouseArea {
                  anchors.fill: parent
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.setPrimary(modelData)
                  hoverEnabled: true
                }

                Column {
                  anchors.fill: parent
                  anchors.margins: Style.space(10)
                  spacing: 2
                  Row {
                    width: parent.width
                    Text {
                      text: modelData.label
                      color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: Style.font.body; font.bold: true
                      width: parent.width - timeText.width - Style.space(6)
                      elide: Text.ElideRight
                    }
                    Text {
                      id: timeText
                      text: modelData.time
                      color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: Style.font.body; font.bold: true
                    }
                  }
                  Text {
                    text: modelData.timeZone + " · " + modelData.offset
                    color: Qt.darker(root.contentForeground, 1.6); font.family: root.contentFontFamily; font.pixelSize: Style.font.caption; width: parent.width; elide: Text.ElideRight
                  }
                  Text {
                    text: modelData.weekday + " " + modelData.dateLabel + (modelData.delta!==0 ? (modelData.delta>0?" +"+modelData.delta+"d":" "+modelData.delta+"d"):"")
                    color: modelData.delta!==0 ? Color.accent : Qt.darker(root.contentForeground, 1.5); font.family: root.contentFontFamily; font.pixelSize: Style.font.caption
                  }
                }
              }
            }
          }

          Text {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            text: "Right-click bar pill to cycle cities · Click a card or pin to set primary"
            color: Qt.darker(root.contentForeground, 2.0)
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
            anchors.horizontalCenter: parent.horizontalCenter
          }
        }
      }
    }
  }
}
