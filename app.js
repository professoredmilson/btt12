class MicrobitController {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.txCharacteristic = null;
        this.rxCharacteristic = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkBluetoothSupport();
    }
    
    initializeElements() {
        this.btnConnect = document.getElementById('btnConnect');
        this.btnOn = document.getElementById('btnOn');
        this.btnOff = document.getElementById('btnOff');
        this.btnStatus = document.getElementById('btnStatus');
        this.statusDiv = document.getElementById('status');
        this.controlsDiv = document.getElementById('controls');
        this.logDiv = document.getElementById('log');
    }
    
    setupEventListeners() {
        this.btnConnect.addEventListener('click', () => this.connect());
        this.btnOn.addEventListener('click', () => this.sendCommand('ON'));
        this.btnOff.addEventListener('click', () => this.sendCommand('OFF'));
        this.btnStatus.addEventListener('click', () => this.sendCommand('STATUS'));
    }
    
    checkBluetoothSupport() {
        if (!navigator.bluetooth) {
            this.log('Web Bluetooth não é suportado neste navegador');
            this.btnConnect.disabled = true;
            this.btnConnect.textContent = 'Bluetooth Não Suportado';
            return false;
        }
        this.log('Web Bluetooth está disponível');
        return true;
    }
    
    async connect() {
        try {
            if (!this.checkBluetoothSupport()) {
                return;
            }
            
            this.log('Procurando Microbit...');
            
            // Opções de conexão mais simples
            const options = {
                acceptAllDevices: true,
                optionalServices: [
                    '00001800-0000-1000-8000-00805f9b34fb',
                    '00001801-0000-1000-8000-00805f9b34fb',
                    '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
                ]
            };
            
            this.device = await navigator.bluetooth.requestDevice(options);
            this.log(`Dispositivo selecionado: ${this.device.name}`);
            
            this.device.addEventListener('gattserverdisconnected', () => {
                this.onDisconnected();
            });
            
            this.log('Conectando ao GATT Server...');
            this.server = await this.device.gatt.connect();
            
            await this.setupUARTService();
            
            this.updateConnectionStatus(true);
            this.log('Conectado com sucesso! Pronto para controlar o LED');
            
        } catch (error) {
            this.log(`Erro na conexão: ${error.message || error}`);
            this.updateConnectionStatus(false);
        }
    }
    
    async setupUARTService() {
        try {
            // UUIDs do serviço UART do Microbit
            const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
            const TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
            const RX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
            
            this.log('Obtendo serviço UART...');
            this.service = await this.server.getPrimaryService(UART_SERVICE_UUID);
            
            this.log('Obtendo características...');
            this.txCharacteristic = await this.service.getCharacteristic(TX_CHARACTERISTIC_UUID);
            this.rxCharacteristic = await this.service.getCharacteristic(RX_CHARACTERISTIC_UUID);
            
            this.log('Configurando notificações...');
            await this.rxCharacteristic.startNotifications();
            this.rxCharacteristic.addEventListener('characteristicvaluechanged', 
                (event) => this.handleDataReceived(event));
                
        } catch (error) {
            this.log(`Erro no setup UART: ${error.message || error}`);
            throw error;
        }
    }
    
    async sendCommand(command) {
        if (!this.txCharacteristic) {
            this.log('Erro: Não conectado ao dispositivo');
            return;
        }
        
        try {
            // Adicionar nova linha no comando
            const data = new TextEncoder().encode(command + '\n');
            await this.txCharacteristic.writeValue(data);
            this.log(`Comando enviado: ${command}`);
        } catch (error) {
            this.log(`Erro ao enviar comando: ${error.message || error}`);
            this.updateConnectionStatus(false);
        }
    }
    
    handleDataReceived(event) {
        const value = event.target.value;
        const decoder = new TextDecoder();
        const receivedData = decoder.decode(value);
        
        if (receivedData.trim()) {
            this.log(`Microbit: ${receivedData.trim()}`);
            
            // Atualizar interface baseado na resposta
            if (receivedData.includes('ON')) {
                this.updateLEDStatus(true);
            } else if (receivedData.includes('OFF')) {
                this.updateLEDStatus(false);
            }
        }
    }
    
    updateLEDStatus(isOn) {
        const statusElement = document.getElementById('ledStatus') || 
            (() => {
                const el = document.createElement('div');
                el.id = 'ledStatus';
                el.style.margin = '10px 0';
                el.style.padding = '10px';
                el.style.borderRadius = '5px';
                this.controlsDiv.parentNode.insertBefore(el, this.controlsDiv);
                return el;
            })();
            
        if (isOn) {
            statusElement.textContent = '🔴 LED LIGADO';
            statusElement.style.background = '#ffebee';
            statusElement.style.color = '#c62828';
        } else {
            statusElement.textContent = '⚫ LED DESLIGADO';
            statusElement.style.background = '#e8eaf6';
            statusElement.style.color = '#283593';
        }
    }
    
    onDisconnected() {
        this.log('Dispositivo desconectado');
        this.updateConnectionStatus(false);
    }
    
    updateConnectionStatus(connected) {
        if (connected) {
            this.statusDiv.textContent = '✅ Conectado';
            this.statusDiv.className = 'connected';
            this.controlsDiv.classList.remove('hidden');
            this.btnConnect.textContent = 'Desconectar';
            this.btnConnect.onclick = () => this.disconnect();
        } else {
            this.statusDiv.textContent = '❌ Desconectado';
            this.statusDiv.className = 'disconnected';
            this.controlsDiv.classList.add('hidden');
            this.btnConnect.textContent = 'Conectar ao Microbit';
            this.btnConnect.onclick = () => this.connect();
            
            if (this.device && this.device.gatt.connected) {
                this.device.gatt.disconnect();
            }
            
            this.device = null;
            this.txCharacteristic = null;
            this.rxCharacteristic = null;
        }
    }
    
    async disconnect() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        this.updateConnectionStatus(false);
    }
    
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${timestamp}] ${message}`;
        this.logDiv.appendChild(logEntry);
        this.logDiv.scrollTop = this.logDiv.scrollHeight;
        
        // Manter apenas as últimas 50 mensagens
        while (this.logDiv.children.length > 50) {
            this.logDiv.removeChild(this.logDiv.firstChild);
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new MicrobitController();
});
