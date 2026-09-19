import './styles/main.css';
import { createApp } from './ui/App.js';

const app = createApp({
  sceneCanvas: document.getElementById('scene-canvas'),
  earthCanvas: document.getElementById('earth-canvas'),
  uiRoot: document.getElementById('ui'),
});

// Handy for poking at the simulation from the browser console.
if (app) window.__supernova = app;
