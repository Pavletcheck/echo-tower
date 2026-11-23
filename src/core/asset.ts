/**
 * Путь к ассету с учётом base площадки.
 * В сборке base = './', поэтому абсолютные пути ломаются в iframe с подпапкой.
 */
export function asset(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${clean}`;
}

/** Предзагрузка изображения. Не бросает: возвращает false при ошибке. */
export function preloadImage(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = asset(path);
  });
}
