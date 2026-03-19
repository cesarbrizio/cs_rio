# CS RIO

Monorepo frontend do CS Rio.

Contém:

- `apps/mobile`
- `apps/desktop`
- `apps/editor`
- `packages/*`

O backend roda em outro repositório: [cs_rio_api](/home/cesar/projects/cs_rio_api/README.md).

## Requisitos

- Node `22+`
- `npm`
- backend `cs_rio_api` ativo
- para Android: Android SDK, `adb` e Java/JBR

## `.env`

Crie o `.env` na raiz:

```bash
cd /home/cesar/projects/cs_rio
cp .env.example .env
```

Exemplo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:9000
EXPO_PUBLIC_WS_URL=ws://192.168.1.20:2567
EXPO_PUBLIC_APP_ENV=development

# opcionais: sobrescrevem apenas o desktop
# VITE_API_URL=http://192.168.1.20:9000
# VITE_WS_URL=ws://192.168.1.20:2567
# VITE_APP_ENV=development
```

Regras:

- mobile usa `EXPO_PUBLIC_*`
- desktop em `dev` usa `VITE_*`; se eles não existirem, cai para `EXPO_PUBLIC_*`
- em celular físico, use o IP da máquina, não `localhost`
- em emulator Android, use `10.0.2.2`

## Instalação

```bash
cd /home/cesar/projects/cs_rio
npm install
```

## Backend

O frontend não sobe a API. Suba o backend em outro terminal:

```bash
cd /home/cesar/projects/cs_rio_api
cp .env.example .env
npm install
docker compose -f docker-compose.dev.yml up -d
npm run db:push
npm run db:seed
npm run dev
```

Referência comum:

- HTTP: `http://127.0.0.1:9000`
- WS: `ws://127.0.0.1:2567`

## Fluxos de uso

### Tudo junto

Sobe mobile, desktop, editor e watchers dos pacotes compartilhados:

```bash
cd /home/cesar/projects/cs_rio
npm run dev
```

### Só desktop

```bash
cd /home/cesar/projects/cs_rio
npm run dev --workspace @cs-rio/desktop
```

Importante:

- o app correto é a janela do Electron
- a URL do Vite (`http://localhost:5173`, `5174`, `5175`...) é só o renderer em desenvolvimento

### Só mobile

Sobe o Metro:

```bash
cd /home/cesar/projects/cs_rio
npm run dev --workspace @cs-rio/mobile
```

Instala ou atualiza o app no device Android:

```bash
cd /home/cesar/projects/cs_rio/apps/mobile
node ./scripts/run-expo-with-root-env.mjs run:android --device
```

Equivalente Expo, se quiser rodar direto:

```bash
cd /home/cesar/projects/cs_rio/apps/mobile
npx expo run:android --device
```

Preferência do projeto:

- prefira `node ./scripts/run-expo-with-root-env.mjs ...`, porque ele carrega o `.env` da raiz
- `npm run build --workspace @cs-rio/mobile` não instala nem abre o app; ele só valida TypeScript

### Só editor

```bash
cd /home/cesar/projects/cs_rio
npm run dev --workspace @cs-rio/editor
```

## Comandos de qualidade

Na raiz:

```bash
npm run build
npm run generate
npm run lint
npm run test
npm run typecheck
```

Desktop:

```bash
npm run build --workspace @cs-rio/desktop
npm run package --workspace @cs-rio/desktop -- --dir
npm run lint --workspace @cs-rio/desktop
npm run typecheck --workspace @cs-rio/desktop
```

Mobile:

```bash
npm run lint --workspace @cs-rio/mobile
npm run test --workspace @cs-rio/mobile
npm run typecheck --workspace @cs-rio/mobile
```

## Smoke mínimo

### Desktop

1. Abrir a janela do Electron
2. Registrar conta
3. Fazer login
4. Criar personagem
5. Abrir `Home`
6. Abrir `Crimes`
7. Abrir `Mercado`
8. Abrir `Facção`
9. Abrir `Território`
10. Abrir `Inventário`
11. Abrir `Config`

### Mobile

1. Abrir o dev build no device
2. Registrar conta
3. Fazer login
4. Criar personagem
5. Abrir `Home`
6. Abrir `Crimes`
7. Abrir `Mercado`
8. Abrir `Facção`
9. Abrir `Território`

## Troubleshooting

Se login ou registro falharem:

1. confira se o `cs_rio_api` está ativo
2. teste `http://HOST:PORTA/api/health`
3. confira o `.env` da raiz
4. reinicie o comando `dev` depois de mudar o `.env`

Se o problema for só no desktop:

1. confirme que a janela do Electron abriu
2. confirme que o desktop está apontando para a API certa
3. reinicie `npm run dev --workspace @cs-rio/desktop`

## Documentos úteis

- [PRODUCT_STATUS.md](./PRODUCT_STATUS.md)
- [JOGO.md](./JOGO.md)
- [MAPA.md](./MAPA.md)
- [PLANO_CORRECAO_UX.md](./PLANO_CORRECAO_UX.md)
- [TODO.md](./TODO.md)
- [ROLL_OUT.md](./ROLL_OUT.md)
- [PERFORMANCE_UPGRADE.md](./PERFORMANCE_UPGRADE.md)
