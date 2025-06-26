const { app, BrowserWindow, ipcMain } = require('electron');
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.on('imprimir-pedido', async (event, pedido) => {
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'usb',
  });

  printer.alignCenter();
  printer.println("🎤 SENHA DO KARAOKÊ 🎶");
  printer.drawLine();
  printer.println(`Senha: ${pedido.senha}`);
  printer.println(`Nome: ${pedido.nome}`);
  if (pedido.musica) printer.println(`Música: ${pedido.musica}`);
  printer.drawLine();
  printer.cut();

  try {
    let success = await printer.execute();
    if (success) console.log("Impressão enviada!");
    else console.error("Erro ao imprimir");
  } catch (error) {
    console.error("Erro:", error);
  }
});
