export const { REACT_APP_SOCKET_URL, NODE_ENV } = process.env;

export const SOCKET_URL = REACT_APP_SOCKET_URL || '';

export const SOCKET_PATH = NODE_ENV === 'production' ? '/chat/socket.io' : '/socket.io';
