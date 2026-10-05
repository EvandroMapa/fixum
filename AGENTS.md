<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DIRETRIZES DO PROJETO FIXUM

## 1. RESPONSIVIDADE E MOBILE-FIRST (OBRIGATÓRIO)
- TODA a aplicação, telas, modais, formulários e componentes DEVEM ser 100% funcionais, bonitos e adaptados para CELULAR (telas pequenas, touch) e DESKTOP.
- Usar grids responsivos (grid-template-columns: repeat(auto-fit, minmax(...)), 1fr no mobile, etc.).
- Containers devem ser centralizados (margin: 0 auto, max-width, width: 100%) com padding lateral adequado para não vazar a tela nem gerar scroll horizontal indesejado.
- Botões e áreas de toque com no mínimo 44px de altura para facilitar o toque no celular.
- Formulários com inputs legíveis em telas pequenas (font-size 16px para evitar auto-zoom no iOS).

## 2. IDIOMA E NOMENCLATURA
- Sempre pensar, conversar e programar em Português.
- Nomes de campos e tabelas consistentes com o banco de dados Supabase.

## 3. BANCO DE DADOS
- Supabase é o backend e banco de dados oficial do projeto.
- Tabelas: imoveis (campos: latitude, longitude, preco, tipo, negociacao, bairro, cidade, etc.), fotos_imovel (campos: id, imovel_id, url, principal, ordem), perfis, etc.
- Storage: bucket fotos-imoveis (público).

## 4. PADRÃO OBRIGATÓRIO DE DIÁLOGOS E ALERTAS (MODAIS PROFISSIONAIS)
- **NUNCA utilizar `window.confirm()` ou `window.alert()` nativos do navegador** (eles aparecem colados no topo da barra de endereços e quebram a experiência visual da plataforma).
- Usar SEMPRE o hook `const { confirmar, alertar } = useConfirm()` importado de `@/contexts/ModalConfirmacaoContext`.
- **Confirmações de Ações (`confirmar`)**:
  - Modal centralizado com backdrop blur, ícone temático, título destacado, mensagem explicativa e botões 'Cancelar' + ação (ex: 'Sim, promover', 'Sim, excluir').
  - `icone` recebe o NOME de um ícone de `components/ui/Icone.tsx` (ex: 'coroa', 'lixeira', 'sair', 'alerta', 'info'). Sem `icone`, o modal escolhe pelo `tipo`.
  - Suporta tipo: `'primario'`, `'perigo'`, `'aviso'`, `'sucesso'`.
  - Exemplo: `const confirmou = await confirmar({ titulo: 'Promover a gestor?', mensagem: '...', icone: 'coroa', tipo: 'primario' })`
- **Alertas e Notificações Informativas (`alertar`)**:
  - Modal centralizado com ícone temático, título, mensagem clara e botão único 'Entendi'.
  - Exemplo: `await alertar({ titulo: 'Imóvel publicado', mensagem: '...', icone: 'check', tipo: 'sucesso' })`

## 5. IDENTIDADE VISUAL (MARCA FIXUM)
- Fonte de verdade: `brand/brandbook-fixum.html` (PDF em `brand/brandbook-fixum.pdf`).
- Cores, fontes, raios e sombras vêm dos tokens em `app/globals.css` (`var(--tinta)`, `var(--papel)`, `var(--marco)`…). Não usar hex soltos nem a paleta do Tailwind (azuis/cinzas frios).
- Logo: `<Logotipo />` e `<Simbolo />` de `components/ui/Logo.tsx`. Nunca usar os dois lado a lado.
- Ícones: `<Icone nome="..." />` de `components/ui/Icone.tsx` (traço 1,75). **Nunca usar emojis na interface**: nem em botões, títulos, menus, modais, toasts ou notificações.
- Vermelho Marco (`--marco`) é raro: CTA principal (no máximo um por tela), pin do local exato e ponto do logo.
- Textos de interface em caixa de frase ("Salvar alterações", não "Salvar Alterações"), sem exclamações em excesso, sempre com acentuação correta.
- Vocabulário: "Favoritos" ("Salvar nos favoritos", "Remover dos favoritos"), com o coração como ícone (`<Icone nome="coracao" />`) e o gesto animado do BotaoFixar; "Explorar" no lugar de buscar.
- Preços no mapa: `formatarPrecoCurto()` de `lib/utils.ts` ("R$ 450 mil", "R$ 1.800/mês").

