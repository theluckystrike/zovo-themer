import hookUsoPage from './hook-uso-page';

addEventListener('atelier8d1-uso*', e => hookUsoPage(e.detail), {once: true});
dispatchEvent(new Event('atelier8d1-uso'));
