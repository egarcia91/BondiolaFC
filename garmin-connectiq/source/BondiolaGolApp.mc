import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

//! Demo: marcador Rojo vs Azul. Próximo paso: Companion + mensajes JSON alineados con `golesAnotadores` en Firestore.
class BondiolaGolApp extends Application.AppBase {
  private var _rojo as Number;
  private var _azul as Number;
  private var _historial as Array<Number>;

  function initialize() {
    AppBase.initialize();
    _rojo = 0;
    _azul = 0;
    _historial = [] as Array<Number>;
  }

  function onStart(state as Dictionary?) as Void {}

  function onStop(state as Dictionary?) as Void {}

  function getInitialView() {
    return [new BondiolaGolView(), new BondiolaGolDelegate()];
  }

  function getRojo() as Number {
    return _rojo;
  }

  function getAzul() as Number {
    return _azul;
  }

  function addGolRojo() as Void {
    _rojo++;
    _historial.add(0);
  }

  function addGolAzul() as Void {
    _azul++;
    _historial.add(1);
  }

  function revertirUltimo() as Void {
    if (_historial.size() == 0) {
      return;
    }
    var ultimo = _historial[_historial.size() - 1];
    _historial = _historial.slice(0, _historial.size() - 1);
    if (ultimo == 0) {
      if (_rojo > 0) {
        _rojo--;
      }
    } else {
      if (_azul > 0) {
        _azul--;
      }
    }
  }

}

class BondiolaGolView extends WatchUi.View {
  function initialize() {
    View.initialize();
  }

  function onLayout(dc as Dc) as Void {}

  function onUpdate(dc as Dc) as Void {
    dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
    dc.clear();
    dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);

    var app = Application.getApp() as BondiolaGolApp;
    var r = app.getRojo();
    var a = app.getAzul();

    var w = dc.getWidth();
    var h = dc.getHeight();
    var yMid = h / 2 - 24;
    var line = r.toString() + " - " + a.toString();

    dc.drawText(w / 2, 18, Graphics.FONT_TINY, "Bondiola FC", Graphics.TEXT_JUSTIFY_CENTER);
    dc.drawText(w / 2, yMid, Graphics.FONT_NUMBER_HOT, line, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

    dc.drawText(w * 0.28, yMid + 40, Graphics.FONT_XTINY, "Rojo", Graphics.TEXT_JUSTIFY_CENTER);
    dc.drawText(w * 0.72, yMid + 40, Graphics.FONT_XTINY, "Azul", Graphics.TEXT_JUSTIFY_CENTER);

    dc.drawText(w / 2, h - 52, Graphics.FONT_TINY, "MENU / START / tocar", Graphics.TEXT_JUSTIFY_CENTER);
    dc.drawText(w / 2, h - 32, Graphics.FONT_TINY, "para anotar gol", Graphics.TEXT_JUSTIFY_CENTER);
  }
}

class GolMenuDelegate extends WatchUi.Menu2InputDelegate {
  function initialize() {
    Menu2InputDelegate.initialize();
  }

  function onSelect(item as WatchUi.MenuItem) as Void {
    var app = Application.getApp() as BondiolaGolApp;
    var id = item.getId();

    if (id == :gol_rojo) {
      app.addGolRojo();
    } else if (id == :gol_azul) {
      app.addGolAzul();
    } else if (id == :revertir) {
      app.revertirUltimo();
    }

    WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
    WatchUi.requestUpdate();
  }

  function onBack() as Void {
    WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
  }
}

class BondiolaGolDelegate extends WatchUi.BehaviorDelegate {
  function initialize() {
    BehaviorDelegate.initialize();
  }

  function openGolMenu() as Void {
    var menu = new WatchUi.Menu2({:title => "Gol"});
    menu.addItem(new WatchUi.MenuItem("Gol Rojo", "equipo local", :gol_rojo, {}));
    menu.addItem(new WatchUi.MenuItem("Gol Azul", "visitante", :gol_azul, {}));
    menu.addItem(new WatchUi.MenuItem("Revertir ultimo", "", :revertir, {}));
    WatchUi.pushView(menu, new GolMenuDelegate(), WatchUi.SLIDE_UP);
  }

  function onMenu() as Boolean {
    openGolMenu();
    return true;
  }

  function onSelect() as Boolean {
    openGolMenu();
    return true;
  }

  function onTap(clickEvent as WatchUi.ClickEvent) as Boolean {
    openGolMenu();
    return true;
  }
}
