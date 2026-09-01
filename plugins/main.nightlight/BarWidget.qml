import QtQuick
import Quickshell
import qs.Ui
import qs.Commons

BarWidget {
  id: root
  moduleName: "main.nightlight"

  readonly property var nightlightService: bar?.shell?.serviceFor("main.nightlight") || bar?.shell?.firstPartyServiceFor("omarchy.nightlight") || bar?.shell?.serviceFor("omarchy.nightlight")
  readonly property bool enabled: nightlightService ? nightlightService.enabled : false
  readonly property int temperature: nightlightService ? (nightlightService.temperature || 6500) : 6500
  readonly property int nightTemp: nightlightService ? nightlightService.nightTemperature : 4000
  readonly property int minTemp: nightlightService ? nightlightService.minTemperature : 2500
  readonly property int maxTemp: nightlightService ? nightlightService.maxTemperature : 6500

  property bool popupOpen: false
  function close() { popupOpen = false }

  // Slider value is night temperature (intensity) - lower = warmer
  property int sliderValue: nightTemp

  // keep slider in sync when service changes externally (but not while dragging)
  onNightTempChanged: if (!tempSlider.dragging) sliderValue = nightTemp

  visible: true
  implicitWidth: row.implicitWidth + Style.space(12)
  implicitHeight: barSize

  Row {
    id: row
    anchors.centerIn: parent
    spacing: Style.space(6)

    Text {
      id: glyph
      text: "󰔎"
      color: root.enabled ? root.bar.barForeground : Qt.darker(root.bar.barForeground, 1.6)
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
      anchors.verticalCenter: parent.verticalCenter
      opacity: root.enabled ? 1.0 : 0.6
      Behavior on color { ColorAnimation { duration: 160 } }
    }

    Text {
      id: label
      visible: !root.bar.vertical
      text: root.enabled ? (root.nightTemp + "K") : (root.temperature + "K")
      color: root.bar.barForeground
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.bodySmall
      anchors.verticalCenter: parent.verticalCenter
      opacity: 0.85
    }
  }

  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    acceptedButtons: Qt.LeftButton | Qt.RightButton

    onClicked: function(mouse) {
      if (mouse.button === Qt.RightButton) {
        root.popupOpen = !root.popupOpen
      } else {
        if (root.nightlightService) root.nightlightService.toggle()
      }
    }
    onWheel: function(wheel) {
      // wheel adjusts intensity by 100K
      var delta = wheel.angleDelta.y > 0 ? 100 : -100
      var next = Math.max(root.minTemp, Math.min(root.maxTemp, root.sliderValue + delta))
      root.sliderValue = next
      if (root.nightlightService) root.nightlightService.setTemperatureAndApply(next)
    }
    onEntered: if (root.bar) root.bar.showTooltip(root, (root.enabled ? "Night light on — " : "Night light off — ") + root.temperature + "K (click toggle, right-click slider, scroll intensity)")
    onExited: if (root.bar) root.bar.hideTooltip(root)
  }

  PopupCard {
    id: popup
    anchorItem: root
    bar: root.bar
    owner: root
    open: root.popupOpen
    contentWidth: popup.fittedContentWidth(Style.space(360))
    contentHeight: popup.fittedContentHeight(column.implicitHeight)

    Column {
      id: column
      anchors.fill: parent
      spacing: Style.space(12)

      Row {
        width: parent.width
        spacing: Style.space(10)

        Text {
          text: "󰔎"
          color: root.bar.foreground
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.display
          anchors.verticalCenter: parent.verticalCenter
        }

        Column {
          width: parent.width - Style.space(40)
          spacing: Style.space(2)
          anchors.verticalCenter: parent.verticalCenter

          Text {
            text: root.enabled ? "Night Light On" : "Night Light Off"
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.subtitle
            font.bold: true
          }
          Text {
            text: "19:00 — 07:00 auto  •  click icon to toggle"
            color: Qt.darker(root.bar.foreground, 1.4)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
            width: parent.width
          }
        }
      }

      PanelSeparator { foreground: root.bar.foreground }

      Column {
        width: parent.width
        spacing: Style.space(6)

        Row {
          width: parent.width
          spacing: Style.space(6)
          anchors.verticalCenter: parent.verticalCenter

          Text {
            text: "INTENSITY"
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            font.letterSpacing: 1.0
            anchors.verticalCenter: parent.verticalCenter
          }
          Item { width: Style.space(6); height: 1 }
          Text {
            text: root.sliderValue + "K"
            color: Qt.darker(root.bar.foreground, 1.2)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            anchors.verticalCenter: parent.verticalCenter
          }
          Text {
            text: root.sliderValue <= 3500 ? "warm" : root.sliderValue <= 5000 ? "neutral" : "cool"
            color: Qt.darker(root.bar.foreground, 1.6)
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.caption
            anchors.verticalCenter: parent.verticalCenter
          }
          Item { width: Style.space(12); height: 1 }
        }

        PanelSlider {
          id: tempSlider
          bar: root.bar
          width: parent.width
          minimum: root.minTemp
          maximum: root.maxTemp
          step: 100
          integer: true
          value: root.sliderValue
          onMoved: function(v) {
            root.sliderValue = Math.round(v)
            // live preview without persisting every tick? we persist on release, but do live apply
            if (root.nightlightService) root.nightlightService.applyTemperature(Math.round(v))
          }
          onReleased: function(v) {
            var t = Math.round(v)
            root.sliderValue = t
            if (root.nightlightService) root.nightlightService.setTemperatureAndApply(t)
          }
        }

        Item {
          width: parent.width
          height: warmLabel.implicitHeight
          Text { id: warmLabel; text: "Warm 2500K"; color: Qt.darker(root.bar.foreground, 1.5); font.pixelSize: Style.font.caption; font.family: root.bar.fontFamily; anchors.left: parent.left; anchors.verticalCenter: parent.verticalCenter }
          Text { text: "Cool 6500K"; color: Qt.darker(root.bar.foreground, 1.5); font.pixelSize: Style.font.caption; font.family: root.bar.fontFamily; anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter }
        }
      }

      Row {
        anchors.horizontalCenter: parent.horizontalCenter
        spacing: Style.space(8)
        Button {
          iconText: "󰒮"
          text: "Day 6500K"
          foreground: root.bar.foreground
          onClicked: if (root.nightlightService) { root.nightlightService.setTemperatureAndApply(6500); root.sliderValue = 6500 }
        }
        Button {
          iconText: "󰔎"
          text: root.enabled ? "Disable" : "Enable"
          foreground: root.bar.foreground
          onClicked: if (root.nightlightService) root.nightlightService.toggle()
        }
      }
    }
  }
}
