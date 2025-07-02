const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');
const PDFDocument = require('pdfkit');
const { getPrinters, print } = require('pdf-to-printer');

const store = new Store();
let mainWindow;
let settingsWindow;

// --- Funções de janela (não mudam, estão corretas) ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900, height: 600, webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  mainWindow.loadFile('index.html');
}

function createSettingsWindow() {
  if (settingsWindow) { settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 500, height: 350, parent: mainWindow, modal: true, webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.on('closed', () => { settingsWindow = null; });
}
// --------------------------------------------------------

app.whenReady().then(createMainWindow);

ipcMain.on('open-settings-window', createSettingsWindow);
ipcMain.on('close-settings-window', () => settingsWindow?.close());

ipcMain.handle('get-printers', async () => {
  try { return await getPrinters(); } catch (error) { console.error("Falha ao buscar impressoras:", error); return []; }
});

ipcMain.handle('get-current-settings', () => { return store.get('printerConfig'); });

ipcMain.on('save-settings', (event, config) => { store.set('printerConfig', config); });

// =======================================================================
// A LÓGICA DE IMPRESSÃO FINAL, GERANDO UM PDF
// =======================================================================
ipcMain.on('imprimir-pedido', async (event, pedido) => {
  const printerConfigSaved = store.get('printerConfig');
  if (!printerConfigSaved || !printerConfigSaved.printerName) {
    return dialog.showErrorBox('Impressora não configurada', 'Vá em "Configurações" e selecione uma impressora.');
  }

  // Crie um documento PDF em memória
  const doc = new PDFDocument({
    size: [200, 300], // Tamanho aproximado de um cupom térmico (80mm de largura)
    margins: { top: 0, bottom: 0, left: 30, right: 5 }
  });

  const tempFilePath = path.join(os.tmpdir(), `karaoke-print-${Date.now()}.pdf`);
  const stream = fs.createWriteStream(tempFilePath);
  doc.pipe(stream);

  // Adicione o conteúdo ao PDF
  doc.font('Helvetica-Bold').fontSize(15).text('SENHA DO KARAOKÊ', { align: 'justify' });
  doc.moveDown(0.5);
  
  doc.fontSize(50).text(pedido.senha, { align: 'center' });
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(15).text(`Nome: ${pedido.nome}`, { align: 'center' });
  if (pedido.musica) {
    doc.text(`Música: ${pedido.musica}`, { align: 'center' });
  }
  
  // Finalize o PDF
  doc.end();

  // Espere o arquivo ser totalmente escrito no disco
  await new Promise((resolve) => stream.on('finish', resolve));

  try {
    const options = {
      printer: printerConfigSaved.printerName,
    };
    
    // Imprima o ARQUIVO PDF
    await print(tempFilePath, options); 
    console.log(`Impressão enviada com sucesso para ${printerConfigSaved.printerName}`);

  } catch (error) {
    console.error("❌ ERRO AO IMPRIMIR:", error);
    dialog.showErrorBox('Erro de Impressão', `Não foi possível imprimir.\n\nDetalhes: ${error.message}`);
  } finally {
    // Limpe o arquivo temporário
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`Arquivo PDF temporário removido.`);
    }
  }
});

// --- Outros listeners ---
ipcMain.on('confirmar-resetar-fila', async (event) => {
    const { response } = await dialog.showMessageBox(mainWindow, { type: 'question', buttons: ['Cancelar', 'Sim, Resetar'], defaultId: 1, title: 'Confirmar Reset', message: 'Tem certeza?' });
    if (response === 1) event.sender.send('fila-resetada-confirmada');
});

ipcMain.on('mostrar-alerta', (event, message) => {
    dialog.showMessageBox(mainWindow, { type: 'info', title: 'Aviso', message: message });
});