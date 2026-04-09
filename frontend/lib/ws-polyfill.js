const WebSocket = typeof window !== 'undefined' ? window.WebSocket : require('ws');
module.exports = WebSocket;
module.exports.WebSocket = WebSocket;
module.exports.default = WebSocket;