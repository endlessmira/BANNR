import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/styles/index.css';
import '@/styles/editor.css';
import '@/styles/canvas.css';
import '@/styles/panels.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');
createRoot(root).render(<StrictMode><App /></StrictMode>);
