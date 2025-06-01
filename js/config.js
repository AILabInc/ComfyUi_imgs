// js/config.js

const DEFAULT_CONFIG = {
    serverAddress: '',
    savedServers: [], // Array of { name: 'IP:PORT', value: 'IP:PORT' }
    startNumber: 1,
    quantity: 100,
    fileType: 'PNG',
    subfolder: '',
    filePrefix: 'ComfyUI_',
    numberDigits: '5',
    addUnderscoreSuffix: true,
};

function getConfig(key) {
    const storedConfig = localStorage.getItem('comfyFileExplorerConfig');
    if (storedConfig) {
        const config = JSON.parse(storedConfig);
        return config[key] !== undefined ? config[key] : DEFAULT_CONFIG[key];
    }
    return DEFAULT_CONFIG[key];
}

function setConfig(key, value) {
    const storedConfig = localStorage.getItem('comfyFileExplorerConfig');
    let config = storedConfig ? JSON.parse(storedConfig) : { ...DEFAULT_CONFIG };
    config[key] = value;
    localStorage.setItem('comfyFileExplorerConfig', JSON.stringify(config));
}

function getAllConfig() {
    const storedConfig = localStorage.getItem('comfyFileExplorerConfig');
    if (storedConfig) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
    }
    return { ...DEFAULT_CONFIG };
}

function addSavedServer(serverAddress) {
    if (!isValidServerAddress(serverAddress)) {
        alert('错误: 请输入正确的服务器地址, 格式为 IP:端口 (例如 192.168.1.10:8188)');
        return false;
    }
    const savedServers = getConfig('savedServers');
    if (!savedServers.find(server => server.value === serverAddress)) {
        savedServers.push({ name: serverAddress, value: serverAddress });
        setConfig('savedServers', savedServers);
        return true;
    }
    return false; // Already exists
}

function deleteSavedServer(serverAddress) {
    let savedServers = getConfig('savedServers');
    savedServers = savedServers.filter(server => server.value !== serverAddress);
    setConfig('savedServers', savedServers);
}

function isValidServerAddress(address) {
    if (!address) return false;
    const parts = address.split(':');
    if (parts.length !== 2) return false;
    const ip = parts[0];
    const port = parseInt(parts[1], 10);

    // Basic IPv4 regex (does not cover all edge cases but good enough for client-side)
    const ipRegex = /^((\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.){3}(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/;
    if (!ipRegex.test(ip) && ip !== 'localhost') return false; // Allow 'localhost'

    return !isNaN(port) && port >= 1 && port <= 65535;
}
