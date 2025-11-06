class MicrobitController {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        
        this.initializeElements();
        this.setupEventListeners();
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
    
    async connect() {
        try {
            this.log('Procurando dispositivo Microbit...');
            
            // Filtros para o Microbit
            const filters = [
                { namePrefix: 'BBC micro:bit' },
                { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] }
            ];
            
            const options = {
                filters: filters,
                optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
            };
            
            // Solicitar dispositivo
            this.device = await navigator.bluetooth.requestDevice(options);
            this.log(`Dispositivo encontrado: ${this.device.name}`);
            
            // Conectar ao GATT Server
            this.log('Conectando...');
            this.server = await this.device.gatt.connect();
            
            // Obter o serviço UART
            this.service = await this.server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
            
            // Obter características
            const txCharacteristic = await this.service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
            const rxCharacteristic = await this.service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
            
            // Configurar recebimento de dados
            await rxCharacteristic.startNotifications();
            rxCharacteristic.addEventListener('characteristicvaluechanged', 
                (event) => this.handleDataReceived(event));
            
            this.characteristic = txCharacteristic;
            
            this.updateConnectionStatus(true);
            this.log('Conectado com sucesso!');
            
            // Monitorar desconexão
            this.device.addEventListener('gattserverdisconnected', () => {
                this.updateConnectionStatus(false);
                this.log('Dispositivo desconectado');
            });
            
        } catch (error) {
            this.log(`Erro na conexão: ${error}`);
            this.updateConnectionStatus(false);
        }
    }
    
    async sendCommand(command) {
        if (!this.characteristic) {
            this.log('Erro: Não conectado ao dispositivo');
            return;
        }
        
        try {
            // Converter comando para ArrayBuffer
            const encoder = new TextEncoder();
            const data = encoder.encode(command + '\n');
            
            await this.characteristic.writeValue(data);
            this.log(`Comando enviado: ${command}`);
        } catch (error) {
            this.log(`Erro ao enviar comando: ${error}`);
        }
    }
    
    handleDataReceived(event) {
        const value = event.target.value;
        const decoder = new TextDecoder();
        const receivedString = decoder.decode(value);
        
        if (receivedString.trim()) {
            this.log(`Microbit: ${receivedString.trim()}`);
        }
    }
    
    updateConnectionStatus(connected) {
        if (connected) {
            this.statusDiv.textContent = 'Conectado';
            this.statusDiv.className = 'connected';
            this.controlsDiv.classList.remove('hidden');
        } else {
            this.statusDiv.textContent = 'Desconectado';
            this.statusDiv.className = 'disconnected';
            this.controlsDiv.classList.add('hidden');
            this.device = null;
            this.characteristic = null;
        }
    }
    
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${timestamp}] ${message}`;
        this.logDiv.appendChild(logEntry);
        this.logDiv.scrollTop = this.logDiv.scrollHeight;
    }
}

// Inicializar a aplicação quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new MicrobitController();
});
