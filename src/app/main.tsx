import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/styles/index.css';
import '@/styles/editor.css';
import '@/styles/canvas.css';
import '@/styles/panels.css';
import '@/styles/sizes.css';
import '@/styles/fonts.css';
import '@/styles/animation.css';
import '@/styles/timeline.css';
import '@/styles/export.css';
import '@/styles/validation.css';
import '@/styles/components.css';
import '@/styles/color.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');
createRoot(root).render(<StrictMode><App /></StrictMode>);
