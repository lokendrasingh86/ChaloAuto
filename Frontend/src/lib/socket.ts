import { io } from 'socket.io-client';
import { API_ORIGIN } from './api';

// The server identifies the user from the token, so no room ids are sent by the client.
export const socket = io(API_ORIGIN, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('token') }),
});
