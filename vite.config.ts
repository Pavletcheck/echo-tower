import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vitest/config';

type PlatformId = 'mock' | 'yandex' | 'crazy' | 'poki' | 'telegram';

const SDK_TAGS: Record<string, string> = {
  // Яндекс подключает SDK относительным путём из консоли разработчика.
  // На площадке /sdk.js отдаёт Яндекс; относительный ./sdk.js давал 404 в корне билда.
  yandex: '<script src="/sdk.js"></script>',
  crazy: '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
  poki: '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
  telegram: '<script src="https://telegram.org/js/telegram-web-app.js"></script>',
};

function platformSdk(platform: PlatformId): Plugin {
  return {
    name: 'echo-platform-sdk',
    transformIndexHtml(html) {
      return html.replace('<!--PLATFORM_SDK-->', SDK_TAGS[platform] ?? '');
    },
  };
}

export default defineConfig(({ mode }) => {
  const platform = (process.env.PLATFORM ?? 'mock') as PlatformId;

  return {
    base: './',
    plugins: [preact(), platformSdk(platform)],
    define: {
      __BUILD_PLATFORM__: JSON.stringify(platform),
      __DEV__: JSON.stringify(mode !== 'production'),
    },
    server: {
      port: 5173,
      host: true,
    },
    build: {
      target: 'es2020',
      assetsInlineLimit: 4096,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
